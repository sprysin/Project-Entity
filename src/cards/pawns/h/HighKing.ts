import { IEffect, Position, CardType, Attribute, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Require.Target('pawn'),
        Require.TargetMatchesPosition(Position.HIDDEN, true),
        Effect.ModifyTargetStats(-20, 0)
    ])
};

export default [
    {
        cardData: {
            id: 'P_High_King',
            name: 'High King',
            type: CardType.PAWN,
            rarity: 'Uncommon',
            level: 5,
            attribute: Attribute.NORMAL,
            pawnType: PawnType.WARRIOR,
            atk: 170,
            def: 50,
            effectText: 'TRIBUTE SUMMON: Target 1 face-up Pawn on the field; it loses 20 ATK.',
        }, effect
    }
] satisfies CardModule;
