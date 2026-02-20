import { GameState, CardContext, EffectResult } from '../../../types';

export type EffectStepResult = Omit<EffectResult, 'newState' | 'log'> & { log?: string, halt?: boolean };
export type EffectStep = (draftState: GameState, context: CardContext) => EffectStepResult | void;
export type ConditionStep = (state: GameState, context: CardContext) => boolean;

export const buildEffect = (steps: EffectStep[]) => {
    return (state: GameState, context: CardContext): EffectResult => {
        const draftState = JSON.parse(JSON.stringify(state));
        const logs: string[] = [];

        for (const step of steps) {
            const result = step(draftState, context);
            if (result) {
                if (result.log) logs.push(result.log);

                if (result.requireTarget || result.requireDiscardSelection || result.requireHandSelection) {
                    return {
                        newState: draftState,
                        log: result.log || "",
                        requireTarget: result.requireTarget,
                        requireDiscardSelection: result.requireDiscardSelection,
                        requireHandSelection: result.requireHandSelection
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
