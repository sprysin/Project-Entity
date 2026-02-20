import { IEffect } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Effect.DealDamage((state) => (state.activePlayerIndex + 1) % 2, 50, "VOID BLAST:")
    ])
};

cardRegistry.register('action_01', effect);
