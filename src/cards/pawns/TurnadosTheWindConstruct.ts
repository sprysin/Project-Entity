import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Require } from '../engine/Requirements';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Cost.ShuffleFrom('discard', 1, false, card => card.type === CardType.PAWN && card.attribute === Attribute.AIR),
        Require.Target('action', 'both', 'opponent'),
        Effect.DestroyTarget()
    ]),
    canActivate: (state, context) => state.players[context.playerIndex].discard.some(card => card.type === CardType.PAWN && card.attribute === Attribute.AIR)
        && state.players[1 - context.playerIndex].actionZones.some(Boolean)
};

cardRegistry.register({
    id: 'pawn_15',
    name: 'Turnados The Wind Construct',
    type: CardType.PAWN,
    level: 7,
    attribute: Attribute.AIR,
    pawnType: PawnType.ELEMENTAL,
    atk: 180,
    def: 100,
    effectText: 'ON SUMMON: You can shuffle an Air Pawn into the deck from your Discard Pile, target 1 Action/Condition on your opponents field; destroy it.',
}, effect);
