import { ActionSubtype, Attribute, CardType, Phase } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Require } from '../../engine/Requirements';

const standby = buildEffect([Require.Target('pawn', 'both', 'active'), Effect.ReturnTargetToHand()]);

export default [{ cardData: {
    id: 'A_Windy_Peaks', name: 'Windy Peaks', type: CardType.ACTION,
    actionSubtype: ActionSubtype.LAND, rarity: 'Rare', level: 0, atk: 0, def: 0,
    effectText: 'During the players standby phase, target 1 pawn you control; send it to the hand. AIR pawns gain 20 ATK during the battle phase.'
}, effect: {
    targetsAtResolution: true,
    LingeringStatModifier: (state, _context, target) => ({
        atk: state.currentPhase === Phase.BATTLE && target.card.attribute === Attribute.AIR ? 20 : 0
    }),
    onPhaseChange: Object.assign((state: Parameters<typeof standby>[0], context: Parameters<typeof standby>[1]) => state.currentPhase === Phase.STANDBY
        && state.players[state.activePlayerIndex].pawnZones.some(Boolean)
        ? standby(state, { ...context, playerIndex: state.activePlayerIndex }) : { newState: state, halted: true }, { staged: true })
} }] satisfies CardModule;
