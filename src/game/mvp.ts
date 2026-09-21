import { GameState } from '../types';

/** Rank individual card instances. Equal totals favor the first card to deal damage. */
export function getDuelMvp(state: GameState) {
    if (state.isDraw) return null;
    const winnerIndex = state.players.findIndex(p => p.name === state.winner);
    const scores = new Map<string, { card: NonNullable<GameState['damageEvents']>[number]['card']; battle: number; effect: number; total: number }>();
    for (const event of state.damageEvents ?? []) {
        if (event.playerIndex !== winnerIndex || event.amount <= 0) continue;
        const score = scores.get(event.card.instanceId) ?? { card: event.card, battle: 0, effect: 0, total: 0 };
        score[event.kind] += event.amount;
        score.total += event.amount;
        scores.set(event.card.instanceId, score);
    }
    return [...scores.values()].sort((a, b) => b.total - a.total)[0] ?? null;
}
