import { GameState, CardContext, EffectResult } from '../../types';
import { cloneGameState } from '../../game/cloneState';

export type EffectStepResult = Omit<EffectResult, 'newState' | 'halted'> & { halt?: boolean };
export type EffectStep = ((draftState: GameState, context: CardContext) => EffectStepResult | void) & { activationCost?: boolean };
export const activationCost = (step: EffectStep): EffectStep => Object.assign(step, { activationCost: true });
export type ConditionStep = (state: GameState, context: CardContext) => boolean;

export const buildEffect = (steps: EffectStep[]) => {
    const execute = (state: GameState, context: CardContext): EffectResult => {
        context = { ...context };
        const draftState = cloneGameState(state);
        for (const step of steps) {
            if (draftState.winner) break;
            if (context.execution === 'costs' && !step.activationCost) continue;
            if (context.execution === 'resolve' && step.activationCost) continue;
            const result = step(draftState, context);
            if (result) {
                if (result.requireTarget || result.requireDiscardSelection || result.requireHandSelection || result.requirePeekSelection || result.requireDeckSelection || result.requireEffectTribute) {
                    return {
                        newState: draftState,
                        requireTarget: result.requireTarget,
                        requireTargetPosition: result.requireTargetPosition,
                        requireTargetScope: result.requireTargetScope,
                        requireTargetIndex: result.requireTargetIndex,
                        requireDiscardSelection: result.requireDiscardSelection,
                        requireHandSelection: result.requireHandSelection,
                        requirePeekSelection: result.requirePeekSelection,
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
    return Object.assign(execute, { staged: true });
};

export const buildCondition = (steps: ConditionStep[]) => {
    return (state: GameState, context: CardContext): boolean => {
        return steps.every(step => step(state, context));
    };
};
