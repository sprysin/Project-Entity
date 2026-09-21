import { GameState } from '../types';

/** Drawing the last card is safe; attempting the next required draw loses immediately. */
export function drawCards(state: GameState, playerIndex: number, count: number): GameState {
    if (state.winner || count <= 0) return state;
    const next = structuredClone(state);
    const player = next.players[playerIndex];
    for (let i = 0; i < count; i++) {
        const card = player.deck.shift();
        if (!card) {
            next.winner = next.players[1 - playerIndex].name;
            next.resultReason = 'empty_deck';
            next.log = [`${player.name} could not draw from an empty deck and loses.`, ...next.log].slice(0, 50);
            break;
        }
        player.hand.push(card);
    }
    return next;
}
