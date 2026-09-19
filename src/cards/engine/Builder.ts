import { GameState, CardContext, EffectResult } from '../../types';
import { cloneGameState } from '../../game/cloneState';

export type EffectStepResult = Omit<EffectResult, 'newState' | 'halted'> & { halt?: boolean };
export type EffectStep = (draftState: GameState, context: CardContext) => EffectStepResult | void;
export type ConditionStep = (state: GameState, context: CardContext) => boolean;

export const buildEffect = (steps: EffectStep[]) => {
    return (state: GameState, context: CardContext): EffectResult => {
        const draftState = cloneGameState(state);
        for (const step of steps) {
            const result = step(draftState, context);
            if (result) {
                if (result.requireTarget || result.requireDiscardSelection || result.requireHandSelection || result.requireDeckSelection || result.requireEffectTribute) {
                    return {
                        newState: draftState,
                        requireTarget: result.requireTarget,
                        requireTargetPosition: result.requireTargetPosition,
                        requireDiscardSelection: result.requireDiscardSelection,
                        requireHandSelection: result.requireHandSelection,
                        requireDeckSelection: result.requireDeckSelection,
                        requireEffectTribute: result.requireEffectTribute
                    };
                }

                if (result.halt) {
                    return {
                        newState: state,
                        halted: true
                    };
                }
            }
        }

        return {
            newState: draftState
        };
    };
};

export const buildCondition = (steps: ConditionStep[]) => {
    return (state: GameState, context: CardContext): boolean => {
        return steps.every(step => step(state, context));
    };
};
