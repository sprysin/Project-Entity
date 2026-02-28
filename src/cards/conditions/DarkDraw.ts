import { IEffect, Attribute, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Require, Condition } from '../libs/Requirements';
import { Cost } from '../libs/Costs';
import { Effect } from '../libs/Effects';
import { Query } from '../libs/Queries';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.CompareValue((s, c) => s.players[c.playerIndex].lp, '>', 200),
        Cost.PayLP(200),
        Effect.DrawCards(Query.CountPawnAttribute(Attribute.DARK))
    ]),
    canActivate: buildCondition([
        Condition.CompareValue((s, c) => s.players[c.playerIndex].lp, '>', 200)
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
    effectText: 'Pay 200 life points, draw 1 card for every face up DARK monster on the field.',
}, effect);
