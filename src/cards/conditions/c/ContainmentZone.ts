import { IEffect, CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('pawn'),
        Effect.AttachToTarget(),
        Effect.RestrictForTurn('tributeBlockedThisTurn', 0)
    ])
};

export default [
    {
        cardData: {
            id: 'C_Containment_Zone',
            name: 'Containment Zone',
            type: CardType.CONDITION,
            rarity: 'Rare',
            isAttached: true,
            level: 0,
            atk: 0,
            def: 0,
            effectText: 'Target 1 Pawn on the field, it cannot be tributed this turn.',
        }, effect
    }
] satisfies CardModule;
