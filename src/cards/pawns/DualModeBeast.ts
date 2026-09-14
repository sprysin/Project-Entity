import { IEffect, Position, CardType, Attribute, PawnType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Cost } from '../libs/Costs';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter(),
        Require.Target('pawn'),
        Require.TargetIsPlayerScope('opponent'),
        Require.TargetMatchesPosition(Position.ATTACK),
        Effect.ChangeTargetPosition(Position.DEFENSE)
    ]),
    canActivate: buildCondition([
        Condition.CompareValue((s, c) => s.players[c.playerIndex].hand.length, '>', 0),
        Condition.PawnMatchesFilter('opponent', (z) => z.position === Position.ATTACK)
    ])
};

cardRegistry.register({
    id: 'pawn_06',
    name: 'Dual-Mode Beast',
    type: CardType.PAWN,
    level: 9,
    attribute: Attribute.DARK,
    pawnType: PawnType.BEAST,
    atk: 240,
    def: 170,
    effectText: 'Discard 1 card; Target 1 attack position monster on your opponents field, switch it to defense position.',
}, effect);
