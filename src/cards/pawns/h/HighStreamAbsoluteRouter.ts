import { Attribute, CardType, PawnSubtype, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'P_High_Stream_Absolute_Router',
        name: 'High Stream - Absolute Router',
        type: CardType.PAWN,
        attribute: Attribute.ELECTRIC,
        pawnType: PawnType.MECHANICAL,
        pawnSubtype: PawnSubtype.VASSAL,
        level: 8,
        atk: 220,
        def: 220,
        rarity: 'Rare',
        effectText: 'ON SUMMON: Equip any number of Attach cards on the field to this card.'
    },
    effect: {
        mandatoryReactions: true,
        onSummon: buildEffect([
            Effect.SelectFieldCards({
                filter: zone => !!zone.card.isAttached && zone.position !== Position.HIDDEN
            }),
            Effect.ReattachSelectedToSelf()
        ])
    }
}] satisfies CardModule;
