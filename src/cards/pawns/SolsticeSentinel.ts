import { IEffect, GameState, CardContext, EffectResult } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onSummon: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));
        newState.players[state.activePlayerIndex].lp += 100;
        return {
            newState,
            log: "SOLSTICE SENTINEL: +100 LP."
        };
    }
};

cardRegistry.register('entity_01', effect);
