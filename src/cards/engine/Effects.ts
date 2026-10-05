import { activationReservation, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { ActionSubtype, Card, CardContext, CardFilter, CardType, GameState, PawnSubtype, Phase, Position, ShuffleLocation, TargetSelectScope } from '../../types';
import { canSetPawn, cardsAtLocation, isReservePawn, setPawnPosition, shuffleDeck } from '../../game/cardHelpers';
import { cardRegistry } from '../CardRegistry';
import { getEffectTarget } from './Targets';
import { drawCards } from '../../game/draw';
import { sendToOwnerPile } from '../../game/cardOwnership';
import { destroyFieldCard, destroyOrphanedAttachments } from '../../game/attachments';
import { notifyFieldEvent } from '../../game/fieldEvents';

export const Effect = {
    /** Contract summon from Reserve; selections and freed zones are checked again on resolution. */
    SummonFromReserve: (subtype: PawnSubtype, filter: CardFilter): EffectStep => (state, context) => {
        if (context.card.type !== CardType.ACTION || context.card.actionSubtype !== ActionSubtype.CONTRACT) return { halt: true };
        const player = state.players[context.playerIndex];
        const eligible: CardFilter = card => card.type === CardType.PAWN && card.pawnSubtype === subtype && filter(card);
        const slots = player.pawnZones.flatMap((zone, index) => zone ? [] : [index]);
        if (!slots.length || !player.reserve.some(eligible)) return { halt: true };
        if (context.reserveIndex === undefined) return { requireReserveSelection: { playerIndex: context.playerIndex, filter: eligible, purpose: 'summon', prompt: `Select a ${subtype} from your Reserve` } };
        const card = player.reserve[context.reserveIndex];
        if (!card || !eligible(card)) return { halt: true };
        const placement = context.pawnPlacement;
        if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex, slots } };
        if (!slots.includes(placement.slot) || ![Position.ATTACK, Position.DEFENSE].includes(placement.position)) return { halt: true };
        player.reserve.splice(context.reserveIndex, 1);
        player.pawnZones[placement.slot] = { card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false };
    },
    /** Shuffle selected cards from hand, field, or discard into their owners' decks. */
    ShuffleFrom: (location: ShuffleLocation, count: number, filter: CardFilter = () => true): EffectStep => (state, context) => {
        if (!Number.isInteger(count) || count < 1) return { halt: true };
        const player = state.players[context.playerIndex];
        const candidates = cardsAtLocation(player, location);
        const cardIds = context.shuffleCardIds;
        if (!cardIds) return { requireShuffleSelection: { playerIndex: context.playerIndex, location, count, filter } };
        if (cardIds.length !== count || new Set(cardIds).size !== count
            || cardIds.some(id => !candidates.some(entry => entry.card.instanceId === id && filter(entry.card)))) return { halt: true };
        const selected = cardIds.map(id => candidates.find(entry => entry.card.instanceId === id)!);
        for (const index of selected.map(entry => entry.index).sort((a, b) => b - a)) {
            if (location === 'hand') player.hand.splice(index, 1);
            else if (location === 'discard') player.discard.splice(index, 1);
            else if (index < player.pawnZones.length) player.pawnZones[index] = null;
            else player.actionZones[index - player.pawnZones.length] = null;
        }
        for (const { card } of selected) sendToOwnerPile(state, card, 'deck');
        for (const ownerId of new Set(selected.map(entry => entry.card.ownerId))) {
            const owner = state.players.find(candidate => candidate.id === ownerId);
            if (owner) shuffleDeck(owner.deck);
        }
        if (location === 'field') Object.assign(state, destroyOrphanedAttachments(state));
    },
    CounterCount: (name: string, targetIndex?: number) => (state: GameState, context: CardContext): number => {
        const target = targetIndex === undefined ? undefined : getEffectTarget(context, targetIndex);
        const zone = targetIndex !== undefined ? target && state.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'][target.index]
            : [...state.players[context.playerIndex].pawnZones, ...state.players[context.playerIndex].actionZones]
                .find(candidate => candidate?.card.instanceId === context.card.instanceId);
        return zone && zone.position !== Position.HIDDEN ? zone.counters?.[name] ?? 0 : 0;
    },
    /** Changes a named counter on this card or an explicitly selected target. */
    ModulateCounter: (name: string, amount: Dynamic<number>, targetIndex?: number): EffectStep => (state, context) => {
        const target = targetIndex === undefined ? undefined : getEffectTarget(context, targetIndex);
        if (targetIndex !== undefined && !target) return { halt: true };
        const zone = target ? state.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'][target.index]
            : [...state.players[context.playerIndex].pawnZones, ...state.players[context.playerIndex].actionZones]
                .find(candidate => candidate?.card.instanceId === context.card.instanceId);
        const delta = resolveDynamic(amount, state, context);
        if (!zone || zone.position === Position.HIDDEN || !Number.isSafeInteger(delta)) return { halt: true };
        const next = (zone.counters?.[name] ?? 0) + delta;
        if (next < 0 || !Number.isSafeInteger(next)) return { halt: true };
        zone.counters = { ...zone.counters, [name]: next };
        if (!next) delete zone.counters[name];
    },
    RequireFaceUpSource: (): EffectStep => (state, context) => {
        const zone = [...state.players[context.playerIndex].pawnZones, ...state.players[context.playerIndex].actionZones]
            .find(candidate => candidate?.card.instanceId === context.card.instanceId);
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
        const placement = context.pawnPlacement;
        if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex, position } };
        if (!Number.isInteger(placement.slot) || placement.slot < 0 || placement.slot >= player.pawnZones.length
            || player.pawnZones[placement.slot] || ![Position.ATTACK, Position.DEFENSE].includes(placement.position)
            || position && placement.position !== position) return { halt: true };
        player.deck.splice(context.deckIndex, 1);
        player.pawnZones[placement.slot] = {
            card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false
        };
        shuffleDeck(player.deck);
    },
    SpecialSummonFromHand: (filter: CardFilter): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const eligible: CardFilter = card => card.type === CardType.PAWN && !isReservePawn(card) && filter(card);
        if (context.handIndex === undefined) return {
            requireHandSelection: { playerIndex: context.playerIndex, filter: eligible, purpose: 'summon', prompt: 'Select a Pawn to special summon' }
        };
        const card = player.hand[context.handIndex];
        if (!card || !eligible(card)) return { halt: true };
        const placement = context.pawnPlacement;
        if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex } };
        if (!Number.isInteger(placement.slot) || placement.slot < 0 || placement.slot >= player.pawnZones.length
            || player.pawnZones[placement.slot] || ![Position.ATTACK, Position.DEFENSE].includes(placement.position)) return { halt: true };
        player.hand.splice(context.handIndex, 1);
        player.pawnZones[placement.slot] = {
            card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false
        };
    },
    SetOnceWhileOnField: (): EffectStep => activationReservation((state, context) => {
        const zone = [...state.players[context.playerIndex].pawnZones, ...state.players[context.playerIndex].actionZones]
            .find(z => z?.card.instanceId === context.card.instanceId);
        if (!zone || zone.hasUsedWhileOnField) return { halt: true };
        zone.hasUsedWhileOnField = true;
    }),

    /** Placement is chosen before activation; both humans and AI use the same request. */
    SummonToken: (id: string): EffectStep => (state, context) => {
        const player = state.players[context.playerIndex];
        const placement = context.pawnPlacement;
        if (!placement) return { requirePawnPlacement: { playerIndex: context.playerIndex } };
        const definition = cardRegistry.getCard(id);
        if (!definition || !Number.isInteger(placement.slot) || placement.slot < 0 || placement.slot >= player.pawnZones.length
            || player.pawnZones[placement.slot] || ![Position.ATTACK, Position.DEFENSE].includes(placement.position)) return { halt: true };
        const card: Card = { ...definition, ownerId: player.id, instanceId: crypto.randomUUID() };
        player.pawnZones[placement.slot] = {
            card, position: placement.position, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false
        };
    },
    /** Destroys the selected field card. */
    DestroyTarget: (targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (!target) return { halt: true };
        const zones = draftState.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'];
        const zone = zones[target.index];
        if (!zone) return { halt: true };
        destroyFieldCard(draftState, zone.card.instanceId);
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
        const destination = target && state.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'][target.index];
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
            player.pawnZones.forEach(zone => {
                if (!zone) return;
                const originalAtk = zone.card.atk;
                const originalDef = zone.card.def;
                zone.card.atk = Math.max(0, originalAtk + atkChange);
                zone.card.def = Math.max(0, originalDef + defChange);
                if (duration === 'permanent') return;
                const dueTurn = draftState.turnNumber + (duration === 'end_of_next_turn' ? 1 : 0);
                if (atkChange) draftState.pendingEffects.push({
                    type: 'RESET_ATK', targetInstanceId: zone.card.instanceId,
                    value: originalAtk, dueTurn
                });
                if (defChange) draftState.pendingEffects.push({
                    type: 'RESET_DEF', targetInstanceId: zone.card.instanceId,
                    value: originalDef, dueTurn
                });
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
    ModifyTargetStats: (atkChange: number, defChange: number, targetIndex = 0, untilPhase?: Phase): EffectStep => (draftState, context) => {
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
                        dueTurn: draftState.turnNumber, duePhase: untilPhase
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
    ChangeSelfPosition: (newPosition: Position): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone && selfZone.position !== newPosition) {
            if (newPosition === Position.HIDDEN && !canSetPawn(selfZone.card)) return { halt: true };
            setPawnPosition(selfZone, newPosition);
        }
    },

    /** Modifies the activating card's stats on the field. */
    ModifySelfStats: (atkChange: number, defChange: number): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone) {
            selfZone.card.atk = Math.max(0, selfZone.card.atk + atkChange);
            selfZone.card.def = Math.max(0, selfZone.card.def + defChange);
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
            const p = draftState.players[target.playerIndex];
            const zones = target.type === 'pawn' ? p.pawnZones : p.actionZones;
            const cardInZone = zones[target.index];

            if (cardInZone) {
                sendToOwnerPile(draftState, cardInZone.card, 'void');
                zones[target.index] = null;
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
                p.hand.push(card);
            } else return { halt: true };
        }
    },

    /** Registers a Lingering Effect (e.g. ATK reset at End Phase). */
    RegisterPendingEffect: (type: 'RESET_ATK', targetInstanceId: string, value: number): EffectStep => (draftState, _context) => {
        draftState.pendingEffects.push({
            type,
            targetInstanceId,
            value,
            dueTurn: draftState.turnNumber
        });
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
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId) || p.actionZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone && effectId) {
            const used = selfZone.effectUsedTurn?.[effectId];
            if (used !== undefined && draftState.turnNumber <= used + cooldownTurns) return { halt: true };
            selfZone.effectUsedTurn = { ...selfZone.effectUsedTurn, [effectId]: draftState.turnNumber };
        } else if (selfZone) selfZone.hasActivatedEffect = true;
    }),

    /** Field-only restrictions expire after all End Phase responses finish. */
    RestrictForTurn: (restriction: 'tributeBlockedThisTurn' | 'effectTargetBlockedThisTurn', targetIndex?: number): EffectStep => (state, context) => {
        const target = targetIndex === undefined ? undefined : getEffectTarget(context, targetIndex);
        const zone = target ? state.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'][target.index]
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
        player.hand.push(card);
        shuffleDeck(player.deck);
    }
};
