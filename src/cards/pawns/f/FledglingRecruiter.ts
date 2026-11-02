import { Attribute, CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'P_Fledgling_Recruiter',
        name: 'Fledgling Recruiter',
        type: CardType.PAWN,
        rarity: 'Rare',
        level: 4,
        attribute: Attribute.NORMAL,
        pawnType: PawnType.BUG,
        atk: 100,
        def: 80,
        effectText: 'When this card is destroyed by battle and sent to the Discard pile: you can Special Summon 1 NORMAL Pawn with 100 or less ATK from your Deck in Attack Position.'
    },
    effect: {
        onBattleDestroyed: buildEffect([
            Effect.SummonFromDeck(card => card.attribute === Attribute.NORMAL && card.atk <= 100, Position.ATTACK)
        ])
    }
}] satisfies CardModule;
