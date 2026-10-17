import { Attribute, CardType, PawnSubtype, PawnType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'P_Eggolem', name: 'Eggolem', type: CardType.PAWN, pawnSubtype: PawnSubtype.SWITCH, attribute: Attribute.EARTH, pawnType: PawnType.PRIMAL,
        level: 8, atk: 150, def: 210, rarity: 'Rare',
        effectText: 'SWITCH: Target 1 face-up Pawn your opponent controls; it becomes Primal until the end of your next turn.'
    },
    effect: { mandatoryReactions: true, onSwitch: buildEffect([Require.Target('pawn', 'faceup', 'opponent'),
        Effect.ChangeTargetPawnType(PawnType.PRIMAL, 'end_of_your_next_turn')]) }
}] satisfies CardModule;

