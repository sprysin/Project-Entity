import { IEffect, GameState, CardContext, EffectResult, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onSummon: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));

        if (!context.target) {
            return {
                newState,
                log: "High King: Target an Entity to reduce ATK.",
                requireTarget: 'entity'
            };
        }

        const tP = newState.players[context.target.playerIndex];
        const tE = tP.entityZones[context.target.index];

        if (tE && tE.position !== Position.HIDDEN) {
            tP.entityZones[context.target.index] = {
                ...tE,
                card: { ...tE.card, atk: Math.max(0, tE.card.atk - 20) }
            };
            return {
                newState,
                log: `High King: ${tE.card.name} loses 20 ATK.`
            };
        }

        return {
            newState,
            log: "High King: Invalid target — must be a face-up Entity."
        };
    }
};

cardRegistry.register('entity_02', effect);
