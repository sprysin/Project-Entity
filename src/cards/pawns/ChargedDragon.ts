import { IEffect, CardType, Attribute, PawnType } from '../../../types';
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

cardRegistry.register({
    id: 'pawn_05',
    name: 'High Voltage - Charged Dragon',
    type: CardType.PAWN,
    level: 10,
    attribute: Attribute.ELECTRIC,
    pawnType: PawnType.DRAGON,
    atk: 250,
    def: 190,
    effectText: 'ON FIELD: Discard 1 card; this card gains 10 ATK.',
}, effect);
