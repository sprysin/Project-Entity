import { IEffect, CardType, Attribute, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect, buildCondition } from '../../engine/Builder';
import { Condition } from '../../engine/Requirements';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Cost.SelectDiscardRecovery((c) => c.id === 'A_Void_Blast'),
        Effect.RecoverFromDiscardToHand()
    ]),
    canActivate: buildCondition([
        Condition.DiscardMatchesFilter('active', (c) => c.id === 'A_Void_Blast')
    ])
};

export default [
{ cardData: {
    id: 'P_Void_Caster',
    name: 'Void Caster',
    type: CardType.PAWN,
    rarity: 'Uncommon',
    level: 3,
    attribute: Attribute.DARK,
    pawnType: PawnType.MECHANICAL,
    atk: 100,
    def: 80,
    effectText: 'ON SUMMON: Add "Void Blast" from your Discard to your hand.',
}, effect }
] satisfies CardModule;
