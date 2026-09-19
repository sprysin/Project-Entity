import { Card, CardContext, CardTarget, CardType, ChainLink, EffectResult, EffectTrigger, GameState, Phase, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { finishEffect, checkVictory } from './finishEffect';
import { formatEffectLog } from './effectLog';

export function runEffect(state: GameState, context: CardContext, trigger: EffectTrigger): EffectResult {
    // Activating a set Action/Condition reveals it before targets and requirements are checked.
    if (context.card.type !== CardType.PAWN) {
        state = structuredClone(state);
        const source = state.players[context.playerIndex].actionZones.find(z => z?.card.instanceId === context.card.instanceId);
        if (source) source.position = Position.ATTACK;
    }
    const effect = cardRegistry.getEffect(context.card.id);
    const fn = trigger === 'summon' ? effect?.onSummon : trigger === 'field_activate' ? effect?.onFieldActivate : effect?.onActivate;
    // Legacy/custom handlers are resolution-only; the builder explicitly exposes cost staging.
    if (context.execution === 'costs' && fn && !('staged' in fn)) return { newState: state };
    return fn?.(state, context) ?? { newState: state };
}

export function needsChoice(result: EffectResult) {
    return !!(result.requireTarget || result.requireHandSelection || result.requireDiscardSelection || result.requireDeckSelection || result.requireEffectTribute);
}

export function combinations(values: number[], count: number): number[][] {
    if (!count) return [[]];
    return values.flatMap((value, i) => combinations(values.slice(i + 1), count - 1).map(rest => [value, ...rest]));
}

/** Enumerate legal choices through the effect's own requirements, never card-name recipes. */
export function effectChoices(state: GameState, card: Card, trigger: EffectTrigger, limit = 160): CardContext[] {
    const playerIndex = state.players.findIndex(p => p.id === card.ownerId);
    if (playerIndex < 0) return [];
    const effect = cardRegistry.getEffect(card.id);
    if (effect?.canActivate && !effect.canActivate(state, { card, playerIndex })) return [];
    const choices: CardContext[] = [];
    let visited = 0;
    const visit = (context: CardContext, depth: number) => {
        if (depth > 6 || choices.length >= limit || visited++ > 2500) return;
        const result = runEffect(state, context, trigger);
        if (result.halted) return;
        const targetIndex = result.requireTargetIndex ?? 0;
        const selectedTarget = context.targets?.[targetIndex] ?? (targetIndex === 0 ? context.target : undefined);
        if (result.requireTarget && !selectedTarget) {
            state.players.forEach((player, pi) => (['pawn', 'action'] as const).forEach(type => {
                if (result.requireTarget !== 'any' && type !== result.requireTarget) return;
                const isOpponent = pi !== playerIndex;
                if (result.requireTargetScope === 'active' && isOpponent || result.requireTargetScope === 'opponent' && !isOpponent) return;
                player[type === 'pawn' ? 'pawnZones' : 'actionZones'].forEach((zone, index) => {
                    if (!zone) return;
                    if (result.requireTargetPosition === 'hidden' && zone.position !== Position.HIDDEN) return;
                    if (result.requireTargetPosition === 'faceup' && zone.position === Position.HIDDEN) return;
                    const target = { playerIndex: pi, type, index };
                    const targets = [...(context.targets ?? [])];
                    targets[targetIndex] = target;
                    visit({ ...context, target: targets[0], targets }, depth + 1);
                });
            }));
        } else if (result.requireHandSelection && context.handIndex === undefined) {
            const req = result.requireHandSelection;
            state.players[req.playerIndex].hand.forEach((c, handIndex) => {
                if (!req.filter || req.filter(c)) visit({ ...context, handIndex }, depth + 1);
            });
        } else if (result.requireEffectTribute && !context.tributeIndices) {
            const req = result.requireEffectTribute;
            const indices = state.players[req.playerIndex].pawnZones.flatMap((z, i) => z && (!req.filter || req.filter(z.card)) ? [i] : []);
            combinations(indices, req.count).forEach(tributeIndices => visit({ ...context, tributeIndices }, depth + 1));
        } else if (result.requireDiscardSelection && context.discardIndex === undefined) {
            const req = result.requireDiscardSelection;
            state.players[req.playerIndex].discard.forEach((c, discardIndex) => {
                if (req.filter(c)) visit({ ...context, discardIndex }, depth + 1);
            });
        } else if (result.requireDeckSelection && context.deckIndex === undefined) {
            const req = result.requireDeckSelection;
            state.players[req.playerIndex].deck.forEach((c, deckIndex) => {
                if (req.filter(c)) visit({ ...context, deckIndex }, depth + 1);
            });
        } else if (!needsChoice(result)) choices.push(context);
    };
    visit({ card, playerIndex }, 0);
    return choices;
}

export interface Activation { card: Card; trigger: EffectTrigger; slot: CardTarget }

export function fieldActivations(state: GameState, playerIndex: number, responding = false): Activation[] {
    if (state.winner) return [];
    const main = state.activePlayerIndex === playerIndex && [Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase);
    const pending = new Set(state.chain?.map(link => link.context.card.instanceId));
    return (['pawn', 'action'] as const).flatMap(type => state.players[playerIndex][type === 'pawn' ? 'pawnZones' : 'actionZones'].flatMap((zone, index) => {
        if (!zone || pending.has(zone.card.instanceId)) return [];
        const effect = cardRegistry.getEffect(zone.card.id);
        if (type === 'pawn' && (zone.position === Position.HIDDEN || (responding ? effect?.timing !== 'quick' : !main && effect?.timing !== 'quick'))) return [];
        if (zone.card.type === CardType.ACTION && (responding || !main)) return [];
        // A Condition's onActivate effect is the one-time flip activation. Lingering
        // Conditions remain face-up after resolving, but that does not make their
        // original activation reusable on every subsequent priority window.
        if (zone.card.type === CardType.CONDITION && (state.turnNumber <= zone.summonedTurn || zone.position !== Position.HIDDEN)) return [];
        // Lingering Actions use their field effect whether they were played face-up or
        // set first. Otherwise a set lingering card can never be flipped: it usually
        // has no onActivate handler, so it gets filtered out below.
        const trigger: EffectTrigger = zone.card.type === CardType.ACTION && (zone.position !== Position.HIDDEN || zone.card.isLingering)
            ? 'field_activate'
            : 'activate';
        if (!(trigger === 'field_activate' ? effect?.onFieldActivate : effect?.onActivate)) return [];
        if (!effectChoices(state, zone.card, trigger, 1).length) return [];
        return [{ card: zone.card, trigger, slot: { playerIndex, type, index } }];
    }));
}

/** Pay costs and reserve usage at announcement. All other effects wait for resolution. */
export function addChainLink(state: GameState, context: CardContext, trigger: EffectTrigger): GameState {
    if (state.winner || state.chain?.some(link => link.context.card.instanceId === context.card.instanceId)) return state;
    if (trigger === 'summon' && !cardRegistry.getEffect(context.card.id)?.onSummon) return state;
    if (state.response && state.response.priority !== context.playerIndex) return state;
    if (state.response && !fieldActivations(state, context.playerIndex, true).some(a => a.card.instanceId === context.card.instanceId && a.trigger === trigger)) return state;
    const effect = cardRegistry.getEffect(context.card.id);
    if (effect?.canActivate && !effect.canActivate(state, context)) return state;
    const peek = runEffect(state, context, trigger);
    if (peek.halted || needsChoice(peek)) return state;
    const paid = runEffect(state, { ...context, execution: 'costs' }, trigger);
    if (paid.halted || needsChoice(paid)) return state;
    let next = structuredClone(paid.newState);
    const p = next.players[context.playerIndex];
    const tributeCards = context.tributeIndices?.flatMap(i => state.players[context.playerIndex].pawnZones[i]?.card ?? []) ?? [];
    const source = [...p.pawnZones, ...p.actionZones].find(z => z?.card.instanceId === context.card.instanceId);
    if (source && context.card.type !== CardType.PAWN) source.position = Position.ATTACK;
    const targets = context.targets ?? (context.target ? [context.target] : []);
    const target = targets[0];
    const link: ChainLink = {
        context: { ...context, target, targets, tributeCards }, trigger,
        targetId: target ? state.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'][target.index]?.card.instanceId : undefined,
        targetIds: targets.map(selected => selected
            ? state.players[selected.playerIndex][selected.type === 'pawn' ? 'pawnZones' : 'actionZones'][selected.index]?.card.instanceId
            : undefined),
        discardId: context.discardIndex === undefined ? undefined : state.players[context.playerIndex].discard[context.discardIndex]?.instanceId,
        deckId: context.deckIndex === undefined ? undefined : state.players[context.playerIndex].deck[context.deckIndex]?.instanceId,
    };
    next.chain = [...(state.chain ?? []), link];
    if (context.handIndex !== undefined || tributeCards.length || next.players[context.playerIndex].lp !== state.players[context.playerIndex].lp) {
        next.log = [formatEffectLog(state, next, context.card, context, trigger, tributeCards), ...next.log].slice(0, 50);
    }
    next.response = { priority: 1 - context.playerIndex, passes: 0, reason: `${context.card.name} activated` };
    next = checkVictory(next);
    return autoPass(next);
}

export function resolveChain(state: GameState): GameState {
    let next = state;
    for (const link of [...(state.chain ?? [])].reverse()) {
        if (next.winner) break;
        const context = { ...link.context, handIndex: undefined, execution: 'resolve' as const };
        const p = next.players[context.playerIndex];
        let invalid = false;
        const targets = context.targets ?? (context.target ? [context.target] : []);
        if (targets.length) {
            context.targets = targets.map((target, targetIndex) => {
                const id = link.targetIds?.[targetIndex] ?? (targetIndex === 0 ? link.targetId : undefined);
                const index = next.players[target.playerIndex][target.type === 'pawn' ? 'pawnZones' : 'actionZones'].findIndex(z => z?.card.instanceId === id);
                if (index < 0) invalid = true;
                return { ...target, index };
            });
            context.target = context.targets[0];
        }
        if (link.discardId) { context.discardIndex = p.discard.findIndex(c => c.instanceId === link.discardId); invalid ||= context.discardIndex < 0; }
        if (link.deckId) { context.deckIndex = p.deck.findIndex(c => c.instanceId === link.deckId); invalid ||= context.deckIndex < 0; }
        const before = next;
        const result = invalid ? undefined : runEffect(next, context, link.trigger);
        const fizzled = !result || result.halted || needsChoice(result);
        next = finishEffect(fizzled ? next : result.newState, context.card,
            fizzled ? `"${context.card.name}" resolved without effect: its selection is no longer valid.` : formatEffectLog(before, result.newState, context.card, context, link.trigger, context.tributeCards));
    }
    return { ...next, chain: [], response: state.deferredAction && !next.winner ? { ...state.response!, ready: true } : undefined };
}

export function passPriority(state: GameState): GameState {
    if (!state.response || state.response.ready || state.winner) return state;
    const response = { ...state.response, passes: state.response.passes + 1, priority: 1 - state.response.priority };
    return response.passes >= 2 ? resolveChain({ ...state, response }) : autoPass({ ...state, response });
}

/** Empty windows never create a popup. Two consecutive passes close the chain. */
export function autoPass(state: GameState): GameState {
    let next = state;
    for (let i = 0; i < 2 && next.response && !next.response.ready && !next.winner; i++) {
        if (fieldActivations(next, next.response.priority, true).length) break;
        const response = { ...next.response, passes: next.response.passes + 1, priority: 1 - next.response.priority };
        next = response.passes >= 2 ? resolveChain({ ...next, response }) : { ...next, response };
    }
    return next;
}

export function openResponse(state: GameState, action: NonNullable<GameState['deferredAction']>, reason: string): GameState {
    if (state.response || state.winner) return state;
    return autoPass({ ...state, deferredAction: action, chain: [], response: { priority: 1 - state.activePlayerIndex, passes: 0, reason } });
}
