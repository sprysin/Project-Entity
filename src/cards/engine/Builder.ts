import { GameState, CardContext, EffectResult } from '../../types';
import { cloneGameState } from '../../game/cloneState';

export type EffectStepResult = Omit<EffectResult, 'newState' | 'halted'> & { halt?: boolean };
export type EffectStep = ((draftState: GameState, context: CardContext) => EffectStepResult | void) & { activationCost?: boolean; activationReservation?: boolean };
export const activationCost = (step: EffectStep): EffectStep => Object.assign(step, { activationCost: true });
export const activationReservation = (step: EffectStep): EffectStep => Object.assign(step, { activationReservation: true });
export type ConditionStep = (state: GameState, context: CardContext) => boolean;

/** The builder and chain runner suspend for the same set of player choices. */
export function needsChoice(result: Omit<EffectResult, 'newState'>): boolean {
    return !!(result.requireEffectChoice || result.requirePawnPlacement || result.requireTarget || result.requireHandSelection || result.requirePeekSelection || result.requireDiscardSelection || result.requireDeckSelection || result.requireReserveSelection || result.requireLevelTribute || result.requireEffectTribute || result.requireShuffleSelection);
}

export const buildEffect = (steps: EffectStep[]) => {
    const execute = (state: GameState, context: CardContext): EffectResult => {
        context = { ...context };
        const draftState = cloneGameState(state);
        for (const step of steps) {
            if (draftState.winner) break;
            if (context.execution === 'reserve' && !step.activationReservation) continue;
            if (context.execution === 'costs' && !step.activationCost) continue;
            if (context.execution === 'resolve' && (step.activationCost || step.activationReservation)) continue;
            const result = step(draftState, context);
            if (result) {
                if (needsChoice(result)) {
                    return { ...result, newState: draftState };
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

/** Multiple activated effects share one choice request for the UI and AI. */
export const buildEffectChoice = (options: {
    id: string;
    unavailable: (state: GameState, context: CardContext) => boolean;
    execute: ReturnType<typeof buildEffect>;
}[]) => Object.assign((state: GameState, context: CardContext): EffectResult => {
    const selected = options.find(option => option.id === context.effectId);
    if (context.effectId !== undefined) {
        if (!selected || (!context.execution || context.execution === 'reserve') && selected.unavailable(state, context)) {
            return { newState: state, halted: true };
        }
        return selected.execute(state, context);
    }
    const descriptions = context.card.effectText.split(/\s+-\s*/).slice(1);
    const choices = options.map((option, index) => ({
        id: option.id, label: descriptions[index]?.trim() || `Effect ${index + 1}`, disabled: option.unavailable(state, context)
    }));
    return choices.every(choice => choice.disabled) ? { newState: state, halted: true }
        : { newState: state, requireEffectChoice: choices };
}, { staged: true });
