import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{ cardData: {
    id: 'P_Gelorex_The_Stomper', name: 'Gelorex the Stomper', type: CardType.PAWN,
    pawnType: PawnType.PRIMAL, level: 9, attribute: Attribute.EARTH, atk: 260, def: 200, rarity: 'Legendary',
    effectText: 'When this card destroys an opponent’s Pawn by battle, send the top 2 cards of their Deck to the Discard. If 2 Pawns were sent to the Discard by this effect, this card can attack an additional Pawn this turn.'
}, effect: {
    onBattleDestroy: buildEffect([
        Effect.MillDeck(2, (_state, context) => 1 - context.playerIndex,
            cards => cards.length === 2 && cards.every(card => card.type === CardType.PAWN) ? Effect.GrantSelfAttacks(1, true) : () => {})
    ])
} }] satisfies CardModule;
