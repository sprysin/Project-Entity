import { activeLand, fieldEntries, isLand, sourceZone, targetZone, targetZones } from './field';
import { Card, CardContext, CardTarget, CardType, ChainLink, EffectResult, EffectTrigger, GameState, Phase, Position, ResponseTiming } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { finishEffect, checkVictory } from './finishEffect';
import { formatEffectLog } from './effectLog';
import { cardsAtLocation, canTargetWithEffect } from './cardHelpers';
import { notifyAttachedActivation } from './attachments';
import { isDrawingForTurn } from './phases';
import { notifyFieldEvent } from './fieldEvents';
import { levelTributeCandidates, levelTributeChoices } from './levelTributes';
import { needsChoice } from '../cards/engine/Builder';

export { needsChoice } from '../cards/engine/Builder';

export function runEffect(state: GameState, context: CardContext, trigger: EffectTrigger): EffectResult {
    if (isLand(context.card) && ['activate', 'field_activate', 'phase'].includes(trigger)
        && activeLand(state)?.card.instanceId !== context.card.instanceId) return { newState: state, halted: true };
    if (context.execution !== 'costs' && (context.targets ?? (context.target ? [context.target] : [])).some(target => {
        const zone = targetZone(state, target);
        return zone && !canTargetWithEffect(zone.card);
    })) return { newState: state, halted: true };
    // Activating a set Action/Condition reveals it before targets and requirements are checked.
    if (context.card.type !== CardType.PAWN && (!context.execution || context.execution === 'reserve')) {
        state = structuredClone(state);
        const source = state.players[context.playerIndex].actionZones.find(z => z?.card.instanceId === context.card.instanceId);
        if (source) source.position = Position.FACE_UP;
    }
    const effect = cardRegistry.getEffect(context.card.id);
    context = { ...context, battleAttacker: context.battleAttacker ?? state.pendingReactions?.find(entry => entry.card.instanceId === context.card.instanceId && entry.trigger === trigger)?.battleAttacker };
    if (trigger === 'battle_destroy') {
        if (!context.destroyedCard || context.execution === 'costs' || context.execution === 'reserve') return { newState: state };
        return effect?.onBattleDestroy?.(state, { ...context, destroyedCard: context.destroyedCard }) ?? { newState: state };
    }
    const fn = trigger === 'hand_activate' ? effect?.onHandActivate
        : trigger === 'hand_return' ? effect?.onHandReturn
        : trigger === 'summon' ? effect?.onSummon
        : trigger === 'switch' ? effect?.onSwitch
        : trigger === 'destroyed' ? effect?.onDestroyed
        : trigger === 'battle_destroyed' ? effect?.onBattleDestroyed
        : trigger === 'attack_completed' ? effect?.onAttackCompleted
        : trigger === 'sent_discard' ? effect?.onSentToDiscard
        : trigger === 'phase' ? effect?.onPhaseChange
        : trigger === 'discard' ? effect?.onDiscard
        : trigger === 'tribute' ? effect?.onTribute
        : trigger === 'field_activate' ? effect?.onFieldActivate : effect?.onActivate;
    // Legacy/custom handlers are resolution-only; the builder explicitly exposes cost staging.
    if ((context.execution === 'costs' || context.execution === 'reserve') && fn && !('staged' in fn)) return { newState: state };
    return fn?.(state, context) ?? { newState: state };
}

export function combinations<T>(values: T[], count: number): T[][] {
    if (!count) return [[]];
    return values.flatMap((value, i) => combinations(values.slice(i + 1), count - 1).map(rest => [value, ...rest]));
}

