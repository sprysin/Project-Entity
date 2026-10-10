import { IEffect, Position, CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect, buildCondition } from '../../engine/Builder';
import { Require, Condition } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('action', 'hidden'),
        Require.TargetMatchesPosition(Position.HIDDEN),
        Effect.BanishTargetToVoid()
    ]),
    canActivate: buildCondition([
        Condition.ActionMatchesFilter('both', (z) => z.position === Position.HIDDEN)
    ])
};

export default [
{ cardData: {
    id: 'C_Void_Call',
    name: 'Void Call',
    type: CardType.CONDITION,
    rarity: 'Uncommon',
    isLingering: false,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Target 1 Set Action/Condition card; send it to the Void.',
}, effect }
] satisfies CardModule;
