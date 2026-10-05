import { canTributeForSummon, fieldStats } from './cardHelpers';
import { Card, CardContext, CardType, EffectTrigger, GameState, Phase, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { addChainLink, combinations, effectChoices, fieldActivations, needsChoice, resolveChain, resolveChainStep, runEffect } from './chains';
import { applyCommand, GameCommand } from './engine';
import { handSummonCandidates } from './summonReactions';
import { resolveCombat } from './combat';
import { advancePhaseState } from './phases';

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
    const unknown = (card: Card, type: CardType): Card => ({ instanceId: card.instanceId, ownerId: card.ownerId, id: 'unknown', name: 'Unknown card', type, rarity: 'Common', level: 0, atk: 0, def: 0, effectText: '' });
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
const pawnValue = (c: Card, atk = c.atk, def = c.def) => c.id === 'unknown' ? 120 : 100 + Math.max(atk, def * .65) * .45;

export function evaluatePosition(state: GameState, player: number): number {
    if (state.isDraw || state.players.every(p => p.lp <= 0)) return 0;
    if (state.winner) return state.winner === state.players[player].name ? 1000000 : -1000000;
    const own = state.players[player], opp = state.players[1 - player];
    if (own.lp <= 0) return -1000000;
    if (opp.lp <= 0) return 1000000;
    const field = (index: number) => state.players[index].pawnZones.reduce((n, z) => {
        if (!z) return n;
        const stats = fieldStats(state, z);
        return n + pawnValue(z.card, stats.atk, stats.def);
    }, 0);
    const exposed = (index: number) => {
        const p = state.players[index], enemy = state.players[1 - index];
        const threats = enemy.pawnZones.filter(z => z && z.position !== Position.HIDDEN).map(z => fieldStats(state, z!).atk);
        const largest = Math.max(0, ...threats);
        const zones = p.pawnZones.filter(Boolean);
        if (!zones.length) return threats.reduce((a, b) => a + b, 0);
        return Math.max(0, ...zones.map(z => z!.position === Position.ATTACK ? largest - fieldStats(state, z!).atk : 0));
    };
    const attackPower = own.pawnZones.reduce((n, z) => n + (z?.position === Position.ATTACK ? fieldStats(state, z).atk * (z.nextBattleAttacks ?? z.attacksRemaining ?? 1) : 0), 0);
    const unblocked = !opp.pawnZones.some(Boolean);
    const strongestVisibleAttack = (index: number) => Math.max(0, ...state.players[index].pawnZones.map(z => z && z.position !== Position.HIDDEN ? fieldStats(state, z).atk : 0));
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
    const setupValue = (index: number) => {
        const controller = state.players[index];
        return [...controller.pawnZones, ...controller.actionZones].reduce((total, zone) => {
            if (!zone || zone.position === Position.HIDDEN) return total;
            const effect = cardRegistry.getEffect(zone.card.id);
            const reactionValue = effect?.onPawnSummoned && effect.handSummonFilter && controller.pawnZones.includes(null)
                ? Math.max(0, ...controller.hand.filter(effect.handSummonFilter).map(c => pawnValue(c) * .3)) : 0;
            const summon = effect?.counterSummon;
            // Reusable counters retain value after deployment. Known candidates
            // bound the useful threshold; surplus counters receive no credit.
            const counterValue = !summon ? 0 : Math.max(0, ...[
                ...controller.hand, ...controller.deck, ...controller.pawnZones.flatMap(pawn => pawn ? [pawn.card] : [])
            ].map(card => {
                const required = summon.requiredCounters(card);
                return required === undefined ? 0
                    : Math.min(zone.counters?.[summon.counter] ?? 0, required) * pawnValue(card) * .9;
            }));
            return total + reactionValue + counterValue;
        }, 0);
    };
    return ownLPSafety - opponentLP + field(player) - field(1 - player)
        + setupValue(player) - setupValue(1 - player)
        + own.hand.reduce((n, c) => n + (c.type === CardType.PAWN ? (c.level <= 4 ? 24 : 12) : 18), 0)
        - (own.skipNextDrawPhase ? Math.max(1, 5 - own.hand.length) * 18 : 0)
        + (opp.skipNextDrawPhase ? Math.max(1, 5 - opp.hand.length) * 18 : 0)
        - exposed(player) * (own.lp < 100 ? 1.6 : .6)
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
    estimate.attackReplay = undefined;
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
    return p.pawnZones.flatMap((z, index) => z?.position === Position.ATTACK
        && (!state.attackReplay || state.attackReplay.attackerId === z.card.instanceId)
        && (z.attacksRemaining ?? (z.hasAttacked ? 0 : 1)) > 0 ? targets.map(target => ({ kind: 'attack' as const, index, target })) : []);
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
    if (!attacker || !defender || defender.position !== Position.ATTACK || fieldStats(state, attacker).atk !== fieldStats(state, defender).atk) return 0;
    const ownCount = own.pawnZones.filter(Boolean).length, opposingCount = opp.pawnZones.filter(Boolean).length;
    if (opposingCount !== 1 || ownCount <= opposingCount) return 0;
    const followUpPower = own.pawnZones.reduce((total, zone, index) => total + (
        index !== action.index && zone?.position === Position.ATTACK
        && (zone.attacksRemaining ?? (zone.hasAttacked ? 0 : 1)) > 0 ? fieldStats(state, zone).atk : 0
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

/** Best score from one available battle attack, including the option to wait. */
function immediateBattleScore(state: GameState, player: number): number {
    const battle = state.currentPhase === Phase.MAIN1 ? advancePhaseState(state) : state;
    if (battle.currentPhase !== Phase.BATTLE) return evaluatePosition(state, player);
    return Math.max(evaluatePosition(battle, player), ...attackChoices(battle).map(action =>
        evaluatePosition(simulateAttack(battle, action.index, action.target), player)));
}

/** Combat payoff without Main Phase pressure bonuses or an open priority window. */
function battleOpportunity(state: GameState, player: number): number {
    const settled = { ...state, response: undefined, deferredAction: undefined, attackReplay: undefined };
    const battle = settled.currentPhase === Phase.MAIN1 ? advancePhaseState(settled) : settled;
    if (battle.currentPhase !== Phase.BATTLE) return 0;
    return immediateBattleScore(battle, player) - evaluatePosition(battle, player);
}

export function hasWorthwhileAttack(state: GameState, player: number): boolean {
    const battle = state.currentPhase === Phase.MAIN1 ? advancePhaseState(state) : state;
    return battle.currentPhase === Phase.BATTLE && planBattle(battle, player).kind === 'attack';
}

/** Compare a tribute upgrade with the same combat opportunity before summoning. */
function summonScore(state: GameState, next: GameState, player: number): number {
    return evaluatePosition(next, player) + (state.currentPhase === Phase.MAIN1
        ? Math.max(0, immediateBattleScore(next, player) - immediateBattleScore(state, player)) : 0);
}

/** Searches should favor cards that can become useful board presence immediately. */
function handFollowUpScore(state: GameState, player: number): number {
    let best = evaluatePosition(state, player);
    const own = state.players[player];
    for (const card of own.hand) {
        if (card.type !== CardType.PAWN) continue;
        const count = card.level <= 4 ? 0 : card.level <= 7 ? 1 : 2;
        for (const tributes of combinations(own.pawnZones.flatMap((z, i) => z && canTributeForSummon(z.card, card) ? [i] : []), count)) {
            const next = simulateSummon(state, card, false, tributes);
            if (next !== state) best = Math.max(best, summonScore(state, next, player));
        }
    }
    return best;
}

/** Triggered special summons choose both a useful Pawn and a safe position. */
export function chooseAIHandSummon(state: GameState, player: number): GameCommand | undefined {
    const request = state.pendingHandSummons?.[0];
    if (!request || request.playerIndex !== player || state.response || state.resolvingChain) return;
    let command: GameCommand = { type: 'declineHandSummon', sourceId: request.sourceId };
    let best = evaluatePosition(state, player);
    const slot = state.players[player].pawnZones.indexOf(null);
    if (slot < 0) return command;
    for (const card of handSummonCandidates(state, request)) for (const position of [Position.ATTACK, Position.DEFENSE]) {
        const candidate: GameCommand = { type: 'confirmHandSummon', sourceId: request.sourceId, cardId: card.instanceId, slot, position };
        const next = applyCommand(state, player, candidate).state;
        if (next === state) continue;
        const score = evaluatePosition(next, player);
        if (score > best) { best = score; command = candidate; }
    }
    return command;
}

export function chooseAIAction(observation: GameState, player: number, reactionCard?: Card, reactionTrigger: EffectTrigger = 'summon'): AIDecision {
    const state = observation, own = state.players[player];
    const resolvingLink = state.pendingChainTarget ? state.chain?.at(-1) : undefined;
    // Forecast delayed choices without storing them on the announced chain link.
    const settleChain = (queued: GameState, preferred?: CardContext) => resolveChain(queued, (pending, link) => {
        if (preferred?.card.instanceId === link.context.card.instanceId) {
            const preview = runEffect(pending, { ...preferred, execution: 'resolve' }, link.trigger);
            if (!preview.halted && !needsChoice(preview)) return preferred.targets ?? (preferred.target ? [preferred.target] : []);
        }
        const choice = chooseAIAction(observeGame(pending, link.context.playerIndex), link.context.playerIndex);
        return choice.kind === 'effect' ? choice.context.targets ?? (choice.context.target ? [choice.context.target] : []) : [];
    });
    const response = !!state.response;
    const battleDecision = !reactionCard && !response && state.currentPhase === Phase.BATTLE ? planBattle(state, player) : undefined;
    const baseline = response && !resolvingLink ? settleChain(state) : state;
    let bestScore = resolvingLink ? -Infinity : scoreAfterResponse(baseline, player) + .1;
    let decision: AIDecision = battleDecision ?? { kind: 'pass' };
    const lowersOwnPawnStats = (before: GameState, after: GameState) => {
        return after.players[player].pawnZones.some(z => {
            if (!z) return false;
            const original = before.players[player].pawnZones.find(previous => previous?.card.instanceId === z.card.instanceId);
            if (!original) return false;
            const previous = fieldStats(before, original), current = fieldStats(after, z);
            return current.atk < previous.atk || current.def < previous.def;
        });
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
        return [...fieldIds(before)].filter(id => !remaining.has(id)
            && !after.temporaryVoidReturns?.some(entry => entry.cardId === id)).length;
    };
    const opponentLPDamage = (before: GameState, after: GameState) =>
        Math.max(0, before.players[1 - player].lp - after.players[1 - player].lp);
    const visibleBlocker = !response && state.currentPhase === Phase.MAIN1
        && state.players[1 - player].pawnZones.some(z => z && z.position !== Position.HIDDEN);
    const currentBattleScore = visibleBlocker ? immediateBattleScore(state, player) : 0;
    const raisedOwnAttack = (before: GameState, after: GameState) =>
        after.players[player].pawnZones.some(z => z && z.card.atk > (before.players[player].pawnZones
            .find(original => original?.card.instanceId === z.card.instanceId)?.card.atk ?? z.card.atk));
    const boostedBattleScore = (start: GameState) => {
        let best = immediateBattleScore(start, player);
        let frontier = [start];
        const seen = new Set<string>();
        for (let depth = 0; depth < Math.min(6, start.players[player].hand.length) && frontier.length; depth++) {
            const candidates: GameState[] = [];
            for (const board of frontier) for (const activation of fieldActivations(board, player)) {
                for (const choice of effectChoices(board, activation.card, activation.trigger, 8)) {
                    const queued = addChainLink(board, choice, activation.trigger);
                    if (queued === board) continue;
                    const after = queued.response ? settleChain(queued, choice) : queued;
                    if (!raisedOwnAttack(board, after)) continue;
                    const key = after.players[player].pawnZones.map(z => z ? `${z.card.instanceId}:${z.card.atk}:${z.position}` : '').join('|')
                        + '/' + after.players[player].hand.map(c => c.instanceId).sort().join('|');
                    if (seen.has(key)) continue;
                    seen.add(key);
                    best = Math.max(best, immediateBattleScore(after, player));
                    candidates.push(after);
                }
            }
            candidates.sort((a, b) => Math.max(...b.players[player].pawnZones.map(z => z?.card.atk ?? 0))
                - Math.max(...a.players[player].pawnZones.map(z => z?.card.atk ?? 0)));
            frontier = candidates.slice(0, 6);
        }
        return best;
    };
    const considerEffect = (base: GameState, card: Card, trigger: EffectTrigger, fromHand = false) => {
        for (const context of effectChoices(base, card, trigger, 160, resolvingLink?.context)) {
            const queued = resolvingLink ? resolveChainStep(base, context.targets ?? (context.target ? [context.target] : []))
                : addChainLink(base, context, trigger);
            if (queued === base) continue;
            const next = queued.response ? settleChain(queued, context) : queued;
            // A legal target is not necessarily a sensible one. In particular,
            // optional broad targeting must never turn an ATK reduction on the
            // AI's own Pawn just because no opponent target is available.
            const preview = runEffect(base, context, trigger).newState;
            if (!resolvingLink && (lowersOwnPawnStats(base, preview) || raisesOpponentPawnAttack(base, preview))) continue;
            if (!resolvingLink && (context.targets ?? (context.target ? [context.target] : [])).some(target => {
                if (target.playerIndex !== player || target.type !== 'pawn') return false;
                const id = base.players[player].pawnZones[target.index]?.card.instanceId;
                return id && !preview.players[player].pawnZones.some(z => z?.card.instanceId === id)
                    && !preview.temporaryVoidReturns?.some(entry => entry.cardId === id);
            })) continue;
            // Credit only removals beyond those already queued in the chain,
            // regardless of whether a card is destroyed, voided, or returned.
            const temporary = (next.temporaryVoidReturns ?? []).filter(entry =>
                !baseline.temporaryVoidReturns?.some(previous => previous.cardId === entry.cardId));
            // Returning Pawns are not permanent card advantage. Restore their
            // board value, then credit only the combat or chain outcome achieved
            // during their absence. This also recognizes temporarily saving an
            // ally from an announced targeted effect.
            let lasting = next;
            if (temporary.length) {
                lasting = structuredClone(next);
                for (const entry of temporary) {
                    const controller = base.players.findIndex(p => p.pawnZones.some(z => z?.card.instanceId === entry.cardId));
                    if (controller < 0) continue;
                    const original = base.players[controller].pawnZones.find(z => z?.card.instanceId === entry.cardId)!;
                    const owner = lasting.players[entry.playerIndex];
                    const returning = owner.void.find(c => c.instanceId === entry.cardId);
                    const slot = owner.pawnZones.indexOf(null);
                    if (!returning || slot < 0) continue;
                    owner.pawnZones[slot] = { ...structuredClone(original), card: returning, position: entry.position };
                    owner.void = owner.void.filter(c => c.instanceId !== entry.cardId);
                }
            }
            let score = evaluatePosition(lasting, player)
                + scoreAfterResponse(next, player) - evaluatePosition(next, player)
                + opponentFieldRemovals(baseline, next) * 45
                // Position evaluation deliberately gives non-lethal LP a light
                // weight. Add effect-specific pressure so burn cards are still
                // worth converting from hand instead of being held forever.
                + opponentLPDamage(baseline, next) * .2;
            if (temporary.length) {
                // Proactive removal needs a real attack payoff this turn. During
                // Draw/Standby/End there is no combat opportunity before a
                // next-Standby return; keep the quick effect available instead.
                if (state.activePlayerIndex === player && state.deferredAction?.kind !== 'attack'
                    && [Phase.MAIN1, Phase.BATTLE].includes(state.currentPhase)) {
                    score += battleOpportunity(next, player) - battleOpportunity(baseline, player);
                }
                score -= 12; // Preserve a reusable response unless it achieves a useful payoff.
            }
            if (!response && next.players[player].hand.some(c => !base.players[player].hand.some(previous => previous.instanceId === c.instanceId))) {
                score += Math.max(0, handFollowUpScore(next, player) - evaluatePosition(next, player));
                // Avoid paying substantial LP merely to stockpile unplayable
                // searches. A real deployment or card advantage can justify it.
                score -= Math.max(0, base.players[player].lp - next.players[player].lp) * .05;
            }
            if (visibleBlocker && raisedOwnAttack(base, next)) {
                score += Math.max(0, boostedBattleScore(next) - currentBattleScore);
            }
            // Summon effects still fire when their benefit is intentionally not
            // represented by the score (for example, gaining LP while healthy).
            // Harmful self-ATK targets were filtered immediately above.
            if (score > bestScore || reactionCard && decision.kind === 'pass' && !temporary.length) {
                bestScore = score;
                decision = { kind: 'effect', context, trigger, fromHand, deckId: context.deckIndex === undefined ? undefined : own.deck[context.deckIndex]?.instanceId };
            }
        }
    };
    if (resolvingLink) {
        if (resolvingLink.context.playerIndex === player) considerEffect(state, resolvingLink.context.card, resolvingLink.trigger);
        return decision;
    }
    if (reactionCard) { considerEffect(state, reactionCard, reactionTrigger); return decision; }
    fieldActivations(state, player, response).forEach(a => considerEffect(state, a.card, a.trigger));
    if (response) return decision;
    if (![Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase)) return decision;
    const biggestEnemy = Math.max(0, ...state.players[1 - player].pawnZones.map(z => z && z.position !== Position.HIDDEN ? fieldStats(state, z).atk : 0));
    own.hand.forEach(card => {
        if (card.type === CardType.PAWN) {
            const count = card.level <= 4 ? 0 : card.level <= 7 ? 1 : 2;
            const tributes = combinations(own.pawnZones.flatMap((z, i) => z && canTributeForSummon(z.card, card) ? [i] : []), count);
            for (const tribute of tributes) for (const hidden of [false, true]) {
                const next = simulateSummon(state, card, hidden, tribute);
                if (next === state) continue;
                let score = summonScore(state, next, player);
                if (!hidden && cardRegistry.getEffect(card.id)?.onSummon) {
                    for (const context of effectChoices(next, card, 'summon')) {
                        const resolved = settleChain(addChainLink(next, context, 'summon'), context);
                        if (!lowersOwnPawnStats(next, resolved) && !raisesOpponentPawnAttack(next, resolved)) {
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
        if (zone.position === Position.ATTACK && fieldStats(next, zone).atk <= 20
            && !fieldActivations(next, player).some(a => a.card.instanceId === zone.card.instanceId
                && !fieldActivations(state, player).some(previous => previous.card.instanceId === zone.card.instanceId))) return;
        if (zone.position === Position.ATTACK && fieldStats(next, zone).atk < biggestEnemy) return;
        const score = evaluatePosition(next, player)
            + (zone.position === Position.ATTACK && visibleBlocker
                ? Math.max(0, immediateBattleScore(next, player) - currentBattleScore) : 0);
        if (score > bestScore) { bestScore = score; decision = { kind: 'position', index }; }
    });
    return decision;
}