/** Enumerate legal choices through the effect's own requirements, never card-name recipes. */
export function effectChoices(state: GameState, card: Card, trigger: EffectTrigger, limit = 160, resolutionContext?: CardContext): CardContext[] {
    const controllerIndex = state.players.findIndex(p => p.pawnZones.some(z => z?.card.instanceId === card.instanceId)
        || p.actionZones.some(z => z?.card.instanceId === card.instanceId)
        || state.pendingReactions?.some(entry => entry.card.instanceId === card.instanceId && entry.playerIndex === state.players.indexOf(p)));
    const reactionIndex = state.pendingReactions?.find(entry => entry.card.instanceId === card.instanceId && entry.trigger === trigger)?.playerIndex;
    const playerIndex = resolutionContext?.playerIndex ?? reactionIndex ?? (isLand(card) ? state.activePlayerIndex : undefined) ?? (controllerIndex >= 0 ? controllerIndex : state.players.findIndex(p => p.id === card.ownerId));
    if (playerIndex < 0) return [];
    const effect = cardRegistry.getEffect(card.id);
    const eligibility = trigger === 'hand_activate' ? effect?.canActivateFromHand : trigger === 'hand_return' ? undefined : effect?.canActivate;
    if (trigger !== 'phase' && !resolutionContext && eligibility && !eligibility(state, { card, playerIndex })) return [];
    const choices: CardContext[] = [];
    let visited = 0;
    const visit = (context: CardContext, depth: number) => {
        if (depth > 6 || choices.length >= limit || visited++ > 2500) return;
        const result = runEffect(state, context, trigger);
        if (result.halted) return;
        const targetIndex = result.requireTargetIndex ?? 0;
        const selectedTarget = context.targets?.[targetIndex] ?? (targetIndex === 0 ? context.target : undefined);
        if (result.requireEffectChoice && !context.effectId) {
            result.requireEffectChoice.filter(choice => !choice.disabled).forEach(choice => visit({ ...context, effectId: choice.id }, depth + 1));
        } else if (result.requirePawnPlacement) {
            const req = result.requirePawnPlacement;
            result.newState.players[req.playerIndex].pawnZones.forEach((zone, slot) => {
                if (req.slots ? !req.slots.includes(slot) : !!zone) return;
                for (const position of req.position ? [req.position] : [Position.ATTACK, Position.DEFENSE]) {
                    const pawnPlacements = [...(context.pawnPlacements ?? [])];
                    if (req.placementIndex !== undefined) pawnPlacements[req.placementIndex] = { slot, position };
                    visit({ ...context, ...(req.placementIndex === undefined ? { pawnPlacement: { slot, position } } : { pawnPlacements }) }, depth + 1);
                }
            });
        } else if (result.requireTarget && !selectedTarget) {
            fieldEntries(state).forEach(({ zone, target }) => {
                const type = target.type === 'land' ? 'action' : target.type;
                if (result.requireTarget !== 'any' && type !== result.requireTarget) return;
                const isOpponent = target.playerIndex !== playerIndex;
                if (result.requireTargetScope === 'active' && isOpponent || result.requireTargetScope === 'opponent' && !isOpponent) return;
                if (!canTargetWithEffect(zone.card)) return;
                if (result.requireTargetPosition === 'hidden' && zone.position !== Position.HIDDEN) return;
                if (result.requireTargetPosition === 'faceup' && zone.position === Position.HIDDEN) return;
                if (result.requireTargetFilter && !result.requireTargetFilter(zone.card)) return;
                const targets = [...(context.targets ?? [])];
                targets[targetIndex] = target;
                visit({ ...context, target: targets[0], targets }, depth + 1);
            });
        } else if (result.requireHandSelection && context.handIndex === undefined) {
            const req = result.requireHandSelection;
            const changedHand = result.newState.players[req.playerIndex].hand.map(card => card.instanceId).join('|')
                !== state.players[req.playerIndex].hand.map(card => card.instanceId).join('|');
            result.newState.players[req.playerIndex].hand.forEach((c, handIndex) => {
                if (!req.filter || req.filter(c)) visit({ ...context, handIndex, ...(changedHand ? { handSelectionId: c.instanceId } : {}) }, depth + 1);
            });
        } else if (result.requirePeekSelection && context.peekIndex === undefined) {
            const req = result.requirePeekSelection;
            state.players[req.playerIndex].hand.forEach((_c, peekIndex) => visit({ ...context, peekIndex }, depth + 1));
        } else if (result.requireShuffleSelection && !context.shuffleCardIds) {
            const req = result.requireShuffleSelection;
            const cardIds = cardsAtLocation(state.players[req.playerIndex], req.location, state)
                .filter(entry => req.filter(entry.card)).map(entry => entry.card.instanceId);
            combinations(cardIds, req.count).forEach(shuffleCardIds => visit({ ...context, shuffleCardIds }, depth + 1));
        } else if (result.requireLevelTribute && !context.materialIds) {
            levelTributeChoices(state, result.requireLevelTribute).forEach(materialIds => visit({ ...context, materialIds }, depth + 1));
        } else if (result.requireReserveSelection && context.reserveIndex === undefined) {
            const req = result.requireReserveSelection;
            state.players[req.playerIndex].reserve.forEach((card, reserveIndex) => {
                if (req.filter(card)) visit({ ...context, reserveIndex }, depth + 1);
            });
        } else if (result.requireEffectTribute && !context.tributeIndices) {
            const req = result.requireEffectTribute;
            const indices = state.players[req.playerIndex].pawnZones.flatMap((z, i) => z && (!req.filter || req.filter(z.card)) ? [i] : []);
            combinations(indices, req.count).forEach(tributeIndices => visit({ ...context, tributeIndices }, depth + 1));
        } else if (result.requireDiscardSelection) {
            const req = result.requireDiscardSelection;
            state.players[req.playerIndex].discard.forEach((c, discardIndex) => {
                if (!req.filter(c)) return;
                const discardCardIds = [...(context.discardCardIds ?? [])];
                if (req.selectionIndex !== undefined) discardCardIds[req.selectionIndex] = c.instanceId;
                visit({ ...context, ...(req.selectionIndex === undefined ? { discardIndex } : { discardCardIds }) }, depth + 1);
            });
        } else if (result.requireDeckSelection && context.deckIndex === undefined) {
            const req = result.requireDeckSelection;
            state.players[req.playerIndex].deck.forEach((c, deckIndex) => {
                if (req.filter(c)) visit({ ...context, deckIndex }, depth + 1);
            });
        } else if (!needsChoice(result)) choices.push(context);
    };
    visit(resolutionContext ? { ...resolutionContext, execution: 'resolve' } : { card, playerIndex, battleAttacker: state.pendingReactions?.find(entry => entry.card.instanceId === card.instanceId && entry.trigger === trigger)?.battleAttacker }, 0);
    return choices;
}

