import { Attribute, CardType, IEffect, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { Condition } from '../../engine/Requirements';

const effect: IEffect = {
    canActivate: Condition.HardOncePerTurn('P_Glitter_Grub'),
    onSwitch: buildEffect([
        Cost.DiscardCardFilter(card => card.type === CardType.PAWN && card.attribute === Attribute.LIGHT),
        Effect.SetHardOncePerTurn('P_Glitter_Grub'),
        Effect.DrawCards(1)
    ])
};

export default [
{ cardData: {
    id: 'P_Glitter_Grub',
    name: 'Glitter Grub',
    type: CardType.PAWN,
    rarity: 'Common',
    level: 2,
    attribute: Attribute.LIGHT,
    pawnType: PawnType.BUG,
    pawnSubtype: PawnSubtype.SWITCH,
    atk: 10,
    def: 120,
    effectText: 'SWITCH: You can discard 1 Light Pawn to draw 1 card. You can only use this effect of “Glitter Grub” once per turn.'
}, effect }
] satisfies CardModule;
