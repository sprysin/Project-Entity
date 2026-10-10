import { IEffect, Position, CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect, buildCondition } from '../../engine/Builder';
import { Require, Condition } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('pawn'),
        Require.TargetMatchesPosition(Position.HIDDEN, true),
        Effect.AttachToTarget(),
        Effect.ModifyTargetStats(20, 0)
    ]),
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('both', (z) => z.position !== Position.HIDDEN)
    ])
};

export default [
{ cardData: {
    id: 'C_Reinforcement',
    name: 'Reinforcement',
    type: CardType.CONDITION,
    rarity: 'Common',
    isAttached: true,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Target 1 Pawn on the field; it gains +20 ATK.',
}, effect }
] satisfies CardModule;