export interface Activation { card: Card; trigger: EffectTrigger; slot: CardTarget }

export function handActivations(state: GameState, playerIndex: number): { card: Card; trigger: 'hand_activate' }[] {
    if (state.winner || state.openingCoin || state.pendingActivation || state.response || state.chain?.length
        || state.resolvingChain || state.pendingReactions?.length || state.pendingTriggers?.length
        || state.pendingHandSummons?.length || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length
        || state.attackReplay || state.activePlayerIndex !== playerIndex
        || ![Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase)) return [];
    return state.players[playerIndex].hand.flatMap(card => card.type === CardType.PAWN
        && cardRegistry.getEffect(card.id)?.onHandActivate && effectChoices(state, card, 'hand_activate', 1).length
        ? [{ card, trigger: 'hand_activate' as const }] : []);
}

export function fieldActivations(state: GameState, playerIndex: number, responding = false): Activation[] {
    if (isDrawingForTurn(state)) return [];
    if (state.pendingActivation) return [];
    if (state.winner || state.attackReplay || state.resolvingChain || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length) return [];
    const main = state.activePlayerIndex === playerIndex && [Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase);
    const pending = new Set(state.chain?.map(link => link.context.card.instanceId));
    return fieldEntries(state).filter(entry => entry.target.type === 'land' || entry.target.playerIndex === playerIndex).flatMap(({ zone, target: { type, index } }) => {
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
    });
}

/** Reserve usage and selections at announcement. Costs wait for this link to resolve. */
export function addChainLink(state: GameState, context: CardContext, trigger: EffectTrigger): GameState {
    return appendChainLink(state, context, trigger, false);
}

