import { Attribute, CardType, IEffect, PawnType, Phase } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition, Require } from '../../engine/Requirements';

const CARD_ID = 'P_Future_Outlander';

const effect: IEffect = {
    timing: 'quick',
    targetsAtResolution: true,
    onActivate: buildEffect([
        Effect.SetSoftOncePerTurn(CARD_ID, 1),
        Require.Target('pawn', 'both', 'both'),
        Effect.VoidTargetTemporarily(Phase.STANDBY)
    ]),
    canActivate: Condition.SoftOncePerTurn(CARD_ID, 1)
};

export default [{
    cardData: {
        id: CARD_ID,
        name: 'Future Outlander',
        type: CardType.PAWN,
        rarity: 'Mythic',
        level: 8,
        attribute: Attribute.NORMAL,
        pawnType: PawnType.WARRIOR,
        atk: 250,
        def: 200,
        effectText: '(Quick): Once per turn target 1 pawn on the field, send it to the void until the next standby phase. You cannot activate this effect again until the end of the following turn.'
    },
    effect
}] satisfies CardModule;
