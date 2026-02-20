import { IEffect } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Condition } from '../libs/Requirements';
import { Cost } from '../libs/Costs';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter("Discard Cost: Select 1 Card"),
        Effect.ModifySelfStats(10, 0),
        Effect.RegisterSelfPendingEffect('RESET_ATK', 250)
    ]),
    canActivate: buildCondition([
        Condition.CompareValue((s, c) => s.players[c.playerIndex].hand.length, '>', 0)
    ])
};

cardRegistry.register('entity_05', effect);
