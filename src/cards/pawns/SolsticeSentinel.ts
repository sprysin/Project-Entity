import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Effect.RestoreLP((_state, context) => context.playerIndex, 100)
    ])
};

cardRegistry.register({
    id: 'pawn_01',
    name: 'Solstice Sentinel',
    type: CardType.PAWN,
    level: 4,
    attribute: Attribute.LIGHT,
    pawnType: PawnType.MECHANICAL,
    atk: 120,
    def: 110,
    effectText: 'On normal summon: Gain 100 LP.',
}, effect);
