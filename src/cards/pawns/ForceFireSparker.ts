import { IEffect, GameState, CardContext, EffectResult, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onSummon: (state: GameState, context: CardContext): EffectResult => {
        const newState = JSON.parse(JSON.stringify(state));
        const sparkerOppIdx = (state.activePlayerIndex + 1) % 2;
        const sparkerOpp = newState.players[sparkerOppIdx];
        const setCardCount = sparkerOpp.actionZones.filter((z: any) => z && z.position === Position.HIDDEN).length;
        console.log('ForceFireSparker Debug:', { sparkerOppIdx, setCardCount, zones: sparkerOpp.actionZones });
        const damage = setCardCount * 10;

        if (damage > 0) {
            newState.players[sparkerOppIdx] = {
                ...sparkerOpp,
                lp: sparkerOpp.lp - damage
            };
            return {
                newState,
                log: `FORCE FIRE SPARKER: ${damage} damage dealt (${setCardCount} set cards).`
            };
        } else {
            return {
                newState,
                log: "FORCE FIRE SPARKER: No set cards found. 0 Damage."
            };
        }
    }
};

cardRegistry.register('entity_03', effect);
