import { IEffect } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Effect.RestoreLP((state) => state.activePlayerIndex, 100)
    ])
};

cardRegistry.register('pawn_01', effect);