function appendChainLink(state: GameState, context: CardContext, trigger: EffectTrigger, buildingTriggers: boolean): GameState {
    if (isDrawingForTurn(state)) return state;
    if (isLand(context.card) && trigger === 'field_activate'
        && (context.playerIndex !== state.activePlayerIndex || ![Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase))) return state;
    if (state.pendingActivation) return state;
    if (state.winner || state.resolvingChain || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length || state.chain?.some(link => link.context.card.instanceId === context.card.instanceId)) return state;
    if (trigger === 'summon' && !cardRegistry.getEffect(context.card.id)?.onSummon) return state;
    if (trigger === 'hand_activate' && !handActivations(state, context.playerIndex).some(entry => entry.card.instanceId === context.card.instanceId)) return state;
    if (['switch', 'battle_destroyed', 'destroyed', 'attack_completed', 'sent_discard', 'hand_return'].includes(trigger) && !state.pendingReactions?.some(entry => entry.card.instanceId === context.card.instanceId && entry.playerIndex === context.playerIndex && entry.trigger === trigger)) return state;
    if (!buildingTriggers && state.response && state.response.priority !== context.playerIndex) return state;
    if (!buildingTriggers && state.response && !fieldActivations(state, context.playerIndex, true).some(a => a.card.instanceId === context.card.instanceId && a.trigger === trigger)) return state;
    const effect = cardRegistry.getEffect(context.card.id);
    const eligibility = trigger === 'hand_activate' ? effect?.canActivateFromHand : trigger === 'hand_return' ? undefined : effect?.canActivate;
    if (trigger !== 'phase' && eligibility && !eligibility(state, context)) return state;
    if (effect?.targetsAtResolution) {
        if (!effectChoices(state, context.card, trigger, 1).length) return state;
        context = { ...context, target: undefined, targets: undefined };
    }
    const peek = runEffect(state, effect?.targetsAtResolution ? { ...context, execution: 'reserve' } : context, trigger);
    if (peek.halted || needsChoice(peek)) return state;
    const reserved = runEffect(state, { ...context, execution: 'reserve' }, trigger);
    if (reserved.halted || needsChoice(reserved)) return state;
    let next = structuredClone(reserved.newState);
    const p = next.players[context.playerIndex];
    if (['summon', 'switch', 'battle_destroyed', 'destroyed', 'attack_completed', 'sent_discard', 'hand_return'].includes(trigger)) {
        const index = next.pendingReactions?.findIndex(entry => entry.card.instanceId === context.card.instanceId && entry.trigger === trigger) ?? -1;
        if (index >= 0) next.pendingReactions!.splice(index, 1);
    }
    if (trigger === 'hand_activate') {
        next.peekEvents = [...(next.peekEvents ?? []), { id: `${context.card.instanceId}:activation:${state.turnNumber}`,
            card: { ...context.card }, ownerPlayerIndex: context.playerIndex,
            viewerPlayerIndex: 1 - context.playerIndex, kind: 'hand_activation' }];
        next.log = [`${p.name} revealed "${context.card.name}" and activated its effect from hand.`, ...next.log].slice(0, 50);
    }
    const tributeCards = context.materialIds
        ? levelTributeCandidates(state, context.playerIndex).filter(entry => context.materialIds!.includes(entry.card.instanceId)).map(entry => entry.card)
        : context.tributeIndices?.flatMap(i => state.players[context.playerIndex].pawnZones[i]?.card ?? []) ?? [];
    const source = sourceZone(next, context);
    if (source && context.card.type !== CardType.PAWN) source.position = Position.FACE_UP;
    const targets = context.targets ?? (context.target ? [context.target] : []);
    const target = targets[0];
    const link: ChainLink = {
        sourceHandId: trigger === 'hand_activate' ? context.card.instanceId : undefined,
        tributeIds: tributeCards.map(card => card.instanceId),
        handId: context.handSelectionId ? p.hand.find(card => card.instanceId === context.handSelectionId)?.instanceId
            : context.handIndex !== undefined ? state.players[context.playerIndex].hand[context.handIndex]?.instanceId : undefined,
        context: { ...context, target, targets, tributeCards }, trigger,
        targetId: target ? targetZone(state, target)?.card.instanceId : undefined,
        targetIds: targets.map(selected => selected
            ? targetZone(state, selected)?.card.instanceId
            : undefined),
        discardId: context.discardIndex === undefined ? undefined : state.players[context.playerIndex].discard[context.discardIndex]?.instanceId,
        deckId: context.deckIndex === undefined ? undefined : state.players[context.playerIndex].deck[context.deckIndex]?.instanceId,
        reserveId: context.reserveIndex === undefined ? undefined : state.players[context.playerIndex].reserve[context.reserveIndex]?.instanceId,
        peekCardId: context.peekIndex === undefined ? undefined : state.players[1 - context.playerIndex].hand[context.peekIndex]?.instanceId,
    };
    next.chain = [...(state.chain ?? []), link];
    // An accepted activation interrupts the End Phase request; the turn player can reconsider.
    if (state.deferredAction?.kind === 'end') next.deferredAction = undefined;
    next.pendingResponse = undefined;
    next.response = { priority: 1 - context.playerIndex, passes: 0, reason: `${context.card.name} activated`, timing: 'activation' };
    next = notifyFieldEvent(next, 'onEffectActivated', { activatedCard: context.card, activatingPlayerIndex: context.playerIndex });
    next = checkVictory(notifyAttachedActivation(state, next, context.card));
    return buildingTriggers ? next : autoPass(next);
}

