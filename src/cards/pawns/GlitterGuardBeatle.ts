import { Attribute, CardType, IEffect, PawnType, Position } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onDiscard: buildEffect([
        Effect.ChangeAllPawnPositions('active', Position.DEFENSE),
        Effect.ModifyAllPawnStats('active', 0, 200, 'end_of_next_turn')
    ])
};

export default [
{ cardData: {
    id: 'pawn_10',
    name: 'Glitter Guard Beatle',
    type: CardType.PAWN,
    rarity: 'Uncommon',
    level: 5,
    attribute: Attribute.LIGHT,
    pawnType: PawnType.BUG,
    atk: 150,
    def: 150,
    effectText: 'ON DISCARD: Change all Pawns you control to DEF Position, and they gain 200 DEF until the end of the next turn.',
}, effect }
] satisfies CardModule;
