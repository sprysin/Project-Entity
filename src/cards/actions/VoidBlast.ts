import { IEffect, GameState, CardContext, EffectResult } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onActivate: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));
        const oppIdx = (state.activePlayerIndex + 1) % 2;
        newState.players[oppIdx].lp -= 50;
        return {
            newState,
            log: "VOID BLAST: 50 damage dealt."
        };
    }
};

cardRegistry.register('action_01', effect);
