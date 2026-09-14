import { IEffect, Position, CardType, Attribute, PawnType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Require } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Require.Target('pawn'),
        Require.TargetMatchesPosition(Position.HIDDEN, true),
        Effect.ModifyTargetStats(-20, 0)
    ])
};

cardRegistry.register({
    id: 'pawn_02',
    name: 'High King',
    type: CardType.PAWN,
    level: 5,
    attribute: Attribute.NORMAL,
    pawnType: PawnType.WARRIOR,
    atk: 170,
    def: 50,
    effectText: 'ON SUMMON: Target 1 face-up monster on the field; it loses 20 ATK.',
}, effect);
