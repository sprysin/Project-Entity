import { EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Card } from '../../../types';

export const Cost = {
    /** Deducts LP dynamically. */
    PayLP: (amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const activePlayer = draftState.players[draftState.activePlayerIndex];
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        activePlayer.lp -= resolvedAmount;
        return { log: `Paid ${resolvedAmount} LP.` };
    },

    /** Prompts the player to discard a card matching a specific filter. */
    DiscardCardFilter: (message: string, filter?: (c: Card) => boolean): EffectStep => (draftState, context) => {
        if (context.handIndex === undefined) {
            return {
                requireHandSelection: {
                    playerIndex: draftState.activePlayerIndex,
                    title: message,
                    filter
                },
                log: "Select a card to discard."
            };
        }

        const activePlayer = draftState.players[draftState.activePlayerIndex];
        const discardedCard = activePlayer.hand[context.handIndex];

        if (discardedCard) {
            // In future, you might evaluate the filter here too if needed, but the UI locks it down.
            activePlayer.hand.splice(context.handIndex, 1);
            activePlayer.discard.push(discardedCard);
            return { log: `Discarded ${discardedCard.name}.` };
        }

        return { log: "Error: Could not discard card.", halt: true };
    },

    /** Request selection of a card from the discard. */
    SelectDiscardRecovery: (message: string, filter: (c: Card) => boolean): EffectStep => (draftState, context) => {
        if (context.discardIndex === undefined) {
            return {
                requireDiscardSelection: {
                    playerIndex: draftState.activePlayerIndex,
                    title: message,
                    filter
                },
                log: "Select a card from the Void/Discard pile."
            };
        }
        return { log: "Target recovered from discard." };
    }
};
