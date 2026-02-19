import { IEffect, GameState, CardContext, EffectResult } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onSummon: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));
        const vcPlayer = newState.players[state.activePlayerIndex];
        const vbIndex = vcPlayer.discard.findIndex((c: any) => c.id === 'action_01');

        if (vbIndex !== -1) {
            const recoveredCard = vcPlayer.discard[vbIndex];
            const newDiscard = [...vcPlayer.discard];
            newDiscard.splice(vbIndex, 1);

            newState.players[state.activePlayerIndex] = {
                ...vcPlayer,
                hand: [...vcPlayer.hand, recoveredCard],
                discard: newDiscard
            };
            return {
                newState,
                log: "VOID CASTER: Retrieved 'Void Blast' from Discard."
            };
        } else {
            return {
                newState,
                log: "VOID CASTER: 'Void Blast' not found in Discard."
            };
        }
    },
    canActivate: (state: GameState, context: CardContext): boolean => {
        // Logic for Void Caster activation check (if needed, though it's onSummon)
        return state.players[context.playerIndex].discard.some(c => c.id === 'action_01');
    }
};

cardRegistry.register('entity_04', effect);
