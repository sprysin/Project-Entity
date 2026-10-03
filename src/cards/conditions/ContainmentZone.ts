import { IEffect, Position, CardType } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect, buildCondition } from '../engine/Builder';
import { Require, Condition } from '../engine/Requirements';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([

    ]),
    canActivate: buildCondition([

    ])
};

export default [
    {
        cardData: {
            id: 'condition_09',
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
