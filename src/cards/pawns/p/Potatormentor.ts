import { Attribute, CardType, PawnType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'P_Potatormentor', name: 'Potatormentor', type: CardType.PAWN, attribute: Attribute.EARTH, pawnType: PawnType.PLANT,
        level: 1, atk: 30, def: 30, rarity: 'Common',
        effectText: 'Discard 1 card; target 1 face-up Primal or Plant Pawn your opponent controls. Its ATK becomes 50 until the end of this turn.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].hand.length > 0
            && state.players[1 - context.playerIndex].pawnZones.some(zone => zone && zone.position !== Position.HIDDEN && [PawnType.PLANT, PawnType.PRIMAL].includes(zone.card.pawnType!)),
        onActivate: buildEffect([Cost.DiscardCardFilter(),
        Require.Target('pawn', 'faceup', 'opponent', 0, card => card.pawnType === PawnType.PRIMAL || card.pawnType === PawnType.PLANT),
        Effect.SetTargetAttack(50)]) }
}] satisfies CardModule;

