import { GameState, CardContext, Attribute, Position } from '../../../types';
import { Dynamic } from './Dynamic';

export const Query = {
    /** Counts the total number of Face-Up Pawns with a specific Attribute across the entire field. */
    CountPawnAttribute: (attribute: Attribute) => (state: GameState, context: CardContext): number => {
        let count = 0;
        state.players.forEach(player => {
            player.entityZones.forEach(zone => {
                if (zone && zone.position !== Position.HIDDEN && zone.card.attribute === attribute) {
                    count++;
                }
            });
        });
        return count;
    },

    /** Counts the total number of Set (Hidden) Actions and Conditions on a specific player's field. */
    CountSetActions: (playerScope: 'active' | 'opponent' | 'both') => (state: GameState, context: CardContext): number => {
        let count = 0;
        const activeIdx = state.activePlayerIndex;
        const oppIdx = (activeIdx + 1) % 2;

        state.players.forEach((player, idx) => {
            if (playerScope === 'active' && idx !== activeIdx) return;
            if (playerScope === 'opponent' && idx !== oppIdx) return;

            player.actionZones.forEach(zone => {
                if (zone && zone.position === Position.HIDDEN) count++;
            });
        });
        return count;
    },

    /** Retrieves the Context Target Player Index */
    TargetPlayerIndex: () => (state: GameState, context: CardContext): number => {
        return context.target?.playerIndex ?? state.activePlayerIndex;
    },

    /** Retrieves the active player's opponent index */
    ActiveOpponent: () => (state: GameState, context: CardContext): number => {
        return (state.activePlayerIndex + 1) % 2;
    },

    /** Retrieves the Context Target Zone Index */
    TargetZoneIndex: () => (state: GameState, context: CardContext): number => {
        return context.target?.index ?? -1;
    },

    /** Math operation */
    Multiply: (valueFn: Dynamic<number>, multiplier: number) => (state: GameState, context: CardContext): number => {
        const val1 = typeof valueFn === 'function' ? (valueFn as Function)(state, context) : valueFn;
        return val1 * multiplier;
    }
};
