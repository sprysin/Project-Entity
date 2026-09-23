import { Card, GameState } from '../types';

/** Cards keep their original owner even while controlled by the other player. */
export function sendToOwnerPile(state: GameState, card: Card, pile: 'discard' | 'void'): void {
    const owner = state.players.find(player => player.id === card.ownerId);
    if (owner) owner[pile].push(card);
}
