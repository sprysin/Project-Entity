import { Attribute, CardType, IEffect, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition } from '../../engine/Requirements';

const CARD_ID = 'P_Everlasting_Dragonlord';

const effect: IEffect = {
    timing: 'quick',
    onActivate: buildEffect([
        Effect.SetSoftOncePerTurn(CARD_ID, 1),
        Effect.RestrictForTurn('effectTargetBlockedThisTurn')
    ]),
    canActivate: Condition.SoftOncePerTurn(CARD_ID, 1),

};

export default [{
    cardData: {
        id: CARD_ID,
        name: 'Everlasting Dragonlord',
        type: CardType.PAWN,
        rarity: 'Relic',
        level: 9,
        attribute: Attribute.DARK,
        pawnType: PawnType.DRAGON,
        atk: 300,
        def: 200,
        effectText: '(Quick): This card cannot be targeted with effects for the rest of this turn. You cannot activate this effect again until the end of the following turn.'
    },
    effect
}] satisfies CardModule;
