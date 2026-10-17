import { fieldEntries, sourceZone, targetZone, removeFieldIdentity } from '../../game/field';
import { activationCost, activationReservation, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { ActionSubtype, Attribute, Card, CardContext, CardFilter, CardType, GameState, PawnSubtype, PawnType, Phase, PlacedCard, Position, ShuffleLocation, TargetSelectScope } from '../../types';
import { canSetPawn, cardsAtLocation, fieldStats, isContract, isReservePawn, refreshFieldTypes, setPawnPosition, shuffleDeck, spendCancelledAttack } from '../../game/cardHelpers';
import { cardRegistry } from '../CardRegistry';
import { getEffectTarget } from './Targets';
import { drawCards } from '../../game/draw';
import { sendToOwnerPile } from '../../game/cardOwnership';
import { destroyFieldCard, destroyOrphanedAttachments } from '../../game/attachments';
import { notifyFieldEvent } from '../../game/fieldEvents';
import { randomSelection, selectFieldCards, takeSelectedCard } from './Selections';
import { handSummonCandidates } from '../../game/summonReactions';
import { canPayLevelTribute, LevelTributeOptions } from '../../game/levelTributes';

export const Effect = {
    /** Temporary type overrides and continuous type changes share the same refresh path. */
    ChangeTargetPawnType: (value: PawnType, duration: 'field' | 'end_of_turn' | 'end_of_next_turn' | 'end_of_your_next_turn' = 'field', targetIndex = 0): EffectStep => (state, context) => {
        const target = getEffectTarget(context, targetIndex);
        const zone = target?.type === 'pawn' ? targetZone(state, target) : undefined;
        if (!zone) return { halt: true };
        const delay = duration === 'end_of_next_turn' ? 1 : duration === 'end_of_your_next_turn' ? state.activePlayerIndex === context.playerIndex ? 2 : 1 : 0;
        zone.pawnTypeOverride = { value, ...(duration === 'field' ? {} : { dueTurn: state.turnNumber + delay }) };
        refreshFieldTypes(state);
    },
    ChangeDiscardPawnTypes: (from: PawnType, to: PawnType): EffectStep => (state, context) => {
        for (const card of state.players[context.playerIndex].discard) if (card.type === CardType.PAWN && card.pawnType === from) card.pawnType = to;
    },
    SpecialSummonFromDiscard: (filter: CardFilter, attachSource = false): EffectStep => (state, context) => {
        const selection = Effect.SelectDiscardCards(card => card.type === CardType.PAWN && filter(card), 1, 'summon')(state, context);
        if (selection) return selection;
        const placementRequest = Effect.RequirePawnPlacement()(state, context);
        if (placementRequest) return placementRequest;
        const player = state.players[context.playerIndex];
        const index = player.discard.findIndex(card => card.instanceId === context.discardCardIds![0]);
        const [card] = player.discard.splice(index, 1);
        const placement = context.pawnPlacement!;
        player.pawnZones[placement.slot] = { card, position: placement.position, hasAttacked: false, hasChangedPosition: false,
            summonedTurn: state.turnNumber, isSetTurn: false, specialSummoned: true };
        if (attachSource) {
            const source = sourceZone(state, context);
            if (source && context.card.isAttached) source.attachedToInstanceIds = [card.instanceId];
        }
    },
    /** Select several hand identities, then choose each Pawn's position and zone. */
    SpecialSummonHandCards: (filter: CardFilter, maximum: number): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const eligible = (card: Card) => card.type === CardType.PAWN && !isReservePawn(card) && filter(card);
        const ids = context.shuffleCardIds;
        if (!ids) return { requireShuffleSelection: { playerIndex: context.playerIndex, location: 'hand', count: Math.min(maximum, player.pawnZones.filter(zone => !zone).length), upTo: true, filter: eligible } };
        if (ids.length > maximum || new Set(ids).size !== ids.length) return { halt: true };
        const placements = context.pawnPlacements ?? [];
        for (let index = 0; index < ids.length; index++) {
            const card = player.hand.find(card => card.instanceId === ids[index] && eligible(card));
            if (!card) { if (context.execution === 'resolve') continue; return { halt: true }; }
            const slots = player.pawnZones.flatMap((zone, slot) => !zone && !placements.slice(0, index).some(value => value?.slot === slot) ? [slot] : []);
            const placement = placements[index];
            if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex, slots, placementIndex: index } };
            if (!slots.includes(placement.slot) || ![Position.ATTACK, Position.DEFENSE].includes(placement.position)) return { halt: true };
        }
        for (let index = 0; index < ids.length; index++) {
            const slot = player.hand.findIndex(card => card.instanceId === ids[index]);
            if (slot < 0) continue;
            const [card] = player.hand.splice(slot, 1), placement = placements[index];
            player.pawnZones[placement.slot] = { card, position: placement.position, hasAttacked: false, hasChangedPosition: false,
                summonedTurn: state.turnNumber, isSetTurn: false, specialSummoned: true };
        }
    },
    BonusNextDraw: (count: number): EffectStep => (state, context) => {
        state.players[context.playerIndex].additionalDraws = (state.players[context.playerIndex].additionalDraws ?? 0) + count;
    },
    DestroySelf: (): EffectStep => (state, context) => { destroyFieldCard(state, context.card.instanceId, 'effect', context.playerIndex); },
    NegateAttack: (): EffectStep => (state) => {
        const attack = state.deferredAction;
        if (attack?.kind !== 'attack') return { halt: true };
        const attacker = state.players[state.activePlayerIndex].pawnZones.find(zone => zone?.card.instanceId === attack.attackerId);
        if (attacker) spendCancelledAttack(attacker);
        state.deferredAction = undefined;
    },
    SelectFieldCards: selectFieldCards,
    /** Destroy only the selected identities that are still on the field. */
    DestroySelectedFieldCards: (): EffectStep => (state, context) => {
        for (const id of context.shuffleCardIds ?? []) destroyFieldCard(state, id, 'effect', context.playerIndex);
    },
    /** Move Attach cards and their tracked stat bonuses to this face-up Pawn. */
    ReattachSelectedToSelf: (): EffectStep => (state, context) => {
        const destination = sourceZone(state, context);
        if (!destination || destination.position === Position.HIDDEN || destination.card.type !== CardType.PAWN) return;
        for (const id of context.shuffleCardIds ?? []) {
            const source = fieldEntries(state).find(({ zone }) => zone.card.instanceId === id)?.zone;
            if (!source?.card.isAttached || source.position === Position.HIDDEN) continue;
            for (const { zone } of fieldEntries(state)) {
                const bonuses = zone.attachmentStatBonuses?.filter(bonus => bonus.sourceInstanceId === id) ?? [];
                for (const bonus of bonuses) {
                    zone.card.atk = Math.max(0, zone.card.atk - bonus.atk);
                    zone.card.def = Math.max(0, zone.card.def - bonus.def);
                    destination.card.atk = Math.max(0, destination.card.atk + bonus.atk);
                    destination.card.def = Math.max(0, destination.card.def + bonus.def);
                }
                zone.attachmentStatBonuses = zone.attachmentStatBonuses?.filter(bonus => bonus.sourceInstanceId !== id);
                destination.attachmentStatBonuses = [...(destination.attachmentStatBonuses ?? []), ...bonuses];
            }
            source.attachedToInstanceIds = [destination.card.instanceId];
        }
    },
    /** Create Bombs owned by the specified deck's player, then shuffle that deck. */
    ShuffleBombsIntoDeck: (id: string, count: number, playerIndex: Dynamic<number>): EffectStep => (state, context) => {
        const definition = cardRegistry.getCard(id);
        const destination = resolveDynamic(playerIndex, state, context);
        const player = state.players[destination];
        if (!player || definition?.actionSubtype !== ActionSubtype.BOMB || !Number.isInteger(count) || count < 1) return { halt: true };
        const cards = Array.from({ length: count }, () => ({ ...definition, instanceId: crypto.randomUUID(), ownerId: player.id }));
        player.deck.push(...cards);
        shuffleDeck(player.deck);
        state.bombInsertions = [...(state.bombInsertions ?? []), { sourceId: context.card.instanceId, playerIndex: destination, cards }];
    },
    /** LP loss does not count as effect damage. */
    LoseLP: (amount: number): EffectStep => (state, context) => {
        state.players[context.playerIndex].lp -= amount;
    },
    SendTargetToDiscard: (targetIndex = 0, onSent?: EffectStep): EffectStep => (state, context) => {
        const target = getEffectTarget(context, targetIndex);
        const zone = target && targetZone(state, target);
        if (!zone) return { halt: true };
        sendToOwnerPile(state, zone.card, 'discard');
        removeFieldIdentity(state, zone.card.instanceId);
        Object.assign(state, destroyOrphanedAttachments(state));
        if (state.players.some(player => player.discard.some(card => card.instanceId === zone.card.instanceId))) return onSent?.(state, context);
    },
    ReturnTargetToHand: (targetIndex = 0): EffectStep => (state, context) => {
        const target = getEffectTarget(context, targetIndex);
        const zone = target && targetZone(state, target);
        if (!zone) return { halt: true };
        sendToOwnerPile(state, zone.card, 'hand');
        removeFieldIdentity(state, zone.card.instanceId);
        Object.assign(state, destroyOrphanedAttachments(state));
    },
    SpecialSummonSelfFromHand: (): EffectStep => (state, context) => {
        const index = state.players[context.playerIndex].hand.findIndex(card => card.instanceId === context.card.instanceId);
        if (index < 0) return { halt: true };
        return Effect.SpecialSummonFromHand(card => card.instanceId === context.card.instanceId)(state, { ...context, handIndex: index, handSelectionId: context.card.instanceId });
    },
    QueueHandSummon: (mandatory = false): EffectStep => (state, context) => {
        if (!handSummonCandidates(state, { sourceId: context.card.instanceId, playerIndex: context.playerIndex }).length) return;
        state.pendingHandSummons = [...(state.pendingHandSummons ?? []), {
            sourceId: context.card.instanceId, playerIndex: context.playerIndex, mandatory
        }];
    },
    MultiplySelfAttackForTurn: (factor: number): EffectStep => (state, context) => {
        const zone = sourceZone(state, context);
        if (!zone) return { halt: true };
        const delta = fieldStats(state, zone).atk * (factor - 1);
        const value = zone.card.atk;
        zone.card.atk += delta;
        state.pendingEffects.push({ type: 'RESET_ATK', targetInstanceId: zone.card.instanceId,
            value, delta, dueTurn: state.turnNumber });
    },
    DiscardFromHand: (filter: CardFilter = () => true): EffectStep => (state, context) => {
        if (context.handIndex === undefined && !context.handSelectionId) return { requireHandSelection: {
            playerIndex: context.playerIndex, filter, purpose: 'discard', prompt: 'Select 1 card to send to the Discard'
        } };
        const player = state.players[context.playerIndex];
        const index = context.handSelectionId ? player.hand.findIndex(card => card.instanceId === context.handSelectionId) : context.handIndex!;
        const card = player.hand[index];
        if (!card || !filter(card)) return { halt: true };
        player.hand.splice(index, 1);
        sendToOwnerPile(state, card, 'discard');
        if (cardRegistry.getEffect(card.id)?.onDiscard) state.pendingTriggers = [...(state.pendingTriggers ?? []), {
            context: { card, playerIndex: context.playerIndex }, trigger: 'discard'
        }];
    },
    /** A final stat override preserves underlying modifiers and expires with the turn. */
    SetTargetAttack: (value: Dynamic<number>): EffectStep => (state, context) => {
        const target = getEffectTarget(context);
        const zone = target && targetZone(state, target);
        if (!zone || zone.card.type !== CardType.PAWN) return { halt: true };
        zone.attackOverride = { value: resolveDynamic(value, state, context), turn: state.turnNumber };
    },
    SetTargetOriginalAttack: (): EffectStep => Effect.SetTargetAttack((state, context) => {
        const target = getEffectTarget(context), zone = target && targetZone(state, target);
        return zone ? cardRegistry.getCard(zone.card.id)?.atk ?? zone.card.atk : 0;
    }),
    randomSelection,
    /** Gather player-selected candidates independently of their eventual effect. */
    SelectDiscardCards: (filter: CardFilter, count: number, purpose?: 'summon'): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const ids = context.discardCardIds ?? [];
        if (!Number.isInteger(count) || count < 1 || player.discard.filter(filter).length < count
            || ids.length > count || new Set(ids).size !== ids.length
            || ids.some(id => !player.discard.some(card => card.instanceId === id && filter(card)))) return { halt: true };
        if (ids.length < count) return { requireDiscardSelection: {
            playerIndex: context.playerIndex, purpose, selectionIndex: ids.length, cards: player.discard,
            prompt: `Select card ${ids.length + 1} of ${count} from your Discard`,
            filter: card => filter(card) && !ids.includes(card.instanceId)
        } };
    },
    /** Choose placement before sampling, so suspended effects do not reroll a selection. */
    RequirePawnPlacement: (position?: Position): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        if (!player.pawnZones.includes(null)) return { halt: true };
        const placement = context.pawnPlacement;
        if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex, position, slots: player.pawnZones.flatMap((zone, slot) => zone ? [] : [slot]) } };
        if (!Number.isInteger(placement.slot) || placement.slot < 0 || placement.slot >= player.pawnZones.length
            || player.pawnZones[placement.slot] || (position ? placement.position !== position
                : ![Position.ATTACK, Position.DEFENSE].includes(placement.position))) return { halt: true };
    },
    /** Summon a previously selected Pawn from any off-field pile. */
    SummonSelected: (position: Position.ATTACK | Position.DEFENSE, selectionIndex = 0): EffectStep => (state, context) => {
        const selection = context.selections?.[selectionIndex];
        const placement = context.pawnPlacement;
        const player = state.players[context.playerIndex];
        if (!selection || selection.location === 'field' || selection.card.type !== CardType.PAWN
            || !placement || !Number.isInteger(placement.slot) || placement.slot < 0
            || placement.slot >= player.pawnZones.length || player.pawnZones[placement.slot]
            || placement.position !== position) return { halt: true };
        const card = takeSelectedCard(state, context, selectionIndex);
        if (!card) return { halt: true };
        player.pawnZones[placement.slot] = { card, position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false, specialSummoned: true };
        if (selection.location === 'deck') shuffleDeck(state.players[selection.playerIndex].deck);
    },
    /** Move a selection to its owner's pile; deck moves shuffle by default. */
    MoveSelectedTo: (destination: 'deck' | 'hand' | 'discard' | 'void', selectionIndex = 0, shuffle = destination === 'deck'): EffectStep => (state, context) => {
        const selection = context.selections?.[selectionIndex];
        if (!selection) return { halt: true };
        const card = cardsAtLocation(state.players[selection.playerIndex], selection.location, state)
            .find(entry => entry.card.instanceId === selection.card.instanceId)?.card;
        if (!card) return { halt: true };
        // Keep the original placement visible while restoring field-only stats.
        sendToOwnerPile(state, card, destination);
        takeSelectedCard(state, context, selectionIndex);
        if (selection.location === 'field') Object.assign(state, destroyOrphanedAttachments(state));
        const owner = state.players.find(player => player.id === card.ownerId);
        if (shuffle && destination === 'deck' && owner) shuffleDeck(owner.deck);
    },
    /** Select the Reserve identity before costs that depend on its properties. */
    SelectReservePawn: (subtype: PawnSubtype, filter: CardFilter, tributeOptions?: LevelTributeOptions): EffectStep => activationCost((state, context) => {
        const player = state.players[context.playerIndex];
        const eligible: CardFilter = card => card.type === CardType.PAWN && card.pawnSubtype === subtype && filter(card)
            && (!tributeOptions || canPayLevelTribute(state, { playerIndex: context.playerIndex, totalLevel: card.level, ...tributeOptions }));
        if (!player.reserve.some(eligible)) return { halt: true };
        if (context.reserveIndex === undefined) return { requireReserveSelection: { playerIndex: context.playerIndex, filter: eligible, purpose: 'summon', prompt: `Select a ${subtype} from your Reserve` } };
        const card = player.reserve[context.reserveIndex];
        if (!card || !eligible(card)) return { halt: true };
    }),
    /** Contract summon from Reserve; selections and freed zones are checked again on resolution. */
    SummonFromReserve: (subtype: PawnSubtype, filter: CardFilter): EffectStep => (state, context) => {
        if (!isContract(context.card)) return { halt: true };
        const selection = Effect.SelectReservePawn(subtype, filter)(state, context);
        if (selection) return selection;
        const player = state.players[context.playerIndex];
        if (!player.pawnZones.includes(null)) return { halt: true };
        const card = player.reserve[context.reserveIndex!];
        const placementResult = Effect.RequirePawnPlacement()(state, context);
        if (placementResult) return placementResult;
        const placement = context.pawnPlacement!;
        player.reserve.splice(context.reserveIndex, 1);
        player.pawnZones[placement.slot] = { card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false, specialSummoned: true };
    },
    /** Shuffle selected cards from hand, field, or discard into their owners' decks. */
    ShuffleFrom: (location: ShuffleLocation, count: number, filter: CardFilter = () => true, upTo = false): EffectStep => (state, context) => {
        if (!Number.isInteger(count) || count < 1) return { halt: true };
        const player = state.players[context.playerIndex];
        const candidates = cardsAtLocation(player, location, state);
        const cardIds = context.shuffleCardIds;
        if (!cardIds) return { requireShuffleSelection: { playerIndex: context.playerIndex, location, count, filter, upTo } };
        if ((upTo ? cardIds.length > count : cardIds.length !== count) || new Set(cardIds).size !== cardIds.length
            || cardIds.some(id => !candidates.some(entry => entry.card.instanceId === id && filter(entry.card)))) return { halt: true };
        const selected = cardIds.map(id => candidates.find(entry => entry.card.instanceId === id)!);
        for (const index of selected.map(entry => entry.index).sort((a, b) => b - a)) {
            if (location === 'hand') player.hand.splice(index, 1);
            else if (location === 'discard') player.discard.splice(index, 1);
            else removeFieldIdentity(state, selected.find(entry => entry.index === index)!.card.instanceId);
        }
        for (const { card } of selected) sendToOwnerPile(state, card, 'deck');
        for (const ownerId of new Set(selected.map(entry => entry.card.ownerId))) {
            const owner = state.players.find(candidate => candidate.id === ownerId);
            if (owner) shuffleDeck(owner.deck);
        }
        if (location === 'field') Object.assign(state, destroyOrphanedAttachments(state));
    },
    /** Remember both field identities; the source may leave the field before the victory. */
    RewardTargetBattleVictory: (pawnIndex: number, opponentIndex: number): EffectStep => (state, context) => {
        const pawnTarget = getEffectTarget(context, pawnIndex), opponentTarget = getEffectTarget(context, opponentIndex);
        const pawn = pawnTarget && targetZone(state, pawnTarget), opponent = opponentTarget && targetZone(state, opponentTarget);
        if (!pawn || !opponent) return { halt: true };
        state.battleRewards = [...(state.battleRewards ?? []), {
            card: context.card, playerIndex: context.playerIndex, pawnId: pawn.card.instanceId,
            targetId: opponent.card.instanceId, turn: state.turnNumber
        }];
    },
    CounterCount: (name: string, targetIndex?: number) => (state: GameState, context: CardContext): number => {
        const target = targetIndex === undefined ? undefined : getEffectTarget(context, targetIndex);
        const zone = targetIndex !== undefined ? target && targetZone(state, target)
            : sourceZone(state, context);
        return zone && zone.position !== Position.HIDDEN ? zone.counters?.[name] ?? 0 : 0;
    },
    /** Changes a named counter on this card or an explicitly selected target. */
    ModulateCounter: (name: string, amount: Dynamic<number>, targetIndex?: number): EffectStep => (state, context) => {
        const target = targetIndex === undefined ? undefined : getEffectTarget(context, targetIndex);
        if (targetIndex !== undefined && !target) return { halt: true };
        const zone = target ? targetZone(state, target)
            : sourceZone(state, context);
        const delta = resolveDynamic(amount, state, context);
        if (!zone || zone.position === Position.HIDDEN || !Number.isSafeInteger(delta)) return { halt: true };
        const next = (zone.counters?.[name] ?? 0) + delta;
        if (next < 0 || !Number.isSafeInteger(next)) return { halt: true };
        zone.counters = { ...zone.counters, [name]: next };
        if (!next) delete zone.counters[name];
    },
    RequireFaceUpSource: (): EffectStep => (state, context) => {
        const zone = sourceZone(state, context);
        if (!zone || zone.position === Position.HIDDEN) return { halt: true };
    },
    /** Select a Pawn from the Deck, choose an empty zone, then summon and shuffle. */
    SpecialSummonFromDeck: (filter: CardFilter, position?: Position.ATTACK | Position.DEFENSE): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const eligible: CardFilter = card => card.type === CardType.PAWN && !isReservePawn(card) && filter(card);
        if (!player.pawnZones.includes(null) || !player.deck.some(eligible)) return { halt: true };
        if (context.deckIndex === undefined) return { requireDeckSelection: { playerIndex: context.playerIndex, filter: eligible, purpose: 'summon', prompt: 'Select a Pawn to special summon' } };
        const card = player.deck[context.deckIndex];
        if (!card || !eligible(card)) return { halt: true };
        const placementResult = Effect.RequirePawnPlacement(position)(state, context);
        if (placementResult) return placementResult;
        const placement = context.pawnPlacement!;
        player.deck.splice(context.deckIndex, 1);
        player.pawnZones[placement.slot] = {
            card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false, specialSummoned: true
        };
        shuffleDeck(player.deck);
    },
    SpecialSummonFromHand: (filter: CardFilter, position?: Position): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const eligible: CardFilter = card => card.type === CardType.PAWN && !isReservePawn(card) && filter(card)
            && (position !== Position.HIDDEN || canSetPawn(card));
        if (context.handIndex === undefined && !context.handSelectionId) return {
            requireHandSelection: { playerIndex: context.playerIndex, filter: eligible, purpose: 'summon', prompt: 'Select a Pawn to special summon' }
        };
        const handIndex = context.handSelectionId ? player.hand.findIndex(card => card.instanceId === context.handSelectionId) : context.handIndex!;
        const card = player.hand[handIndex];
        if (!card || !eligible(card)) return { halt: true };
        const placementResult = Effect.RequirePawnPlacement(position)(state, context);
        if (placementResult) return placementResult;
        const placement = context.pawnPlacement!;
        player.hand.splice(handIndex, 1);
        player.pawnZones[placement.slot] = {
            card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: placement.position === Position.HIDDEN, specialSummoned: true
        };
    },
    SetOnceWhileOnField: (): EffectStep => activationReservation((state, context) => {
        const zone = sourceZone(state, context);
        if (!zone || zone.hasUsedWhileOnField) return { halt: true };
        zone.hasUsedWhileOnField = true;
    }),

    /** Placement is chosen before activation; both humans and AI use the same request. */
    SummonToken: (id: string, count = 1): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const definition = cardRegistry.getCard(id);
        if (!definition || definition.pawnSubtype !== PawnSubtype.TOKEN || !Number.isInteger(count) || count < 1) return { halt: true };
        const available = player.pawnZones.filter(zone => !zone).length;
        if (available < count) return { halt: true };
        const placements = count === 1 ? [context.pawnPlacement] : context.pawnPlacements ?? [];
        for (let index = 0; index < count; index++) {
            const placement = placements[index];
            const slots = player.pawnZones.flatMap((zone, slot) => !zone && !placements.slice(0, index).some(value => value?.slot === slot) ? [slot] : []);
            if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex, slots, ...(count > 1 ? { placementIndex: index } : {}) } };
            if (!slots.includes(placement.slot) || ![Position.ATTACK, Position.DEFENSE].includes(placement.position)) return { halt: true };
        }
        for (const placement of placements.slice(0, count)) {
            const card: Card = { ...definition, ownerId: player.id, instanceId: crypto.randomUUID() };
            player.pawnZones[placement!.slot] = {
                card, position: placement!.position, hasAttacked: false,
                hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false, specialSummoned: true
            };
        }
    },
    /** Grants attacks for this turn without bypassing other combat restrictions. */
    GrantSelfAttacks: (count: number): EffectStep => (state, context) => {
        const zone = state.players[context.playerIndex].pawnZones.find(value => value?.card.instanceId === context.card.instanceId);
        if (!zone) return;
        if (zone.position === Position.HIDDEN) return { halt: true };
        zone.effectUsedTurn = { ...zone.effectUsedTurn, attackGrant: state.turnNumber };
        if (state.currentPhase === Phase.BATTLE) zone.attacksRemaining = (zone.attacksRemaining ?? (zone.hasAttacked ? 0 : 1)) + count;
        else zone.nextBattleAttacks = (zone.nextBattleAttacks ?? 0) + count;
        zone.hasAttacked = false;
    },
    /** Attribute changes expire when the affected identity leaves the field. */
    ChangePawnAttribute: (attribute: Attribute, locate: (state: GameState, context: CardContext) => PlacedCard | null): EffectStep => (state, context) => {
        const zone = locate(state, context);
        if (!zone) return { halt: true };
        zone.card.fieldOriginalAttribute ??= zone.card.attribute;
        zone.card.attribute = attribute;
    },
    /** Destroys the selected field card. */
    DestroyTarget: (targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (!target) return { halt: true };
        const zone = targetZone(draftState, target);
        if (!zone) return { halt: true };
        destroyFieldCard(draftState, zone.card.instanceId, 'effect', context.playerIndex);
    },
    /** Has the opponent choose one card in their hand to reveal privately to this effect's controller. */
    PeekOpponentHand: (): EffectStep => (draftState, context) => {
        const ownerPlayerIndex = 1 - context.playerIndex;
        if (context.peekIndex === undefined) {
            return {
                requirePeekSelection: {
                    playerIndex: ownerPlayerIndex,
                    viewerPlayerIndex: context.playerIndex
                }
            };
        }
        const card = draftState.players[ownerPlayerIndex].hand[context.peekIndex];
        if (!card) return { halt: true };
        draftState.peekEvents = [...(draftState.peekEvents ?? []), {
            id: `${context.card.instanceId}:${card.instanceId}:${draftState.turnNumber}`,
            card: { ...card },
            ownerPlayerIndex,
            viewerPlayerIndex: context.playerIndex
        }];
    },

    /** Attach to a field card by identity; supports Pawn, Action and Condition targets. */
    AttachToTarget: (targetIndex = 0): EffectStep => (state, context) => {
        const target = getEffectTarget(context, targetIndex);
        const source = state.players[context.playerIndex].actionZones.find(z => z?.card.instanceId === context.card.instanceId);
        const destination = target && targetZone(state, target);
        if (!context.card.isAttached || !destination || source === destination) return { halt: true };
        // AI previews legal hand plays before a field slot is chosen.
        if (!source) return context.execution !== 'resolve' && state.players[context.playerIndex].hand.some(c => c.instanceId === context.card.instanceId) ? undefined : { halt: true };
        source.attachedToInstanceIds = [...new Set([...(source.attachedToInstanceIds ?? []), destination.card.instanceId])];
    },
    /** Changes every Pawn in a player scope to the requested position. */
    ChangeAllPawnPositions: (scope: TargetSelectScope, newPosition: Position): EffectStep => (draftState, context) => {
        draftState.players.forEach((player, playerIndex) => {
            const isOpponent = playerIndex !== context.playerIndex;
            if (scope === 'active' && isOpponent || scope === 'opponent' && !isOpponent) return;
            player.pawnZones.forEach(zone => {
                if (zone) setPawnPosition(zone, newPosition);
            });
        });
    },

    /** Modifies every Pawn in a player scope, optionally restoring its prior stats at a future End Phase. */
    ModifyAllPawnStats: (
        scope: TargetSelectScope,
        atkChange: number,
        defChange: number,
        duration: 'permanent' | 'end_of_next_turn' | 'end_of_turn' = 'permanent'
    ): EffectStep => (draftState, context) => {
        draftState.players.forEach((player, playerIndex) => {
            const isOpponent = playerIndex !== context.playerIndex;
            if (scope === 'active' && isOpponent || scope === 'opponent' && !isOpponent) return;
            player.pawnZones.forEach((zone, index) => {
                if (zone) Effect.ModifyTargetStats(atkChange, defChange, 0, duration === 'permanent' ? undefined : duration)(draftState,
                    { ...context, targets: undefined, target: { playerIndex, type: 'pawn', index } });
            });
        });
    },

    /** Changes the position of the targeted pawn. */
    ChangeTargetPosition: (newPosition: Position, targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (target) {
            const player = draftState.players[target.playerIndex];
            const targetPawn = player.pawnZones[target.index];
            if (targetPawn && targetPawn.position !== newPosition) {
                if (newPosition === Position.HIDDEN && !canSetPawn(targetPawn.card)) return { halt: true };
                setPawnPosition(targetPawn, newPosition);
            }
        }
    },

    /** Modifies the targeted Pawn's stats. */
    ModifyTargetStats: (atkChange: number, defChange: number, targetIndex = 0, untilPhase?: Phase | 'end_of_next_turn' | 'end_of_turn'): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (target) {
            const p = draftState.players[target.playerIndex];
            const tE = p.pawnZones[target.index];
            if (tE) {
                const previousAtk = tE.card.atk, previousDef = tE.card.def;
                tE.card.atk = Math.max(0, previousAtk + atkChange);
                tE.card.def = Math.max(0, previousDef + defChange);
                if (untilPhase) {
                    for (const [type, value, delta] of [
                        ['RESET_ATK', previousAtk, tE.card.atk - previousAtk],
                        ['RESET_DEF', previousDef, tE.card.def - previousDef]
                    ] as const) if (delta) draftState.pendingEffects.push({
                        type, targetInstanceId: tE.card.instanceId, value, delta,
                        dueTurn: draftState.turnNumber + (untilPhase === 'end_of_next_turn' ? 1 : 0),
                        duePhase: untilPhase === 'end_of_next_turn' || untilPhase === 'end_of_turn' ? undefined : untilPhase
                    });
                }
                const source = draftState.players[context.playerIndex].actionZones.find(z => z?.card.instanceId === context.card.instanceId);
                if (context.card.isAttached && source?.attachedToInstanceIds?.includes(tE.card.instanceId)) {
                    tE.attachmentStatBonuses ??= [];
                    tE.attachmentStatBonuses.push({
                        sourceInstanceId: context.card.instanceId,
                        atk: tE.card.atk - previousAtk, def: tE.card.def - previousDef
                    });
                }
            }
        }
    },

    /** Changes position of the activating card. */
    ChangeSelfPosition: (position: Position | 'toggle'): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId);
        const newPosition = position === 'toggle' ? selfZone?.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK : position;
        if (selfZone && selfZone.position !== newPosition) {
            if (newPosition === Position.HIDDEN && !canSetPawn(selfZone.card)) return { halt: true };
            setPawnPosition(selfZone, newPosition);
        }
    },

    /** Modifies the activating card's stats on the field. */
    ModifySelfStats: (atkChange: Dynamic<number>, defChange: Dynamic<number>, untilEndOfTurn = false): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone) {
            const previousAtk = selfZone.card.atk, previousDef = selfZone.card.def;
            selfZone.card.atk = Math.max(0, selfZone.card.atk + resolveDynamic(atkChange, draftState, context));
            selfZone.card.def = Math.max(0, selfZone.card.def + resolveDynamic(defChange, draftState, context));
            if (untilEndOfTurn) for (const [type, value, delta] of [
                ['RESET_ATK', previousAtk, selfZone.card.atk - previousAtk], ['RESET_DEF', previousDef, selfZone.card.def - previousDef]
            ] as const) if (delta) draftState.pendingEffects.push({ type, value, delta, targetInstanceId: selfZone.card.instanceId, dueTurn: draftState.turnNumber });
        }
    },

    /** Draws a dynamic number of cards. */
    DrawCards: (amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        if (resolvedAmount <= 0) return;

        Object.assign(draftState, drawCards(draftState, context.playerIndex, resolvedAmount));

    },

    /** Deals damage to a specific player's LP. */
    DealDamage: (playerIndex: Dynamic<number>, amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        const resolvedPlayerIndex = resolveDynamic(playerIndex, draftState, context);

        if (resolvedAmount <= 0) return;

        if (resolvedPlayerIndex !== context.playerIndex) {
            draftState.damageEvents = [...(draftState.damageEvents ?? []), {
                card: { ...context.card }, playerIndex: context.playerIndex,
                amount: resolvedAmount, kind: 'effect'
            }];
        }
        draftState.players[resolvedPlayerIndex].lp -= resolvedAmount;
        Object.assign(draftState, notifyFieldEvent(draftState, 'onEffectDamage', {
            damageCard: context.card, damageEffectId: context.effectId,
            damagedPlayerIndex: resolvedPlayerIndex, amount: resolvedAmount
        }));
    },

    SkipNextDrawPhase: (): EffectStep => (state, context) => {
        state.players[context.playerIndex].skipNextDrawPhase = true;
    },

    /** Restores LP to a specific player. */
    RestoreLP: (playerIndex: Dynamic<number>, amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        const resolvedPlayerIndex = resolveDynamic(playerIndex, draftState, context);

        if (resolvedAmount <= 0) return;

        draftState.players[resolvedPlayerIndex].lp += resolvedAmount;
        draftState.lpGainEvents = [...(draftState.lpGainEvents ?? []), { playerIndex: resolvedPlayerIndex, amount: resolvedAmount }];
    },

    /** Temporarily removes a Pawn; its return is independent of the effect source. */
    VoidTargetTemporarily: (phase: Phase, delayTurns = 0, targetIndex = 0): EffectStep => (state, context) => {
        if (!Number.isInteger(delayTurns) || delayTurns < 0) return { halt: true };
        const target = getEffectTarget(context, targetIndex);
        const zone = target?.type === 'pawn' ? state.players[target.playerIndex]?.pawnZones[target.index] : undefined;
        if (!target || !zone) return { halt: true };
        const ownerIndex = state.players.findIndex(player => player.id === zone.card.ownerId);
        Effect.BanishTargetToVoid(targetIndex)(state, context);
        if (ownerIndex >= 0 && state.players[ownerIndex].void.some(card => card.instanceId === zone.card.instanceId)) {
            state.temporaryVoidReturns = [...(state.temporaryVoidReturns ?? []), {
                cardId: zone.card.instanceId, playerIndex: ownerIndex, position: zone.position,
                phase, dueTurn: state.turnNumber + delayTurns
            }];
        }
        Object.assign(state, destroyOrphanedAttachments(state));
    },

    /** Sends a targeted card to the Void. */
    BanishTargetToVoid: (targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (target) {
            const cardInZone = targetZone(draftState, target);

            if (cardInZone) {
                sendToOwnerPile(draftState, cardInZone.card, 'void');
                removeFieldIdentity(draftState, cardInZone.card.instanceId);
            }
        }
    },

    /** Moves a specific card from Discard to Hand. */
    RecoverFromDiscardToHand: (): EffectStep => (draftState, context) => {
        if (context.discardIndex !== undefined) {
            const p = draftState.players[context.playerIndex];
            const card = p.discard[context.discardIndex];
            if (card) {
                p.discard.splice(context.discardIndex, 1);
                sendToOwnerPile(draftState, card, 'hand');
            } else return { halt: true };
        }
    },

    /** Registers a Lingering Effect on the active activating card. */
    RegisterSelfPendingEffect: (type: 'RESET_ATK' | 'RESET_DEF', value: number, durationTurns: number = 0, delta?: number): EffectStep => (draftState, context) => {
        draftState.pendingEffects.push({
            type,
            targetInstanceId: context.card.instanceId,
            value,
            delta,
            dueTurn: draftState.turnNumber + durationTurns
        });
    },

    /** Marks the card instance as having used its effect this turn. */
    SetSoftOncePerTurn: (effectId?: string, cooldownTurns = 0): EffectStep => activationReservation((draftState, context) => {
        const selfZone = sourceZone(draftState, context);
        if (selfZone && effectId) {
            const used = selfZone.effectUsedTurn?.[effectId];
            if (used !== undefined && draftState.turnNumber <= used + cooldownTurns) return { halt: true };
            selfZone.effectUsedTurn = { ...selfZone.effectUsedTurn, [effectId]: draftState.turnNumber };
        } else if (selfZone) selfZone.hasActivatedEffect = true;
    }),

    /** Field-only restrictions expire after all End Phase responses finish. */
    RestrictForTurn: (restriction: 'tributeBlockedThisTurn' | 'effectTargetBlockedThisTurn', targetIndex?: number): EffectStep => (state, context) => {
        const target = targetIndex === undefined ? undefined : getEffectTarget(context, targetIndex);
        const zone = target ? targetZone(state, target)
            : targetIndex === undefined ? state.players[context.playerIndex].pawnZones.find(z => z?.card.instanceId === context.card.instanceId) : undefined;
        if (!zone) return { halt: true };
        zone.card[restriction] = true;
    },

    /** Marks the card ID as having used its effect globally for the rest of the turn. */
    SetHardOncePerTurn: (cardId: string): EffectStep => activationReservation((draftState, context) => {
        const p = draftState.players[context.playerIndex];
        if (!p.activatedHardOncePerTurns) p.activatedHardOncePerTurns = [];
        if (!p.activatedHardOncePerTurns.includes(cardId)) p.activatedHardOncePerTurns.push(cardId);
    }),

    // --- DECK SEARCHING ---

    /** Prompts the player to select a card from their deck matching a filter, then adds it to hand and shuffles. */
    SearchDeck: (filter: CardFilter): EffectStep => (draftState, context) => {
        if (context.deckIndex === undefined) return { requireDeckSelection: { playerIndex: context.playerIndex, filter } };
        const player = draftState.players[context.playerIndex];
        const card = player.deck[context.deckIndex];
        if (!card || !filter(card)) return { halt: true };
        player.deck.splice(context.deckIndex, 1);
        sendToOwnerPile(draftState, card, 'hand');
        shuffleDeck(player.deck);
    }
};