export interface SimultaneousTrigger {
    context: CardContext;
    trigger: Extract<EffectTrigger, 'summon' | 'phase' | 'discard' | 'tribute' | 'battle_destroy'>;
    mandatory: boolean;
    /** Optional effects are included only after their controller accepts them. */
    accepted?: boolean;
}

/** Submit one event's eligible triggers with completed choices. Never resolve between groups. */
export function addSimultaneousTriggers(state: GameState, triggers: SimultaneousTrigger[]): GameState {
    if (state.winner || state.chain?.length || state.response) return state;
    const rank = (entry: SimultaneousTrigger) => (entry.mandatory ? 0 : 2)
        + (entry.context.playerIndex === state.activePlayerIndex ? 0 : 1);
    // Stable ordering preserves the caller's ordering within each group.
    const ordered = triggers.filter(entry => entry.mandatory || entry.accepted)
        .sort((a, b) => rank(a) - rank(b));
    let next = state;
    for (const entry of ordered) {
        next = appendChainLink(next, entry.context, entry.trigger, true);
        if (next.winner) break;
    }
    return autoPass(next);
}

export function resolveChain(state: GameState, chooseTargets?: (state: GameState, link: ChainLink) => CardTarget[]): GameState {
    if (state.pendingActivation) return state;
    let next = state;
    while (next.chain?.length && !next.winner && !next.pendingVoidReturns?.length && !next.pendingVoidSelections?.length) {
        const before = next;
        next = next.pendingChainTarget && chooseTargets
            ? resolveChainStep(next, chooseTargets(next, next.chain.at(-1)!)) : resolveChainStep(next);
        if (next === before || next.pendingChainTarget && !chooseTargets) break;
    }
    if (next.pendingVoidReturns?.length || next.pendingVoidSelections?.length) return next;
    return next.winner ? { ...next, chain: [], resolvingChain: undefined, response: undefined } : next;
}

/** Automatic triggers form a new chain; they never interrupt cost payment or combat. */
export function startPendingTriggers(state: GameState): GameState {
    if (isDrawingForTurn(state)) return state;
    if (state.pendingActivation) return state;
    if (!state.pendingTriggers?.length || state.pendingReactions?.length || state.chain?.length || state.response || state.deferredAction
        || state.winner || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length) return state;
    return addSimultaneousTriggers({ ...state, pendingTriggers: [] },
        state.pendingTriggers.map(entry => ({ ...entry, mandatory: true })));
}

