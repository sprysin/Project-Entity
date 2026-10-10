import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { opposingPawnInColumn } from '../../../game/cardHelpers';

export default [{
    cardData: {
        id: 'P_Blazing_Pyrotechnic', name: 'Blazing Pyrotechnic', type: CardType.PAWN,
        attribute: Attribute.FIRE, pawnType: PawnType.MECHANICAL, level: 4, atk: 120, def: 100, rarity: 'Common',
        effectText: "ON FIELD: if your opponent has a Pawn in the column across from this card, you can change it's attribute to FIRE."
    },
    effect: {
        canActivate: (state, context) => {
            const opposite = opposingPawnInColumn(state, context);
            return !!opposite && opposite.card.attribute !== Attribute.FIRE;
        },
        onActivate: buildEffect([Effect.ChangePawnAttribute(Attribute.FIRE, opposingPawnInColumn)])
    }
}] satisfies CardModule;
