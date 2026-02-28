import { IEffect, CardType, Attribute, PawnType } from '../../../types';
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

cardRegistry.register({
    id: 'pawn_04',
    name: 'Void Caster',
    type: CardType.PAWN,
    level: 3,
    attribute: Attribute.DARK,
    pawnType: PawnType.MAGICIAN,
    atk: 100,
    def: 80,
    effectText: 'ON SUMMON: Add "Void Blast" from your Discard to your hand.',
}, effect);
