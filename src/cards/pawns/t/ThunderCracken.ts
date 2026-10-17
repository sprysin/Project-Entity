import { Attribute, CardType, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Query } from '../../engine/Queries';

export default [{
    cardData: {
        id: 'P_Thunder_Cracken',
        name: 'Thunder Cracken',
        type: CardType.PAWN,
        attribute: Attribute.ELECTRIC,
        pawnType: PawnType.AQUATIC,
        pawnSubtype: PawnSubtype.VASSAL,
        level: 7,
        atk: 210,
        def: 190,
        rarity: 'Legendary',
        effectText: 'ON SUMMON: Destroy Action/Condition cards on the field equal to the number of ELECTRIC Pawns you control. This card gains 10 ATK for every other ELECTRIC Pawn on the field.'
    },
    effect: {
        mandatoryReactions: true,
        onSummon: buildEffect([
            Effect.SelectFieldCards({
                count: Query.CountPawnAttribute(Attribute.ELECTRIC, 'active'),
                filter: zone => zone.card.type !== CardType.PAWN
            }),
            Effect.DestroySelectedFieldCards()
        ]),
        fieldStatModifier: (state, context) => ({ atk: Query.CountPawnAttribute(Attribute.ELECTRIC, 'both', true)(state, context) * 10 })
    }
}] satisfies CardModule;
