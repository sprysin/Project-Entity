import { IEffect, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('entity', "REINFORCEMENT: Target an Entity."),
        Require.TargetMatchesPosition(Position.HIDDEN, true, "REINFORCEMENT: Invalid target."),
        Effect.ModifyTargetStats(20, 0)
    ]),
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('both', (z) => z.position !== Position.HIDDEN)
    ])
};

cardRegistry.register('condition_01', effect);
