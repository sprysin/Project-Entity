import { IEffect } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Condition } from '../libs/Requirements';
import { Cost } from '../libs/Costs';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Cost.SelectDiscardRecovery("VOID CASTER: Recover Void Blast", (c) => c.id === 'action_01'),
        Effect.RecoverFromDiscardToHand()
    ]),
    canActivate: buildCondition([
        Condition.DiscardMatchesFilter('active', (c) => c.id === 'action_01')
    ])
};

cardRegistry.register('entity_04', effect);
