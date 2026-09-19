import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';
import { Query } from '../engine/Queries';

const effect: IEffect = {
    onSummon: buildEffect([
        Effect.DealDamage(
            Query.ActiveOpponent(),
            Query.Multiply(Query.CountSetActions('opponent'), 10)
        )
    ])
};

cardRegistry.register({
    id: 'pawn_03',
    name: 'Force Fire Sparker',
    type: CardType.PAWN,
    level: 2,
    attribute: Attribute.FIRE,
    pawnType: PawnType.DEMON,
    atk: 30,
    def: 150,
    effectText: 'ON NORMAL SUMMON: Deal 10 damage for each set Action/Condition on opponent\'s field.',
}, effect);
