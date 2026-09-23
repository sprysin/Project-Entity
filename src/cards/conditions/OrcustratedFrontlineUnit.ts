import { IEffect, CardType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';

const effect: IEffect = {
    onActivate: buildEffect([
        // Revealing the lingering Condition arms its summon trigger.
    ])
};

cardRegistry.register({
    id: 'condition_06',
    name: 'Orcustrated Frontline Unit',
    type: CardType.CONDITION,
    isLingering: true,
    level: 0,
    atk: 0,
    def: 0,
    // Note a special summon that doesnt denote the position means the player chooses whether it goes to face up attack or face up defense
    effectText: 'Whenever your opponent tribute summons a Pawn, special summon 1 level 4 or lower Light Attribute Pawn from your hand. ',
}, effect);
