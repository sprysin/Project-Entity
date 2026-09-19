import { activationCost, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Card } from '../../types';

export const Cost = {
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
            // In future, you might evaluate the filter here too if needed, but the UI locks it down.
            activePlayer.hand.splice(context.handIndex, 1);
            activePlayer.discard.push(discardedCard);
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
