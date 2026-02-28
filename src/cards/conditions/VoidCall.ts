import { IEffect, Position, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('action', "VOID CALL: Target a set Action/Condition.", 'hidden'),
        Require.TargetMatchesPosition(Position.HIDDEN, false, "VOID CALL: Invalid target (Must be Set Action/Condition Card)."),
        Effect.BanishTargetToVoid()
    ]),
    canActivate: buildCondition([
        Condition.ActionMatchesFilter('both', (z) => z.position === Position.HIDDEN)
    ])
};

cardRegistry.register({
    id: 'condition_02',
    name: 'Void Call',
    type: CardType.CONDITION,
    isLingering: false,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Target 1 Set Action/Condition card; send it to the Void.',
}, effect);
