import { IEffect, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('action', "VOID CALL: Target a set Action/Condition."),
        Require.TargetMatchesPosition(Position.HIDDEN, false, "VOID CALL: Invalid target (Must be Set Action/Condition Card)."),
        Effect.BanishTargetToVoid()
    ]),
    canActivate: buildCondition([
        Condition.ActionMatchesFilter('both', (z) => z.position === Position.HIDDEN)
    ])
};

cardRegistry.register('condition_02', effect);
