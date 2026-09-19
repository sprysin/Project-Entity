import { IEffect, CardType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../engine/Builder';
import { Condition } from '../engine/Requirements';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.SelectDiscardRecovery((c) => c.type === CardType.PAWN && c.level <= 3),
        Effect.RecoverFromDiscardToHand(),
        Effect.RestoreLP((_state, context) => context.playerIndex, 20)
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
