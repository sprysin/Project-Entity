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

cardRegistry.register({
    id: 'action_02',
    name: 'Quick recovery',
    type: CardType.ACTION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'If opponent has Pawn: Return Lv 3 or lower Pawn from Discard to hand, gain 20 LP.',
}, effect);
