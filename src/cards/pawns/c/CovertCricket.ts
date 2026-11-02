import { Attribute, CardType, PawnType, PawnSubtype } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'P_Covert_Cricket', name: 'Covert Cricket', type: CardType.PAWN,
        pawnType: PawnType.BUG, attribute: Attribute.DARK, pawnSubtype: PawnSubtype.SWITCH,
        level: 2, rarity: 'Uncommon', atk: 80, def: 30,
        effectText: 'SWITCH: Select 1 EARTH or DARK Pawn in your Discard, shuffle it into the deck, then draw 1 card.'
    },
    effect: {
        onSwitch: buildEffect([
            Effect.ShuffleFrom('discard', 1, card => card.type === CardType.PAWN && [Attribute.EARTH, Attribute.DARK].includes(card.attribute)),
            Effect.DrawCards(1)
        ])
    }
}] satisfies CardModule;
