import { activationCost, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Card, Position, TargetSelectPosition, TargetSelectScope } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { getEffectTarget } from './Targets';

export const Cost = {
    /** Destroys the activating Pawn as an activation cost. */
    DestroySelf: (): EffectStep => activationCost((draftState, context) => {
        const player = draftState.players[context.playerIndex];
        const index = player.pawnZones.findIndex(zone => zone?.card.instanceId === context.card.instanceId);
        if (index < 0) return { halt: true };
        player.discard.push(player.pawnZones[index]!.card);
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
            requireTargetIndex: targetIndex
        };
        const isOpponent = target.playerIndex !== context.playerIndex;
        const zone = target.type === 'pawn' ? draftState.players[target.playerIndex]?.pawnZones[target.index] : null;
        if (!zone
            || scope === 'active' && isOpponent
            || scope === 'opponent' && !isOpponent
            || fromPosition === 'faceup' && zone.position === Position.HIDDEN
            || fromPosition === 'hidden' && zone.position !== Position.HIDDEN) return { halt: true };
        zone.position = newPosition;
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
                    filter
                }
            };
        }

        const player = draftState.players[context.playerIndex];
        const indices = context.tributeIndices;
        if (indices.length !== count || new Set(indices).size !== count || indices.some(i => !player.pawnZones[i] || (filter && !filter(player.pawnZones[i]!.card)))) return { halt: true };
        context.tributeCards = indices.map(i => player.pawnZones[i]!.card);
        indices.forEach(i => {
            player.discard.push({ ...player.pawnZones[i]!.card, tributedByAction: context.card.type === 'ACTION' });
            player.pawnZones[i] = null;
        });
    }),

    /** Prompts the player to discard a card matching a specific filter. */
    DiscardCardFilter: (filter?: (c: Card) => boolean): EffectStep => activationCost((draftState, context) => {
        if (context.handIndex === undefined) {
            return {
                requireHandSelection: {
                    playerIndex: context.playerIndex,
                    filter
                }
            };
        }

        const activePlayer = draftState.players[context.playerIndex];
        const discardedCard = activePlayer.hand[context.handIndex];

        if (discardedCard && (!filter || filter(discardedCard))) {
            activePlayer.hand.splice(context.handIndex, 1);
            activePlayer.discard.push(discardedCard);

            const discardEffect = cardRegistry.getEffect(discardedCard.id)?.onDiscard;
            if (discardEffect) {
                const result = discardEffect(draftState, {
                    card: discardedCard,
                    playerIndex: context.playerIndex
                });
                if (result.halted) return { halt: true };
                Object.assign(draftState, result.newState);
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
