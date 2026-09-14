import { GameState, CardContext, EffectResult } from '../../../types';
import { cloneGameState } from '../../game/cloneState';

export type EffectStepResult = Omit<EffectResult, 'newState' | 'log'> & { log?: string, halt?: boolean };
export type EffectStep = (draftState: GameState, context: CardContext) => EffectStepResult | void;
export type ConditionStep = (state: GameState, context: CardContext) => boolean;

export const buildEffect = (steps: EffectStep[]) => {
    return (state: GameState, context: CardContext): EffectResult => {
        const draftState = cloneGameState(state);
        const logs: string[] = [];

        for (const step of steps) {
            const result = step(draftState, context);
            if (result) {
                if (result.log) logs.push(result.log);

                if (result.requireTarget || result.requireDiscardSelection || result.requireHandSelection || result.requireDeckSelection || result.requireEffectTribute) {
                    return {
                        newState: draftState,
                        log: result.log || "",
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
                        newState: draftState,
                        log: logs.join(" ")
                    };
                }
            }
        }

        return {
            newState: draftState,
            log: logs.join(" ")
        };
    };
};

export const buildCondition = (steps: ConditionStep[]) => {
    return (state: GameState, context: CardContext): boolean => {
        return steps.every(step => step(state, context));
    };
};
