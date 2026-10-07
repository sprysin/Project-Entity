import { Attribute, CardType, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'token_bubble',
        name: 'Bubble',
        type: CardType.PAWN,
        pawnSubtype: PawnSubtype.TOKEN,
        attribute: Attribute.WATER,
        pawnType: PawnType.ELEMENTAL,
        level: 1,
        atk: 0,
        def: 0,
        rarity: 'Common',
        effectText: ''
    }, effect: {}
}, {
    cardData: {
        id: 'pawn_the_humble_bubble_paladin',
        name: 'The Humble Bubble Paladin',
        type: CardType.PAWN,
        attribute: Attribute.WATER,
        pawnType: PawnType.WARRIOR,
        level: 6,
        atk: 180,
        def: 180,
        rarity: 'Uncommon',
        effectText: 'If this card is sent to the Discard; Summon 2 "Bubble" tokens (Elemental/WATER/Level 1/ATK 0/DEF 0). Pawns this card battles cannot be destroyed by battle.'
    },
    effect: {
        preventsBattleDestructionOfOpponent: true,
        mandatoryReactions: true,
        onSentToDiscard: buildEffect([Effect.SummonToken('token_bubble', 2)])
    }
}] satisfies CardModule;
