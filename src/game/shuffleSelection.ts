import { Card, GameState, ShuffleLocation } from '../types';

/** Stable indices for selecting cost cards from a player's hand, field, or discard pile. */
export function shuffleCandidates(state: GameState, playerIndex: number, location: ShuffleLocation): { card: Card; index: number }[] {
    const player = state.players[playerIndex];
    if (location === 'hand') return player.hand.map((card, index) => ({ card, index }));
    if (location === 'discard') return player.discard.map((card, index) => ({ card, index }));
    return [...player.pawnZones, ...player.actionZones].flatMap((zone, index) => zone ? [{ card: zone.card, index }] : []);
}
