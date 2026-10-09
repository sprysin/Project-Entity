import { canSetPawn, canTribute, setPawnPosition } from '../../game/cardHelpers';
import { activationCost, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Card, CardFilter, Position, ShuffleLocation, TargetSelectPosition, TargetSelectScope } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { Effect } from './Effects';
import { getEffectTarget } from './Targets';
import { sendToOwnerPile } from '../../game/cardOwnership';
import { levelTributeCandidates } from '../../game/levelTributes';
import { destroyOrphanedAttachments } from '../../game/attachments';

export const Cost = {
    /** Select and Void distinct cards from the activating player's Discard. */
    VoidDiscardCards: (count: number, filter: CardFilter): EffectStep => activationCost((state, context) => {
        const selection = Effect.SelectDiscardCards(filter, count)(state, context);
        if (selection) return selection;
        const player = state.players[context.playerIndex];
        for (const id of context.discardCardIds!) {
            const index = player.discard.findIndex(card => card.instanceId === id);
            sendToOwnerPile(state, player.discard.splice(index, 1)[0], 'void');
        }
    }),
    TributeExactLevels: (totalLevel: number): EffectStep => activationCost((state, context) => {
        if (!context.materialIds) return { requireLevelTribute: { playerIndex: context.playerIndex, totalLevel } };
        const candidates = levelTributeCandidates(state, context.playerIndex);
        const selected = context.materialIds.map(id => candidates.find(entry => entry.card.instanceId === id));
        if (!selected.length || new Set(context.materialIds).size !== selected.length || selected.some(entry => !entry)
            || selected.reduce((sum, entry) => sum + entry!.card.level, 0) !== totalLevel) return { halt: true };
        context.tributeCards = selected.map(entry => entry!.card);
        const player = state.players[context.playerIndex];
        for (const entry of selected) {
            const card = { ...entry!.card, tributedByAction: context.card.type === 'ACTION' };
            sendToOwnerPile(state, card, 'discard');
            if (entry!.location === 'hand') player.hand = player.hand.filter(value => value.instanceId !== card.instanceId);
            else player.pawnZones = player.pawnZones.map(zone => zone?.card.instanceId === card.instanceId ? null : zone);
        }
        Object.assign(state, destroyOrphanedAttachments(state));
    }),
    /** Pay for an activation by shuffling selected cards into their owners' decks. */
    ShuffleFrom: (location: ShuffleLocation, count: number, filter?: CardFilter): EffectStep => activationCost(Effect.ShuffleFrom(location, count, filter)),
    /** Destroys the activating Pawn as an activation cost. */
    DestroySelf: (): EffectStep => activationCost((draftState, context) => {
        const player = draftState.players[context.playerIndex];
        const index = player.pawnZones.findIndex(zone => zone?.card.instanceId === context.card.instanceId);
        if (index < 0) return { halt: true };
        sendToOwnerPile(draftState, player.pawnZones[index]!.card, 'discard');
        player.pawnZones[index] = null;
    }),

    /** Selects a controlled Pawn and changes its position as an activation cost. */
    ChangePawnPosition: (
        newPosition: Position,
        fromPosition: TargetSelectPosition = 'both',
        targetIndex = 0,
        scope: TargetSelectScope = 'active'
    ): EffectStep => activationCost((draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (!target) return {
            requireTarget: 'pawn',
            requireTargetPosition: fromPosition,
            requireTargetScope: scope,
            requireTargetIndex: targetIndex,
            requireTargetFilter: newPosition === Position.HIDDEN ? canSetPawn : undefined
        };
        const isOpponent = target.playerIndex !== context.playerIndex;
        const zone = target.type === 'pawn' ? draftState.players[target.playerIndex]?.pawnZones[target.index] : null;
        if (!zone || newPosition === Position.HIDDEN && !canSetPawn(zone.card)
            || scope === 'active' && isOpponent
            || scope === 'opponent' && !isOpponent
            || fromPosition === 'faceup' && zone.position === Position.HIDDEN
            || fromPosition === 'hidden' && zone.position !== Position.HIDDEN) return { halt: true };
        setPawnPosition(zone, newPosition);
    }),

    /** Deducts LP dynamically. */
    PayLP: (amount: Dynamic<number>): EffectStep => activationCost((draftState, context) => {
        const activePlayer = draftState.players[context.playerIndex];
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        if (!Number.isFinite(resolvedAmount) || resolvedAmount < 0 || activePlayer.lp < resolvedAmount) return { halt: true };
        activePlayer.lp -= resolvedAmount;
    }),

    /** Prompts the player to tribute pawns on their field. */
    TributePawns: (count: number, filter?: (c: Card) => boolean): EffectStep => activationCost((draftState, context) => {
        if (context.tributeIndices === undefined) {
            return {
                requireEffectTribute: {
                    playerIndex: context.playerIndex,
                    count,
                    filter: card => canTribute(card) && (!filter || filter(card))
                }
            };
        }

        const player = draftState.players[context.playerIndex];
        const indices = context.tributeIndices;
        if (indices.length !== count || new Set(indices).size !== count || indices.some(i => !player.pawnZones[i] || !canTribute(player.pawnZones[i]!.card) || (filter && !filter(player.pawnZones[i]!.card)))) return { halt: true };
        context.tributeCards = indices.map(i => player.pawnZones[i]!.card);
        indices.forEach(i => {
            sendToOwnerPile(draftState, { ...player.pawnZones[i]!.card, tributedByAction: context.card.type === 'ACTION' }, 'discard');
            player.pawnZones[i] = null;
        });
    }),

    /** Prompts the player to discard a card matching a specific filter. */
    DiscardCardFilter: (filter?: (c: Card) => boolean): EffectStep => activationCost((draftState, context) => {
        if (context.handIndex === undefined) {
            return {
                requireHandSelection: {
                    playerIndex: context.playerIndex,
                    filter: card => canTribute(card) && (!filter || filter(card))
                }
            };
        }

        const activePlayer = draftState.players[context.playerIndex];
        const discardedCard = activePlayer.hand[context.handIndex];

        if (discardedCard && (!filter || filter(discardedCard))) {
            activePlayer.hand.splice(context.handIndex, 1);
            sendToOwnerPile(draftState, discardedCard, 'discard');

            if (cardRegistry.getEffect(discardedCard.id)?.onDiscard) {
                draftState.pendingTriggers = [...(draftState.pendingTriggers ?? []), {
                    context: { card: discardedCard, playerIndex: context.playerIndex }, trigger: 'discard'
                }];
            }
            return;
        }

        return { halt: true };
    }),

    /** Request selection of a card from the discard. */
    SelectDiscardRecovery: (filter: (c: Card) => boolean): EffectStep => (draftState, context) => {
        if (context.discardIndex === undefined) {
            return {
                requireDiscardSelection: {
                    playerIndex: context.playerIndex,
                    filter
                }
            };
        }
        const card = draftState.players[context.playerIndex].discard[context.discardIndex];
        if (!card || !filter(card)) return { halt: true };
    }
};
