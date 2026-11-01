import type { GameState } from '../types';

export const DUEL_POINTS = {
    battleDestructions: 50,
    actionDestructions: 150,
    effectDestructions: 175,
    tributeSummons: 50,
    vassalSummons: 100,
    mergeSummons: 100,
    victory: 500,
} as const;

export type DuelStats = Record<Exclude<keyof typeof DUEL_POINTS, 'victory'>, number>;
export const emptyDuelStats = (): DuelStats => ({
    battleDestructions: 0, actionDestructions: 0, effectDestructions: 0,
    tributeSummons: 0, vassalSummons: 0, mergeSummons: 0,
});

/** Copy on write: combat shares the original snapshot until it commits. */
export function recordDuelAction(state: GameState, playerIndex: number, action: keyof DuelStats) {
    const stats: [DuelStats, DuelStats] = state.duelStats
        ? [{ ...state.duelStats[0] }, { ...state.duelStats[1] }]
        : [emptyDuelStats(), emptyDuelStats()];
    stats[playerIndex][action] += 1;
    state.duelStats = stats;
}

/** Every damage point counts; the logarithmic tail has no hard cap. */
export function damageScore(damage: number): number {
    return damage <= 800 ? Math.max(0, damage) : 800 + 800 * Math.log(damage / 800);
}

export function getDuelReport(state: GameState, playerIndex: number) {
    const stats = state.duelStats?.[playerIndex] ?? emptyDuelStats();
    const damage = { battle: 0, effect: 0 };
    for (const event of state.damageEvents ?? []) {
        if (event.playerIndex === playerIndex) damage[event.kind] += event.amount;
    }
    const completed = !!state.winner && (state.resultReason === 'lp' || state.resultReason === 'empty_deck');
    const won = completed && !state.isDraw && state.winner === state.players[playerIndex].name;
    const lpGained = (state.lpGainEvents ?? []).reduce((total, event) => total +
        (event.playerIndex === playerIndex && event.sourcePlayerIndex === playerIndex ? event.amount : 0), 0);
    const tookDamage = (state.effectDamageTaken?.[playerIndex] ?? 0) > 0 ||
        (state.damageEvents ?? []).some(event => event.playerIndex !== playerIndex && event.amount > 0);
    const brink = state.players[playerIndex].lp > 0 && state.players[playerIndex].lp <= 100;
    const victory = !tookDamage ? { label: 'No-Damage Taken Victory', score: 900 }
        : brink ? { label: 'LP on Brink Victory', score: 800 }
        : { label: 'Duel victory', score: DUEL_POINTS.victory };
    const entries = [
        { id: 'battleDestructions', label: 'Pawns destroyed by battle', count: stats.battleDestructions, score: stats.battleDestructions * DUEL_POINTS.battleDestructions },
        { id: 'actionDestructions', label: 'Actions / Conditions destroyed', count: stats.actionDestructions, score: stats.actionDestructions * DUEL_POINTS.actionDestructions },
        { id: 'effectDestructions', label: 'Pawns destroyed by effect', count: stats.effectDestructions, score: stats.effectDestructions * DUEL_POINTS.effectDestructions },
        { id: 'tributeSummons', label: 'Tribute summons', count: stats.tributeSummons, score: stats.tributeSummons * DUEL_POINTS.tributeSummons },
        { id: 'vassalSummons', label: 'Vassal summons', count: stats.vassalSummons, score: stats.vassalSummons * DUEL_POINTS.vassalSummons },
        { id: 'mergeSummons', label: 'Merge summons', count: stats.mergeSummons, score: stats.mergeSummons * DUEL_POINTS.mergeSummons },
        { id: 'battleDamage', label: 'Battle damage dealt', count: damage.battle, score: damageScore(damage.battle) },
        { id: 'effectDamage', label: 'Effect damage dealt', count: damage.effect, score: damageScore(damage.effect) * 1.2 },
        { id: 'lpGained', label: 'LP gained', count: lpGained, score: lpGained },
        { id: 'victory', label: victory.label, count: won ? 1 : 0, score: won ? victory.score : 0 },
    ];
    // Round the cumulative score only; integer row contributions still sum exactly.
    let exactTotal = 0;
    let total = 0;
    const rows = entries.map(entry => {
        exactTotal += entry.score;
        const rounded = Math.round(exactTotal);
        const score = rounded - total;
        total = rounded;
        return { ...entry, score };
    });
    return { rows, total, xp: completed ? Math.floor(total / 10) : 0, completed, won };
}

/** Total XP to reach level L is 5(L-1)^2 + 295(L-1). */
export function accountProgress(totalXp: number) {
    const levels = Math.floor((2 * totalXp) / (295 + Math.sqrt(295 ** 2 + 20 * totalXp)));
    const levelStart = 5 * levels * levels + 295 * levels;
    return { level: levels + 1, xp: totalXp - levelStart, required: 300 + 10 * levels, totalXp };
}
