import { IEffect, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Cost } from '../libs/Costs';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter("Discard Cost: Select 1 Card"),
        Require.Target('pawn', "DUAL-MODE BEAST: Target 1 attack position monster on your opponent's field."),
        Require.TargetIsPlayerScope('opponent', "DUAL-MODE BEAST: Must target an opponent's monster."),
        Require.TargetMatchesPosition(Position.ATTACK, false, "DUAL-MODE BEAST: Target must be in Attack position."),
        Effect.ChangeTargetPosition(Position.DEFENSE)
    ]),
    canActivate: buildCondition([
        Condition.CompareValue((s, c) => s.players[c.playerIndex].hand.length, '>', 0),
        Condition.PawnMatchesFilter('opponent', (z) => z.position === Position.ATTACK)
    ])
};

cardRegistry.register('pawn_06', effect);
