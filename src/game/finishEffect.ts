import { Card, CardType, GameState } from '../types';
import { destroyOrphanedAttachments } from './attachments';

/** Complete an activation atomically; locate the source by identity, never by an old slot. */
export function finishEffect(state: GameState, card: Card, log?: string): GameState {
    const next: GameState = structuredClone(state);
    const attached = next.players.some(p => p.actionZones.some(z => z?.card.instanceId === card.instanceId && z.attachedToInstanceId));
    if (card.type !== CardType.PAWN && !card.isLingering && !(card.isAttached && attached)) {
        for (const player of next.players) {
            const index = player.actionZones.findIndex(z => z?.card.instanceId === card.instanceId);
            if (index !== -1) {
                player.discard.push(player.actionZones[index]!.card);
                player.actionZones[index] = null;
            }
        }
    }
    if (log) next.log = [log, ...next.log].slice(0, 50);
    return checkVictory(next);
}

export function checkVictory(state: GameState): GameState {
    destroyOrphanedAttachments(state);
    if (state.winner) return state;
    const active = state.activePlayerIndex;
    const opponent = (active + 1) % 2;
    const winner = state.players[opponent].lp <= 0 ? state.players[active].name
        : state.players[active].lp <= 0 ? state.players[opponent].name : null;
    return winner ? { ...state, winner } : state;
}
