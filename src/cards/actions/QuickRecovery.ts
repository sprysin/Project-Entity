import { IEffect, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Cost } from '../libs/Costs';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.SelectDiscardRecovery("Select Level 3 or Lower Pawn", (c) => c.type === CardType.PAWN && c.level <= 3),
        Effect.RecoverFromDiscardToHand(),
        Effect.RestoreLP((state) => state.activePlayerIndex, 20)
    ]),
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('opponent', () => true),
        Condition.DiscardMatchesFilter('active', (c) => c.type === CardType.PAWN && c.level <= 3)
    ])
};

cardRegistry.register('action_02', effect);
