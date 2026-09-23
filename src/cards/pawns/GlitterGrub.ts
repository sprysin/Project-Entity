import { Attribute, CardType, IEffect, PawnSubtype, PawnType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';
import { Condition } from '../engine/Requirements';

const effect: IEffect = {
    canActivate: Condition.HardOncePerTurn('pawn_13'),
    onSwitch: buildEffect([
        Cost.DiscardCardFilter(card => card.type === CardType.PAWN && card.attribute === Attribute.LIGHT),
        Effect.SetHardOncePerTurn('pawn_13'),
        Effect.DrawCards(1)
    ])
};

cardRegistry.register({ id: 'pawn_13', name: 'Glitter Grub', type: CardType.PAWN,
    level: 2, attribute: Attribute.LIGHT, pawnType: PawnType.BUG, pawnSubtype: PawnSubtype.SWITCH,
    atk: 10, def: 120,
    effectText: 'Switch: You can discard 1 Light Pawn to draw 1 card. You can only use this effect of “Glitter Grub” once per turn.'
}, effect);
