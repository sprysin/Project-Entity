import { EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Card } from '../../../types';

export const Cost = {
    /** Deducts LP dynamically. */
    PayLP: (amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const activePlayer = draftState.players[context.playerIndex];
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        activePlayer.lp -= resolvedAmount;
    },

    /** Prompts the player to tribute pawns on their field. */
    TributePawns: (count: number, filter?: (c: Card) => boolean): EffectStep => (_draftState, context) => {
        if (context.tributeIndices === undefined) {
            return {
                requireEffectTribute: {
                    playerIndex: context.playerIndex,
                    count,
                    filter
                }
            };
        }

        return;
    },

    /** Prompts the player to discard a card matching a specific filter. */
    DiscardCardFilter: (filter?: (c: Card) => boolean): EffectStep => (draftState, context) => {
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

        if (discardedCard) {
            // In future, you might evaluate the filter here too if needed, but the UI locks it down.
            activePlayer.hand.splice(context.handIndex, 1);
            activePlayer.discard.push(discardedCard);
            return;
        }

        return { halt: true };
    },

    /** Request selection of a card from the discard. */
    SelectDiscardRecovery: (filter: (c: Card) => boolean): EffectStep => (_draftState, context) => {
        if (context.discardIndex === undefined) {
            return {
                requireDiscardSelection: {
                    playerIndex: context.playerIndex,
                    filter
                }
            };
        }
        return;
    }
};
