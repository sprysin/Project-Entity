import { Attribute, CardType, IEffect, PawnType, Position } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onBattleDestroyed: buildEffect([
        Effect.SpecialSummonFromDeck(card => card.attribute === Attribute.EARTH && card.atk <= 100, Position.ATTACK)
    ])
};

export default [{
    cardData: {
        id: 'pawn_cockroach_knight', name: 'Cockroach Knight', type: CardType.PAWN, rarity: 'Rare',
        level: 4, attribute: Attribute.EARTH, pawnType: PawnType.BUG, atk: 100, def: 80,
        effectText: 'When this card is destroyed by battle and sent to the Discard pile: you can Special Summon 1 EARTH Pawn with 100 or less ATK from your Deck in Attack Position.'
    },
    effect
}] satisfies CardModule;