/** Resolve one link so the host can display each resulting board state. */
export function resolveChainStep(state: GameState, selectedTargets?: CardTarget[]): GameState {
    if (state.pendingActivation || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length) return state;
    if (state.pendingChainTarget && !selectedTargets) return state;
    const link = state.chain?.at(-1);
    if (!link) return state;
    let next = selectedTargets ? { ...state, pendingChainTarget: undefined } : state;
    if (!next.winner) {
        const context = { ...link.context, handIndex: undefined, execution: 'resolve' as const };
        const effect = cardRegistry.getEffect(context.card.id);
        if (effect?.targetsAtResolution) {
            if (selectedTargets?.length) {
                context.targets = selectedTargets;
                context.target = selectedTargets[0];
                const preview = runEffect(next, context, link.trigger);
                if (preview.halted || needsChoice(preview)) return state;
            } else if (!selectedTargets && effectChoices(next, context.card, link.trigger, 1, context).length) {
                return { ...next, pendingChainTarget: true };
            }
        }
        const p = next.players[context.playerIndex];
        let invalid = false;
        if (link.sourceHandId) invalid ||= !p.hand.some(card => card.instanceId === link.sourceHandId);
        if (link.handId) { context.handIndex = p.hand.findIndex(card => card.instanceId === link.handId); invalid ||= context.handIndex < 0; }
        if (link.tributeIds?.length) context.tributeIndices = link.tributeIds.map(id => p.pawnZones.findIndex(zone => zone?.card.instanceId === id));
        const targets = context.targets ?? (context.target ? [context.target] : []);
        if (targets.length && !effect?.targetsAtResolution) {
            context.targets = targets.map((target, targetIndex) => {
                const id = link.targetIds?.[targetIndex] ?? (targetIndex === 0 ? link.targetId : undefined);
                const index = targetZones(next, target).findIndex(z => z?.card.instanceId === id);
                if (index < 0) invalid = true;
                return { ...target, index };
            });
            context.target = context.targets[0];
        }
        if (link.discardId) { context.discardIndex = p.discard.findIndex(c => c.instanceId === link.discardId); invalid ||= context.discardIndex < 0; }
        if (link.deckId) { context.deckIndex = p.deck.findIndex(c => c.instanceId === link.deckId); invalid ||= context.deckIndex < 0; }
        if (link.reserveId) { context.reserveIndex = p.reserve.findIndex(c => c.instanceId === link.reserveId); invalid ||= context.reserveIndex < 0; }
        if (link.peekCardId) {
            context.peekIndex = next.players[1 - context.playerIndex].hand.findIndex(c => c.instanceId === link.peekCardId);
            invalid ||= context.peekIndex < 0;
        }
        const before = next;
        const paid = runEffect(next, { ...context, execution: 'costs' }, link.trigger);
        const costFailed = paid.halted || needsChoice(paid);
        if (!costFailed) next = paid.newState;
        const result = costFailed || invalid && !effect?.allowMissingTargets ? undefined : runEffect(next, context, link.trigger);
        const fizzled = !result || result.halted || needsChoice(result);
        next = finishEffect(fizzled ? next : result.newState, context.card,
            costFailed ? `"${context.card.name}" resolved without effect: its cost can no longer be paid.`
                : formatEffectLog(before, fizzled ? next : result.newState, context.card, context, link.trigger, context.tributeCards)
                    + (fizzled ? ' Resolved without effect: its selection is no longer valid.' : ''));
    }
    const remaining = state.chain!.slice(0, -1);
    next = queueEventResponses(state, next);
    if (!remaining.length && !next.winner && !next.pendingResponse) next = { ...next, pendingResponse: { timing: 'chain_resolved', reason: 'Chain resolved' } };
    const finished = { ...next, chain: remaining, resolvingChain: remaining.length && !next.winner
        ? { total: state.resolvingChain?.total ?? state.chain!.length, current: (state.resolvingChain?.current ?? 0) + 1, cardName: remaining.at(-1)!.context.card.name }
        : undefined, response: remaining.length && !next.winner ? state.response
        : next.deferredAction && !next.winner ? { ...next.pendingResponse!, priority: next.activePlayerIndex, passes: 0 } : undefined };
    return startPendingTriggers(next.deferredAction && !remaining.length ? autoPass({ ...finished, pendingResponse: undefined }) : finished);
}

function beginChainResolution(state: GameState): GameState {
    if (!state.chain?.length) return { ...state, response: state.deferredAction ? { ...state.response!, ready: true } : undefined };
    return { ...state, resolvingChain: { total: state.chain.length, current: 1, cardName: state.chain.at(-1)!.context.card.name } };
}

export function passPriority(state: GameState): GameState {
    if (state.pendingActivation) return state;
    if (!state.response || state.response.ready || state.winner || state.resolvingChain || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length) return state;
    const response = { ...state.response, passes: state.response.passes + 1, priority: 1 - state.response.priority };
    return response.passes >= 2 ? beginChainResolution({ ...state, response }) : autoPass({ ...state, response });
}

