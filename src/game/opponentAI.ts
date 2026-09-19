import { Card, CardContext, CardType, EffectTrigger, GameState, Phase, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { addChainLink, combinations, effectChoices, fieldActivations, resolveChain } from './chains';

export type AIDecision =
    | { kind: 'summon'; card: Card; hidden: boolean; tributes: number[] }
    | { kind: 'set'; card: Card }
    | { kind: 'effect'; context: CardContext; trigger: EffectTrigger; fromHand?: boolean; deckId?: string }
    | { kind: 'position'; index: number }
    | { kind: 'attack'; index: number; target: number | 'direct' }
    | { kind: 'pass' };

/** The planner receives only this observation. Hidden identities, stats, hands and draw order are stripped. */
export function observeGame(state: GameState, viewer: number): GameState {
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
        p.pawnZones = p.pawnZones.map(z => z?.position === Position.HIDDEN ? { ...z, card: unknown(z.card, CardType.PAWN) } : z);
        p.actionZones = p.actionZones.map(z => z?.position === Position.HIDDEN ? { ...z, card: unknown(z.card, CardType.CONDITION) } : z);
    });
    view.log = [];
    return view;
}

const pawnValue = (c: Card) => c.id === 'unknown' ? 65 : 35 + Math.max(c.atk, c.def * .65) * .45;

export function evaluatePosition(state: GameState, player: number): number {
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
    return (own.lp - opp.lp) + field(player) - field(1 - player)
        + own.hand.reduce((n, c) => n + (c.type === CardType.PAWN ? (c.level <= 4 ? 24 : 12) : 18), 0)
        - exposed(player) * (own.lp < 250 ? 1.6 : .75)
        + (state.currentPhase === Phase.MAIN1 || state.currentPhase === Phase.BATTLE ? attackPower * (unblocked ? .65 : .08) : 0)
        + own.actionZones.filter(Boolean).length * 4;
}

export function simulateSummon(state: GameState, card: Card, hidden: boolean, tributes: number[]): GameState {
    const next = structuredClone(state), p = next.players[next.activePlayerIndex];
    if (![Phase.MAIN1, Phase.MAIN2].includes(next.currentPhase) || !p.hand.some(c => c.instanceId === card.instanceId)) return state;
    const required = card.level <= 4 ? 0 : card.level <= 7 ? 1 : 2;
    if (card.type !== CardType.PAWN || tributes.length !== required || new Set(tributes).size !== required || tributes.some(i => !p.pawnZones[i])) return state;
    if (!required && (hidden ? p.hiddenSummonUsed : p.normalSummonUsed)) return state;
    if (!p.pawnZones.includes(null) && !tributes.length) return state;
    tributes.forEach(i => { p.discard.push(p.pawnZones[i]!.card); p.pawnZones[i] = null; });
    const slot = p.pawnZones.indexOf(null);
    p.pawnZones[slot] = { card, position: hidden ? Position.HIDDEN : Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: next.turnNumber, isSetTurn: hidden };
    p.hand = p.hand.filter(c => c.instanceId !== card.instanceId);
    if (!required) { if (hidden) p.hiddenSummonUsed = true; else p.normalSummonUsed = true; }
    next.log = [hidden ? `${p.name} set a Pawn.` : `"${card.name}" ${required ? 'tribute summoned' : 'summoned'}.`, ...next.log].slice(0, 50);
    return next;
}

export function simulateAttack(state: GameState, index: number, target: number | 'direct'): GameState {
    const next = structuredClone(state), p = next.players[next.activePlayerIndex], opp = next.players[1 - next.activePlayerIndex];
    const attacker = p.pawnZones[index];
    if (!attacker) return state;
    attacker.attacksRemaining = (attacker.attacksRemaining ?? 1) - 1;
    attacker.hasAttacked = attacker.attacksRemaining <= 0;
    if (target === 'direct') opp.lp -= attacker.card.atk;
    else {
        const defender = opp.pawnZones[target];
        if (!defender) return state;
        const attackPosition = defender.position === Position.ATTACK;
        const defense = defender.card.id === 'unknown' ? 120 : attackPosition ? defender.card.atk : defender.card.def;
        const difference = attacker.card.atk - defense;
        if (difference > 0 || difference === 0 && attackPosition) { opp.discard.push(defender.card); opp.pawnZones[target] = null; }
        if (attackPosition) {
            if (difference > 0) opp.lp -= difference;
            else { p.lp += difference; p.discard.push(attacker.card); p.pawnZones[index] = null; }
        } else if (difference < 0) p.lp += difference;
    }
    return next;
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

/** Bounded battle search preserves strong attackers for direct damage and recognizes lethal sequences. */
function planBattle(state: GameState, player: number): AIDecision {
    let best = evaluatePosition(state, player), decision: AIDecision = { kind: 'pass' };
    let beam: { state: GameState; first?: AIDecision; score: number }[] = [{ state, score: best }];
    for (let depth = 0; depth < 10 && beam.length; depth++) {
        const candidates = beam.flatMap(node => attackChoices(node.state).map(action => {
            const next = simulateAttack(node.state, action.index, action.target);
            return { state: next, first: node.first ?? action, score: evaluatePosition(next, player) - depth * .01 };
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
    const considerEffect = (base: GameState, card: Card, trigger: EffectTrigger, fromHand = false) => {
        for (const context of effectChoices(base, card, trigger)) {
            const queued = addChainLink(base, context, trigger);
            const next = queued.response ? resolveChain(queued) : queued;
            const score = scoreAfterResponse(next, player);
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
                // Never expose a weaker new attacker to a known superior opposing Pawn.
                if (!hidden && card.atk < biggestEnemy) continue;
                const next = simulateSummon(state, card, hidden, tribute);
                if (next === state) continue;
                let score = evaluatePosition(next, player);
                if (!hidden && cardRegistry.getEffect(card.id)?.onSummon) {
                    for (const context of effectChoices(next, card, 'summon')) score = Math.max(score, evaluatePosition(resolveChain(addChainLink(next, context, 'summon')), player));
                }
                if (hidden && card.atk < biggestEnemy) score += 20;
                if (score > bestScore) { bestScore = score; decision = { kind: 'summon', card, hidden, tributes: tribute }; }
            }
        } else if (own.actionZones.includes(null)) {
            if (card.type === CardType.ACTION) {
                const base = structuredClone(state), p = base.players[player];
                p.hand = p.hand.filter(c => c.instanceId !== card.instanceId);
                p.actionZones[p.actionZones.indexOf(null)] = { card, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false };
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
        const next = structuredClone(state), zone = next.players[player].pawnZones[index]!;
        zone.position = z.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
        if (zone.position === Position.ATTACK && zone.card.atk < biggestEnemy) return;
        const score = evaluatePosition(next, player);
        if (score > bestScore) { bestScore = score; decision = { kind: 'position', index }; }
    });
    return decision;
}
