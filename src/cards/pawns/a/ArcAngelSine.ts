import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Condition } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'P_Arc_Angel_Sine',
        name: 'Arc Angel - Sine',
        type: CardType.PAWN,
        attribute: Attribute.LIGHT,
        pawnType: PawnType.ANGEL,
        level: 3,
        atk: 0,
        def: 100,
        rarity: 'Common',
        effectText: "Once per turn: switch this card's battle position."
    },
    effect: {
        canActivate: Condition.SoftOncePerTurn(),
        onActivate: buildEffect([Effect.SetSoftOncePerTurn(), Effect.ChangeSelfPosition('toggle')])
    }
}] satisfies CardModule;
