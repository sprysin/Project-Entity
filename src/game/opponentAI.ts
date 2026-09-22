import { Card, CardContext, CardType, EffectTrigger, GameState, Phase, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { addChainLink, combinations, effectChoices, fieldActivations, resolveChain } from './chains';
import { applyCommand } from './engine';
import { resolveCombat } from './combat';

export type AIDecision =
    | { kind: 'summon'; card: Card; hidden: boolean; tributes: number[] }
    | { kind: 'set'; card: Card }
    | { kind: 'effect'; context: CardContext; trigger: EffectTrigger; fromHand?: boolean; deckId?: string }
    | { kind: 'position'; index: number }
    | { kind: 'attack'; index: number; target: number | 'direct' }
    | { kind: 'pass' };

/** The planner receives only this observation. Hidden identities, stats, hands and draw order are stripped. */
export function observeGame(state: GameState, viewer: number, knownCards: ReadonlyMap<string, Card> = new Map()): GameState {
    const view = structuredClone(state);
    const unknown = (card: Card, type: CardType): Card => ({ instanceId: card.instanceId, ownerId: card.ownerId, id: 'unknown', name: 'Unknown card', type, level: 0, atk: 0, def: 0, effectText: '' });
    view.players.forEach((p, index) => {
        p.initialDeck = [];
        if (index === viewer) {
            // The deck's composition is known, but its current draw order is not.
            p.deck.sort((a, b) => a.id.localeCompare(b.id) || a.instanceId.localeCompare(b.instanceId));
            return;
        }
        p.hand = p.hand.map(c => unknown(c, CardType.ACTION));
        p.deck = p.deck.map(c => unknown(c, CardType.ACTION));
        p.pawnZones = p.pawnZones.map(z => z?.position === Position.HIDDEN ? { ...z, card: knownCards.get(z.card.instanceId) ?? unknown(z.card, CardType.PAWN) } : z);
        p.actionZones = p.actionZones.map(z => z?.position === Position.HIDDEN ? { ...z, card: knownCards.get(z.card.instanceId) ?? unknown(z.card, CardType.CONDITION) } : z);
    });
    view.log = [];
    return view;
}

// Establishing a board is the AI's primary non-lethal objective. The sizeable
// base value also means low-ATK utility Pawns are worth summoning for their
// effects instead of being judged almost entirely by their combat stats.
const pawnValue = (c: Card) => c.id === 'unknown' ? 120 : 100 + Math.max(c.atk, c.def * .65) * .45;

export function evaluatePosition(state: GameState, player: number): number {
    if (state.isDraw || state.players.every(p => p.lp <= 0)) return 0;
    if (state.winner) return state.winner === state.players[player].name ? 1000000 : -1000000;
    const own = state.players[player], opp = state.players[1 - player];
    if (own.lp <= 0) return -1000000;
    if (opp.lp <= 0) return 1000000;
    const field = (index: number) => state.players[index].pawnZones.reduce((n, z) => n + (z ? pawnValue(z.card) : 0), 0);
    const exposed = (index: number) => {
        const p = state.players[index], enemy = state.players[1 - index];
        const threats = enemy.pawnZones.filter(z => z && z.position !== Position.HIDDEN).map(z => z!.card.atk);
        const largest = Math.max(0, ...threats);
        const zones = p.pawnZones.filter(Boolean);
        if (!zones.length) return threats.reduce((a, b) => a + b, 0);
        return Math.max(0, ...zones.map(z => z!.position === Position.ATTACK ? largest - z!.card.atk : 0));
    };
    const attackPower = own.pawnZones.reduce((n, z) => n + (z?.position === Position.ATTACK ? z.card.atk * (z.nextBattleAttacks ?? z.attacksRemaining ?? 1) : 0), 0);
    const unblocked = !opp.pawnZones.some(Boolean);
    const strongestVisibleAttack = (index: number) => Math.max(0, ...state.players[index].pawnZones.map(z => z && z.position !== Position.HIDDEN ? z.card.atk : 0));
    const ownStrongest = strongestVisibleAttack(player), enemyStrongest = strongestVisibleAttack(1 - player);
    const combatControl = enemyStrongest === 0 ? 0
        : ownStrongest > enemyStrongest ? 50 + Math.min(100, ownStrongest - enemyStrongest) * .5
            : ownStrongest < enemyStrongest ? -50 - Math.min(100, enemyStrongest - ownStrongest) * .5
                : 0;
    // Above 100 LP, spending LP is a resource rather than a positional loss.
    // Opposing LP still has a light weight so non-lethal damage remains useful,
    // while lethal outcomes are handled by the terminal scores above.
    const ownLPSafety = Math.min(own.lp, 100);
    const opponentLP = opp.lp * .2;
    return ownLPSafety - opponentLP + field(player) - field(1 - player)
        + own.hand.reduce((n, c) => n + (c.type === CardType.PAWN ? (c.level <= 4 ? 24 : 12) : 18), 0)
        - exposed(player) * (own.lp < 100 ? 1.6 : .1)
        + combatControl
        // In Main 1, available attack power represents this turn's pressure. In
        // Battle it must not become a reason to pass: spending an attack removes
        // that "available" power even when the attack is plainly beneficial.
        + (state.currentPhase === Phase.MAIN1 ? attackPower * (unblocked ? .65 : .02) : 0)
        + own.actionZones.filter(Boolean).length * 4;
}

export function simulateSummon(state: GameState, card: Card, hidden: boolean, tributes: number[]): GameState {
    const player = state.players[state.activePlayerIndex];
    const slot = player.pawnZones.findIndex((zone, index) => !zone || tributes.includes(index));
    return applyCommand(state, state.activePlayerIndex, { type: 'summon', cardId: card.instanceId, hidden, tributes, slot }).state;
}

/** Unknown defenders use the planner's estimate; combat rules are shared with real matches. */
export function simulateAttack(state: GameState, index: number, target: number | 'direct'): GameState {
    const estimate = structuredClone(state);
    estimate.response = undefined;
    estimate.deferredAction = undefined;
    estimate.chain = [];
    estimate.currentPhase = Phase.BATTLE;
    if (target !== 'direct') {
        const defender = estimate.players[1 - estimate.activePlayerIndex].pawnZones[target];
        if (defender?.card.id === 'unknown') defender.card = { ...defender.card, atk: 100, def: 100 };
    }
    return resolveCombat(estimate, index, target);
}

/** Retain only identities that the AI has actually seen on the opponent's field. */
export function updateKnownCards(state: GameState, viewer: number, knownCards: Map<string, Card>): void {
    const opponent = state.players[1 - viewer];
    const field = [...opponent.pawnZones, ...opponent.actionZones].filter(z => z !== null);
    const present = new Set(field.map(z => z.card.instanceId));
    for (const id of knownCards.keys()) if (!present.has(id)) knownCards.delete(id);
    for (const zone of field) if (zone.position !== Position.HIDDEN) knownCards.set(zone.card.instanceId, { ...zone.card });
}

function attackChoices(state: GameState): Extract<AIDecision, { kind: 'attack' }>[] {
    const p = state.players[state.activePlayerIndex], opp = state.players[1 - state.activePlayerIndex];
    const targets: (number | 'direct')[] = opp.pawnZones.some(Boolean) ? opp.pawnZones.flatMap((z, i) => z ? [i] : []) : ['direct'];
    return p.pawnZones.flatMap((z, index) => z?.position === Position.ATTACK && (z.attacksRemaining ?? (z.hasAttacked ? 0 : 1)) > 0 ? targets.map(target => ({ kind: 'attack' as const, index, target })) : []);
}

function scoreAfterResponse(state: GameState, player: number): number {
    const action = state.deferredAction;
    if (action?.kind !== 'attack') return evaluatePosition(state, player);
    const own = state.players[state.activePlayerIndex], opp = state.players[1 - state.activePlayerIndex];
    const index = own.pawnZones.findIndex(z => z?.card.instanceId === action.attackerId && z.position === Position.ATTACK);
    const target = action.targetId === 'direct' ? 'direct' : opp.pawnZones.findIndex(z => z?.card.instanceId === action.targetId);
    if (index < 0 || target === 'direct' && opp.pawnZones.some(Boolean) || target !== 'direct' && target < 0) return evaluatePosition(state, player);
    return evaluatePosition(simulateAttack(state, index, target), player);
}

/**
 * Value an equal-ATK trade when superior numbers turn it into a breakthrough.
 * The bonus scales with the direct damage the surviving attackers can threaten,
 * so the AI still declines an unsupported or low-pressure trade.
 */
function breakthroughTradeBonus(state: GameState, action: Extract<AIDecision, { kind: 'attack' }>): number {
    if (action.target === 'direct') return 0;
    const own = state.players[state.activePlayerIndex], opp = state.players[1 - state.activePlayerIndex];
    const attacker = own.pawnZones[action.index], defender = opp.pawnZones[action.target];
    if (!attacker || !defender || defender.position !== Position.ATTACK || attacker.card.atk !== defender.card.atk) return 0;
    const ownCount = own.pawnZones.filter(Boolean).length, opposingCount = opp.pawnZones.filter(Boolean).length;
    if (opposingCount !== 1 || ownCount <= opposingCount) return 0;
    const followUpPower = own.pawnZones.reduce((total, zone, index) => total + (
        index !== action.index && zone?.position === Position.ATTACK
        && (zone.attacksRemaining ?? (zone.hasAttacked ? 0 : 1)) > 0 ? zone.card.atk : 0
    ), 0);
    return followUpPower * .25;
}

/** Bounded battle search preserves strong attackers for direct damage and recognizes lethal sequences. */
function planBattle(state: GameState, player: number): AIDecision {
    let best = evaluatePosition(state, player), decision: AIDecision = { kind: 'pass' };
    let beam: { state: GameState; first?: AIDecision; score: number; tacticalBonus: number }[] = [{ state, score: best, tacticalBonus: 0 }];
    for (let depth = 0; depth < 10 && beam.length; depth++) {
        const candidates = beam.flatMap(node => attackChoices(node.state).map(action => {
            const next = simulateAttack(node.state, action.index, action.target);
            const tacticalBonus = node.tacticalBonus + breakthroughTradeBonus(node.state, action);
            return { state: next, first: node.first ?? action, score: evaluatePosition(next, player) + tacticalBonus - depth * .01, tacticalBonus };
        }));
        candidates.sort((a, b) => b.score - a.score);
        if (candidates[0]?.score > best) { best = candidates[0].score; decision = candidates[0].first; }
        if (best >= 999000) break;
        beam = candidates.filter(n => n.state.players[player].lp > 0 && n.state.players[1 - player].lp > 0).slice(0, 16);
    }
    return decision;
}

export function chooseAIAction(observation: GameState, player: number, summonEffect?: Card): AIDecision {
    const state = observation, own = state.players[player];
    const response = !!state.response;
    if (!summonEffect && !response && state.currentPhase === Phase.BATTLE) return planBattle(state, player);
    let bestScore = scoreAfterResponse(response ? resolveChain(state) : state, player) + .1;
    let decision: AIDecision = { kind: 'pass' };
    const lowersOwnPawnAttack = (before: GameState, after: GameState) => {
        const originalAttack = new Map(before.players[player].pawnZones.flatMap(z => z ? [[z.card.instanceId, z.card.atk] as const] : []));
        return after.players[player].pawnZones.some(z => z && z.card.atk < (originalAttack.get(z.card.instanceId) ?? z.card.atk));
    };
    const raisesOpponentPawnAttack = (before: GameState, after: GameState) => {
        const originalAttack = new Map(before.players[1 - player].pawnZones.flatMap(z => z ? [[z.card.instanceId, z.card.atk] as const] : []));
        return after.players[1 - player].pawnZones.some(z => z && z.card.atk > (originalAttack.get(z.card.instanceId) ?? z.card.atk));
    };
    const opponentFieldRemovals = (before: GameState, after: GameState) => {
        const fieldIds = (snapshot: GameState) => {
            const opponent = snapshot.players[1 - player];
            return new Set([...opponent.pawnZones, ...opponent.actionZones].flatMap(z => z ? [z.card.instanceId] : []));
        };
        const remaining = fieldIds(after);
        return [...fieldIds(before)].filter(id => !remaining.has(id)).length;
    };
    const opponentLPDamage = (before: GameState, after: GameState) =>
        Math.max(0, before.players[1 - player].lp - after.players[1 - player].lp);
    const considerEffect = (base: GameState, card: Card, trigger: EffectTrigger, fromHand = false) => {
        for (const context of effectChoices(base, card, trigger)) {
            const queued = addChainLink(base, context, trigger);
            const next = queued.response ? resolveChain(queued) : queued;
            // A legal target is not necessarily a sensible one. In particular,
            // optional broad targeting must never turn an ATK reduction on the
            // AI's own Pawn just because no opponent target is available.
            if (lowersOwnPawnAttack(base, next) || raisesOpponentPawnAttack(base, next)) continue;
            // Reward all forms of opposing field removal equally. It does not
            // matter whether the effect destroys, voids, returns to hand, or
            // otherwise moves the card away from the opponent's field.
            const score = scoreAfterResponse(next, player)
                + opponentFieldRemovals(base, next) * 45
                // Position evaluation deliberately gives non-lethal LP a light
                // weight. Add effect-specific pressure so burn cards are still
                // worth converting from hand instead of being held forever.
                + opponentLPDamage(base, next) * .2;
            // Summon effects still fire when their benefit is intentionally not
            // represented by the score (for example, gaining LP while healthy).
            // Harmful self-ATK targets were filtered immediately above.
            if (score > bestScore || summonEffect && decision.kind === 'pass') {
                bestScore = score;
                decision = { kind: 'effect', context, trigger, fromHand, deckId: context.deckIndex === undefined ? undefined : own.deck[context.deckIndex]?.instanceId };
            }
        }
    };
    if (summonEffect) { considerEffect(state, summonEffect, 'summon'); return decision; }
    fieldActivations(state, player, response).forEach(a => considerEffect(state, a.card, a.trigger));
    if (response) return decision;
    if (![Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase)) return { kind: 'pass' };
    const biggestEnemy = Math.max(0, ...state.players[1 - player].pawnZones.map(z => z?.position !== Position.HIDDEN ? z?.card.atk ?? 0 : 0));
    own.hand.forEach(card => {
        if (card.type === CardType.PAWN) {
            const count = card.level <= 4 ? 0 : card.level <= 7 ? 1 : 2;
            const tributes = combinations(own.pawnZones.flatMap((z, i) => z ? [i] : []), count);
            for (const tribute of tributes) for (const hidden of [false, true]) {
                const next = simulateSummon(state, card, hidden, tribute);
                if (next === state) continue;
                let score = evaluatePosition(next, player);
                if (!hidden && cardRegistry.getEffect(card.id)?.onSummon) {
                    for (const context of effectChoices(next, card, 'summon')) {
                        const resolved = resolveChain(addChainLink(next, context, 'summon'));
                        if (!lowersOwnPawnAttack(next, resolved) && !raisesOpponentPawnAttack(next, resolved)) {
                            // Small generic credit for successfully using a summon
                            // effect. This lets utility Pawns enter face-up even when
                            // the immediate numeric result (such as LP above 100) is
                            // intentionally de-emphasized by the position score.
                            score = Math.max(score, evaluatePosition(resolved, player) + 15 + opponentFieldRemovals(next, resolved) * 45);
                        }
                    }
                }
                if (score > bestScore) { bestScore = score; decision = { kind: 'summon', card, hidden, tributes: tribute }; }
            }
        } else if (own.actionZones.includes(null)) {
            if (card.type === CardType.ACTION) {
                const base = applyCommand(state, player, { type: 'play', cardId: card.instanceId, set: false, slot: own.actionZones.indexOf(null) }).state;
                if (base === state) return;
                considerEffect(base, card, 'activate', true);
                // Lingering actions with separate field effects may first need to enter play.
                if (card.isLingering && !cardRegistry.getEffect(card.id)?.onActivate && bestScore < evaluatePosition(state, player) + 2) {
                    bestScore = evaluatePosition(state, player) + 2;
                    decision = { kind: 'effect', context: { card, playerIndex: player }, trigger: 'activate', fromHand: true };
                }
            }
            if (card.type === CardType.CONDITION && bestScore < evaluatePosition(state, player) + 3) {
                bestScore = evaluatePosition(state, player) + 3; decision = { kind: 'set', card };
            }
        }
    });
    own.pawnZones.forEach((z, index) => {
        if (!z || z.hasChangedPosition || z.hasAttacked || z.summonedTurn === state.turnNumber) return;
        const next = applyCommand(state, player, { type: 'position', index }).state;
        if (next === state) return;
        const zone = next.players[player].pawnZones[index]!;
        if (zone.position === Position.ATTACK && zone.card.atk < biggestEnemy) return;
        const score = evaluatePosition(next, player);
        if (score > bestScore) { bestScore = score; decision = { kind: 'position', index }; }
    });
    return decision;
}
