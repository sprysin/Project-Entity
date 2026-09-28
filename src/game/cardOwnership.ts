import { Card, GameState } from '../types';
import { clearFieldReduction, isToken } from './cardHelpers';

/** Cards keep their original owner even while controlled by the other player. */
export function sendToOwnerPile(state: GameState, card: Card, pile: 'discard' | 'void' | 'hand' | 'deck'): void {
    if (isToken(card)) return;
    const owner = state.players.find(player => player.id === card.ownerId);
    if (owner) owner[pile].push(clearFieldReduction(card));
}
