import { GameState, CardContext, Attribute, Position, TargetSelectScope } from '../../types';
import { Dynamic, resolveDynamic } from './Dynamic';

export const Query = {
    CounterPayment: () => (_state: GameState, context: CardContext): number => Number(context.effectId?.replace(/^counters:/, '') ?? 0),
    /** Counts the total number of Face-Up Pawns with a specific Attribute across the entire field. */
    CountPawnAttribute: (attribute: Attribute, scope: TargetSelectScope = 'both', excludeSelf = false) => (state: GameState, context: CardContext): number => {
        let count = 0;
        state.players.forEach((player, playerIndex) => {
            if (scope === 'active' && playerIndex !== context.playerIndex || scope === 'opponent' && playerIndex === context.playerIndex) return;
            player.pawnZones.forEach(zone => {
                if (zone && zone.position !== Position.HIDDEN && zone.card.attribute === attribute
                    && (!excludeSelf || zone.card.instanceId !== context.card.instanceId)) {
                    count++;
                }
            });
        });
        return count;
    },

    /** Counts the total number of Set (Hidden) Actions and Conditions on a specific player's field. */
    CountSetActions: (playerScope: 'active' | 'opponent' | 'both') => (state: GameState, context: CardContext): number => {
        let count = 0;
        const activeIdx = context.playerIndex;
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

    /** Retrieves the active player's opponent index */
    ActiveOpponent: () => (_state: GameState, context: CardContext): number => {
        return (context.playerIndex + 1) % 2;
    },

    /** Math operation */
    Multiply: (valueFn: Dynamic<number>, multiplier: number) => (state: GameState, context: CardContext): number => {
        return resolveDynamic(valueFn, state, context) * multiplier;
    }
};
