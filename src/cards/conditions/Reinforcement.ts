import { IEffect, GameState, CardContext, EffectResult, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));

        if (!context.target) {
            return {
                newState,
                log: "REINFORCEMENT: Target an Entity.",
                requireTarget: 'entity'
            };
        }

        const reP = newState.players[context.target.playerIndex];
        const reE = reP.entityZones[context.target.index];

        if (reE && reE.position !== Position.HIDDEN) {
            const poweredCard = { ...reE.card, atk: reE.card.atk + 20 };
            const newZones = [...reP.entityZones];
            newZones[context.target.index] = { ...reE, card: poweredCard };

            newState.players[context.target.playerIndex] = {
                ...reP,
                entityZones: newZones
            };
            return {
                newState,
                log: `REINFORCEMENT: ${reE.card.name} gains 20 ATK.`
            };
        } else {
            return {
                newState,
                log: "REINFORCEMENT: Invalid target.",
                requireTarget: 'entity'
            };
        }
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        return state.players.some(p => p.entityZones.some(z => z !== null && z.position !== Position.HIDDEN));
    }
};

cardRegistry.register('condition_01', effect);
