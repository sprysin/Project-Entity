import { IEffect, CardType, Attribute, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect, buildCondition } from '../../engine/Builder';
import { Condition } from '../../engine/Requirements';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter(),
        Effect.ModifySelfStats(10, 0),
        Effect.RegisterSelfPendingEffect('RESET_ATK', 250, 0, 10)
    ]),
    canActivate: buildCondition([
        Condition.CompareValue((s, c) => s.players[c.playerIndex].hand.length, '>', 0)
    ])
};

export default [
{ cardData: {
    id: 'P_High_Voltage_Charged_Dragon',
    name: 'High Voltage - Charged Dragon',
    type: CardType.PAWN,
    rarity: 'Legendary',
    level: 10,
    attribute: Attribute.ELECTRIC,
    pawnType: PawnType.DRAGON,
    atk: 250,
    def: 190,
    effectText: 'ON FIELD: Discard 1 card; this card gains 10 ATK.',
}, effect }
] satisfies CardModule;
