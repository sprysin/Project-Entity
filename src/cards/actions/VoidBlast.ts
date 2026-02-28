import { IEffect, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Effect.DealDamage((state) => (state.activePlayerIndex + 1) % 2, 50, "VOID BLAST:")
    ])
};

cardRegistry.register({
    id: 'action_01',
    name: 'Void Blast',
    type: CardType.ACTION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Deal 50 damage to your opponent.',
}, effect);
