import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../engine/Builder';
import { Condition } from '../engine/Requirements';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Cost.SelectDiscardRecovery((c) => c.id === 'action_01'),
        Effect.RecoverFromDiscardToHand()
    ]),
    canActivate: buildCondition([
        Condition.DiscardMatchesFilter('active', (c) => c.id === 'action_01')
    ])
};

cardRegistry.register({
    id: 'pawn_04',
    name: 'Void Caster',
    type: CardType.PAWN,
    level: 3,
    attribute: Attribute.DARK,
    pawnType: PawnType.MECHANICAL,
    atk: 100,
    def: 80,
    effectText: 'ON SUMMON: Add "Void Blast" from your Discard to your hand.',
}, effect);
