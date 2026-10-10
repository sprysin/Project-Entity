import { GameState } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { isBomb } from './cardHelpers';
import { checkVictory } from './finishEffect';

/** Drawing the last card is safe; attempting the next required draw loses immediately. */
export function drawCards(state: GameState, playerIndex: number, count: number): GameState {
    if (state.winner || count <= 0) return state;
    let next = structuredClone(state);
    for (let i = 0; i < count; i++) {
        const player = next.players[playerIndex];
        const card = player.deck.shift();
        if (!card) {
            next.winner = next.players[1 - playerIndex].name;
            next.resultReason = 'empty_deck';
            next.log = [`${player.name} could not draw from an empty deck and loses.`, ...next.log].slice(0, 50);
            break;
        }
        if (isBomb(card)) {
            next.destroyedCardIds = [...(next.destroyedCardIds ?? []), card.instanceId];
            next.drawnBombs = [...(next.drawnBombs ?? []), { card, playerIndex }];
            next.log = [`${player.name} drew and revealed "${card.name}"; the Bomb is destroyed.`, ...next.log].slice(0, 50);
        } else player.hand.push(card);
        const effect = cardRegistry.getEffect(card.id)?.onDraw;
        if (effect) next = effect(next, { card, playerIndex }).newState;
        next = checkVictory(next);
        if (next.winner) break;
    }
    return next;
}
