import { EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Position, CardType } from '../../../types';

export const Require = {
    /** Prompts the player to select a target on the field. */
    Target: (type: 'pawn' | 'action' | 'any' = 'pawn', message = "Select a target."): EffectStep => (draftState, context) => {
        if (!context.target) return { requireTarget: type, log: message };
    },

    /** Verifies the provided target relies on a specific player scope. */
    TargetIsPlayerScope: (scope: 'active' | 'opponent', message = "Invalid target player scope."): EffectStep => (draftState, context) => {
        if (context.target) {
            const expectOpponent = scope === 'opponent';
            const isOpponent = context.target.playerIndex !== draftState.activePlayerIndex;
            if (isOpponent !== expectOpponent) return { log: message, halt: true };
        }
    },

    /** Verifies the provided target matches a position state. */
    TargetMatchesPosition: (position: Position, invert = false, message = "Invalid target position."): EffectStep => (draftState, context) => {
        if (context.target) {
            const p = draftState.players[context.target.playerIndex];
            const t = context.target.type === 'pawn' ? p.pawnZones[context.target.index] : p.actionZones[context.target.index];
            if (!t) return { log: message, halt: true };

            const matches = t.position === position;
            if ((matches && invert) || (!matches && !invert)) {
                return { log: message, halt: true };
            }
        }
    },

    /** Generically checks if a numerical evaluation matches the required threshold, halting if it fails. */
    CompareValue: (valueFn: Dynamic<number>, operator: '>=' | '<=' | '==' | '>' | '<', compareTo: Dynamic<number>, message = "Requirement not met."): EffectStep => (draftState, context) => {
        const val1 = resolveDynamic(valueFn, draftState, context);
        const val2 = resolveDynamic(compareTo, draftState, context);

        let pass = false;
        if (operator === '>=') pass = val1 >= val2;
        else if (operator === '<=') pass = val1 <= val2;
        else if (operator === '>') pass = val1 > val2;
        else if (operator === '<') pass = val1 < val2;
        else pass = val1 === val2;

        if (!pass) return { log: message, halt: true };
    }
};

export const Condition = {
    /** Generically checks if a numerical evaluation matches the required threshold. */
    CompareValue: (valueFn: Dynamic<number>, operator: '>=' | '<=' | '==' | '>' | '<', compareTo: Dynamic<number>): (state: any, context: any) => boolean => (state, context) => {
        const val1 = resolveDynamic(valueFn, state, context);
        const val2 = resolveDynamic(compareTo, state, context);
        if (operator === '>=') return val1 >= val2;
        if (operator === '<=') return val1 <= val2;
        if (operator === '>') return val1 > val2;
        if (operator === '<') return val1 < val2;
        return val1 === val2;
    },

    /** Checks if a specific attribute exists on any valid Pawn on the provided player scope field. */
    PawnMatchesFilter: (scope: 'active' | 'opponent' | 'both', filter: (zone: any) => boolean): (state: any, context: any) => boolean => (state, context) => {
        const activeIdx = state.activePlayerIndex;
        const oppIdx = (activeIdx + 1) % 2;

        return state.players.some((player: any, idx: number) => {
            if (scope === 'active' && idx !== activeIdx) return false;
            if (scope === 'opponent' && idx !== oppIdx) return false;
            return player.pawnZones.some((z: any) => z !== null && filter(z));
        });
    },

    /** Verifies a specific item exists in a specific player's discard. */
    DiscardMatchesFilter: (scope: 'active' | 'opponent', filter: (card: any) => boolean): (state: any, context: any) => boolean => (state, context) => {
        const pIdx = scope === 'active' ? state.activePlayerIndex : (state.activePlayerIndex + 1) % 2;
        return state.players[pIdx].discard.some(filter);
    },

    /** Checks if a specific Action/Condition is on the board. */
    ActionMatchesFilter: (scope: 'active' | 'opponent' | 'both', filter: (zone: any) => boolean): (state: any, context: any) => boolean => (state, context) => {
        const activeIdx = state.activePlayerIndex;
        const oppIdx = (activeIdx + 1) % 2;

        return state.players.some((player: any, idx: number) => {
            if (scope === 'active' && idx !== activeIdx) return false;
            if (scope === 'opponent' && idx !== oppIdx) return false;
            return player.actionZones.some((z: any) => z !== null && filter(z));
        });
    }
};
