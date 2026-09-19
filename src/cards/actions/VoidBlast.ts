import { IEffect, CardType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Effect.DealDamage((_state, context) => (context.playerIndex + 1) % 2, 50)
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
