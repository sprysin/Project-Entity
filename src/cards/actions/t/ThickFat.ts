import { CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildCondition, buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { canTargetWithEffect } from '../../../game/cardHelpers';

export default [{
    cardData: {
        id: 'A_Thick_Fat', name: 'Thick Fat', type: CardType.ACTION, rarity: 'Uncommon', isAttached: true,
        level: 0, atk: 0, def: 0,
        effectText: 'Attach to 1 face-up Beast Pawn on the field; it gains 50 DEF, then if it is in Attack Position, switch it to Defense Position. Only the attached Pawn can be targeted for an attack during the Battle Phase.'
    },
    effect: {
        restrictsAttackTargetsToAttached: true,
        canActivate: buildCondition([
            Condition.PawnMatchesFilter('both', zone => zone.position !== Position.HIDDEN && zone.card.pawnType === PawnType.BEAST && canTargetWithEffect(zone.card))
        ]),
        onActivate: buildEffect([
            Require.Target('pawn', 'faceup', 'both', 0, card => card.pawnType === PawnType.BEAST),
            Effect.AttachToTarget(),
            Effect.ModifyTargetStats(0, 50),
            Effect.ChangeTargetPosition(Position.DEFENSE)
        ])
    }
}] satisfies CardModule;
