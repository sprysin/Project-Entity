import { IEffect, Position, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('pawn'),
        Require.TargetMatchesPosition(Position.HIDDEN, true),
        Effect.ModifyTargetStats(20, 0)
    ]),
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('both', (z) => z.position !== Position.HIDDEN)
    ])
};

cardRegistry.register({
    id: 'condition_01',
    name: 'Reinforcement',
    type: CardType.CONDITION,
    isLingering: true,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Target Pawn gains +20 ATK.',
}, effect);
