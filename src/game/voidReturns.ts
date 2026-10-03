import { GameState } from '../types';
import { sendToOwnerPile } from './cardOwnership';

/** Skip vanished cards and discard returns when their owner's field is full. Mutates a draft. */
export function prepareVoidReturn(state: GameState): void {
    while (state.pendingVoidReturns?.length) {
        const entry = state.pendingVoidReturns[0];
        const owner = state.players[entry.playerIndex];
        const index = owner.void.findIndex(card => card.instanceId === entry.cardId);
        if (index >= 0 && owner.pawnZones.includes(null)) return;
        state.pendingVoidReturns.shift();
        if (index < 0) continue;
        const [card] = owner.void.splice(index, 1);
        sendToOwnerPile(state, card, 'discard');
        state.log = [`"${card.name}" could not return from the Void: no empty Pawn zone. Sent to the Discard pile.`, ...state.log].slice(0, 50);
    }
}