/** Empty windows never create a popup. Two consecutive passes close the chain. */
export function autoPass(state: GameState): GameState {
    if (state.pendingActivation) return state;
    if (state.pendingVoidReturns?.length || state.pendingVoidSelections?.length) return state;
    let next = state;
    for (let i = 0; i < 2 && next.response && !next.response.ready && !next.winner && !next.resolvingChain; i++) {
        if (fieldActivations(next, next.response.priority, true).length) break;
        const response = { ...next.response, passes: next.response.passes + 1, priority: 1 - next.response.priority };
        next = response.passes >= 2 ? beginChainResolution({ ...next, response }) : { ...next, response };
    }
    return next;
}

export function openResponse(state: GameState, action: NonNullable<GameState['deferredAction']>, reason: string,
    timing: ResponseTiming = action.kind === 'attack' ? 'attack' : state.currentPhase === Phase.END ? 'turn_end' : 'phase_exit'): GameState {
    if (isDrawingForTurn(state) || state.response || state.winner || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length) return state;
    return autoPass({ ...state, pendingResponse: undefined, deferredAction: action, chain: [], response: { priority: 1 - state.activePlayerIndex, passes: 0, reason, timing } });
}

/** Detect events from committed board changes, including summons performed by any card. */
export function queueEventResponses(before: GameState, after: GameState): GameState {
    if (before === after || after.winner) return after;
    // End Phase maintenance also catches counters earned after phase entry.
    if (after.currentPhase === Phase.END) {
        const pending = [...(after.pendingTriggers ?? [])];
        for (const { zone, target: { playerIndex } } of fieldEntries(after)) {
            if (!zone || zone.position === Position.HIDDEN
                || pending.some(entry => entry.trigger === 'phase' && entry.context.card.instanceId === zone.card.instanceId)
                || after.chain?.some(entry => entry.trigger === 'phase' && entry.context.card.instanceId === zone.card.instanceId)) continue;
            const handler = cardRegistry.getEffect(zone.card.id)?.onPhaseChange;
            const context = { card: zone.card, playerIndex };
            if (handler && !handler(after, context).halted) pending.push({ context, trigger: 'phase' });
        }
        if (pending.length) after = { ...after, pendingTriggers: pending };
    }
    const fieldIds = new Set(before.players.flatMap(player => player.pawnZones.flatMap(zone => zone ? [zone.card.instanceId] : [])));
    const summoned = after.players.flatMap((player, playerIndex) => player.pawnZones.flatMap(zone =>
        zone && zone.position !== Position.HIDDEN && !fieldIds.has(zone.card.instanceId) ? [{ card: zone.card, playerIndex }] : []));
    if (summoned.length) {
        for (const { card, playerIndex } of summoned) {
            const zone = after.players[playerIndex].pawnZones.find(value => value?.card.instanceId === card.instanceId);
            const handler = zone?.specialSummoned && cardRegistry.getEffect(card.id)?.onSpecialSummon;
            if (handler) after = handler(after, { card, playerIndex }).newState;
        }
        return { ...after, pendingResponse: { timing: 'summon', reason: summoned.map(entry => entry.card.name).join(', ') + ' summoned' } };
    }
    if (before.currentPhase !== after.currentPhase || before.turnNumber !== after.turnNumber) {
        if (after.currentPhase === Phase.DRAW) return { ...after, pendingResponse: undefined };
        return { ...after, pendingResponse: { timing: 'phase_entry', reason: `Entered ${after.currentPhase}` } };
    }
    return after;
}

/** Trigger decisions and full chain resolution always precede optional quick effects. */
export function startPendingResponse(state: GameState): GameState {
    if (isDrawingForTurn(state)) return state;
    if (!state.pendingResponse || state.response || state.chain?.length || state.deferredAction || state.pendingActivation
        || state.resolvingChain || state.pendingReactions?.length || state.pendingTriggers?.length || state.pendingHandSummons?.length
        || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length || state.attackReplay || state.openingCoin || state.winner) return state;
    return autoPass({ ...state, pendingResponse: undefined, chain: [], response: {
        ...state.pendingResponse, priority: state.activePlayerIndex, passes: 0,
    } });
}
