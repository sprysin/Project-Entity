import { isGeneratedCard, isReservePawn, shuffleDeck } from './game/cardHelpers';
import { Card } from './types';
import { cardRegistry } from './cards/CardRegistry';

export const createDeck = (playerId: string): Card[] => {
  const deck: Card[] = [];
  const baseCards = cardRegistry.getAllCards().filter(card => !isGeneratedCard(card) && !isReservePawn(card));
  if (baseCards.length === 0) return deck;

  const cardCounts: Record<string, number> = {};
  const enforceLimit = baseCards.length * 3 >= 40;

  while (deck.length < 40) {
    const randomIndex = Math.floor(Math.random() * baseCards.length);
    const base = baseCards[randomIndex];

    // Limit to 3 copies per card to make it feel like a real deck (if possible)
    if (!enforceLimit || (cardCounts[base.id] || 0) < 3) {
      deck.push({ ...base, instanceId: `${playerId}_${deck.length}_${Math.random().toString(36).substring(2, 11)}`, ownerId: playerId });
      cardCounts[base.id] = (cardCounts[base.id] || 0) + 1;
    }
  }
  shuffleDeck(deck);
  return deck;
};

/** Random playtests include Reserve Pawns without putting them in the draw deck. */
export const createReserve = (playerId: string): Card[] => cardRegistry.getAllCards().filter(isReservePawn).slice(0, 10)
  .map(card => ({ ...card, ownerId: playerId, instanceId: `${playerId}_reserve_${crypto.randomUUID()}` }));
