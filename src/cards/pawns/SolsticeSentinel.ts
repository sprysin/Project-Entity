import { IEffect, CardType, Attribute, PawnType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Effect.RestoreLP((state) => state.activePlayerIndex, 100)
    ])
};

cardRegistry.register({
    id: 'pawn_01',
    name: 'Solstice Sentinel',
    type: CardType.PAWN,
    level: 4,
    attribute: Attribute.LIGHT,
    pawnType: PawnType.MECHANICAL,
    atk: 140,
    def: 110,
    effectText: 'ON NORMAL SUMMON: Gain 100 LP.',
}, effect);
