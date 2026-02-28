import { Card } from './types';
import { cardRegistry } from './src/cards/CardRegistry';

export const createDeck = (playerId: string): Card[] => {
  const deck: Card[] = [];
  const baseCards = cardRegistry.getAllCards();
  for (let i = 0; i < 40; i++) {
    const base = baseCards[i % baseCards.length];
    deck.push({ ...base, instanceId: `${playerId}_${i}_${Math.random()}`, ownerId: playerId });
  }
  return deck.sort(() => Math.random() - 0.5);
};