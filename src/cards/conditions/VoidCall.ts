import { IEffect, GameState, CardContext, EffectResult, Position, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));

        if (!context.target) {
            return {
                newState,
                log: "VOID CALL: Target a set Action/Condition.",
                requireTarget: 'action'
            };
        }

        const vcP = newState.players[context.target.playerIndex];
        const vcC = vcP.actionZones[context.target.index];

        if (vcC && vcC.position === Position.HIDDEN) {
            const newVoid = [...vcP.void, vcC.card];
            const newActions = [...vcP.actionZones];
            newActions[context.target.index] = null;
            newState.players[context.target.playerIndex] = {
                ...vcP,
                void: newVoid,
                actionZones: newActions
            };
            return {
                newState,
                log: "VOID CALL: Card banished to Void."
            };
        } else {
            return {
                newState,
                log: "VOID CALL: Invalid target (Must be Set Action/Condition Card).",
                requireTarget: 'action'
            };
        }
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        // Logic for Void Call: Needs a set Action/Condition target
        return state.players.some(p => p.actionZones.some(z => z !== null && z.position === Position.HIDDEN));
    }
};

cardRegistry.register('condition_02', effect);
