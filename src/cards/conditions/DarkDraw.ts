import { IEffect, Attribute } from '../../../types';
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

cardRegistry.register('condition_03', effect);
