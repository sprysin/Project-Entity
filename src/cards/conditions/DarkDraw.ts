import { IEffect, Attribute, CardType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../engine/Builder';
import { Require, Condition } from '../engine/Requirements';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';
import { Query } from '../engine/Queries';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.CompareValue((s, c) => s.players[c.playerIndex].lp, '>', 200),
        Cost.PayLP(200),
        Effect.DrawCards(Query.CountPawnAttribute(Attribute.DARK))
    ]),
    canActivate: buildCondition([
        Condition.CompareValue((s, c) => s.players[c.playerIndex].lp, '>', 200),
        Condition.CompareValue(Query.CountPawnAttribute(Attribute.DARK), '>', 0)
    ])
};

cardRegistry.register({
    id: 'condition_03',
    name: 'Dark Draw',
    type: CardType.CONDITION,
    isLingering: false,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Pay 200 life points, draw 1 card for every face up DARK Pawn on the field.',
}, effect);
