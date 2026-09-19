import { activationCost, ConditionStep, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Card, PlacedCard, Position } from '../../types';

export const Require = {
    /** Prompts the player to select a target on the field. */
    Target: (type: 'pawn' | 'action' | 'any' = 'pawn', set: 'hidden' | 'faceup' | 'both' = 'both'): EffectStep => (draftState, context) => {
        if (!context.target) return { requireTarget: type, requireTargetPosition: set };
        const target = context.target;
        if (type !== 'any' && target.type !== type) return { halt: true };
        const zone = draftState.players[target.playerIndex]?.[target.type === 'pawn' ? 'pawnZones' : 'actionZones'][target.index];
        if (!zone || set === 'hidden' && zone.position !== Position.HIDDEN || set === 'faceup' && zone.position === Position.HIDDEN) return { halt: true };
    },

    /** Verifies the provided target relies on a specific player scope. */
    TargetIsPlayerScope: (scope: 'active' | 'opponent'): EffectStep => (_draftState, context) => {
        if (context.target) {
            const expectOpponent = scope === 'opponent';
            const isOpponent = context.target.playerIndex !== context.playerIndex;
            if (isOpponent !== expectOpponent) return { halt: true };
        }
    },

    /** Verifies the provided target matches a position state. */
    TargetMatchesPosition: (position: Position, invert = false): EffectStep => (draftState, context) => {
        if (context.target) {
            const p = draftState.players[context.target.playerIndex];
            const t = context.target.type === 'pawn' ? p.pawnZones[context.target.index] : p.actionZones[context.target.index];
            if (!t) return { halt: true };

            const matches = t.position === position;
            if ((matches && invert) || (!matches && !invert)) {
                return { halt: true };
            }
        }
    },

    /** Generically checks if a numerical evaluation matches the required threshold, halting if it fails. */
    CompareValue: (valueFn: Dynamic<number>, operator: '>=' | '<=' | '==' | '>' | '<', compareTo: Dynamic<number>): EffectStep => activationCost((draftState, context) => {
        const val1 = resolveDynamic(valueFn, draftState, context);
        const val2 = resolveDynamic(compareTo, draftState, context);

        let pass = false;
        if (operator === '>=') pass = val1 >= val2;
        else if (operator === '<=') pass = val1 <= val2;
        else if (operator === '>') pass = val1 > val2;
        else if (operator === '<') pass = val1 < val2;
        else pass = val1 === val2;

        if (!pass) return { halt: true };
    })
};

export const Condition = {
    /** Generically checks if a numerical evaluation matches the required threshold. */
    CompareValue: (valueFn: Dynamic<number>, operator: '>=' | '<=' | '==' | '>' | '<', compareTo: Dynamic<number>): ConditionStep => (state, context) => {
        const val1 = resolveDynamic(valueFn, state, context);
        const val2 = resolveDynamic(compareTo, state, context);
        if (operator === '>=') return val1 >= val2;
        if (operator === '<=') return val1 <= val2;
        if (operator === '>') return val1 > val2;
        if (operator === '<') return val1 < val2;
        return val1 === val2;
    },

    /** Checks if a specific attribute exists on any valid Pawn on the provided player scope field. */
    PawnMatchesFilter: (scope: 'active' | 'opponent' | 'both', filter: (zone: PlacedCard) => boolean): ConditionStep => (state, context) => {
        const activeIdx = context.playerIndex;
        const oppIdx = (activeIdx + 1) % 2;

        return state.players.some((player, idx) => {
            if (scope === 'active' && idx !== activeIdx) return false;
            if (scope === 'opponent' && idx !== oppIdx) return false;
            return player.pawnZones.some(z => z !== null && filter(z));
        });
    },

    /** Verifies a specific item exists in a specific player's discard. */
    DiscardMatchesFilter: (scope: 'active' | 'opponent', filter: (card: Card) => boolean): ConditionStep => (state, context) => {
        const pIdx = scope === 'active' ? context.playerIndex : (context.playerIndex + 1) % 2;
        return state.players[pIdx].discard.some(filter);
    },

    /** Checks if a specific Action/Condition is on the board. */
    ActionMatchesFilter: (scope: 'active' | 'opponent' | 'both', filter: (zone: PlacedCard) => boolean): ConditionStep => (state, context) => {
        const activeIdx = context.playerIndex;
        const oppIdx = (activeIdx + 1) % 2;

        return state.players.some((player, idx) => {
            if (scope === 'active' && idx !== activeIdx) return false;
            if (scope === 'opponent' && idx !== oppIdx) return false;
            return player.actionZones.some(z => z !== null && filter(z));
        });
    },

    /** Checks if this specific card instance has activated its effect this turn. */
    SoftOncePerTurn: (): ConditionStep => (state, context) => {
        const p = state.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z?.card.instanceId === context.card.instanceId) || p.actionZones.find(z => z?.card.instanceId === context.card.instanceId);
        return selfZone ? !selfZone.hasActivatedEffect : true;
    },

    /** Checks if any card with this ID has activated its effect this turn globally. */
    HardOncePerTurn: (cardId: string): ConditionStep => (state, context) => {
        return !state.players[context.playerIndex].activatedHardOncePerTurns?.includes(cardId);
    }
};
