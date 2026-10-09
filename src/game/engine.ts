import { activeLand, hasLand, isLand, sourceZone } from './field';
import { handSummonCandidates, notifyPawnSummoned } from './summonReactions';
import { canTributeForSummon, isToken, isReservePawn, canPawnAttack, canAttackDirectly } from './cardHelpers';
import { Card, CardContext, CardTarget, CardType, EffectTrigger, GameState, Phase, Player, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { addChainLink, autoPass, effectChoices, fieldActivations, openResponse, passPriority, queueEventResponses, resolveChainStep, runEffect, startPendingTriggers } from './chains';
import { destroyOrphanedAttachments, notifyAttachedActivation } from './attachments';
import { finishEffect } from './finishEffect';
import { formatSummonLog } from './effectLog';
import { resolveCombat } from './combat';
import { advancePhaseState, isDrawingForTurn, stepDraw } from './phases';
import { sendToOwnerPile } from './cardOwnership';
import { queueRevealedSwitches } from './switches';
import { prepareVoidReturn } from './voidReturns';
import { isAwaitingDecision } from './decisions';
import '../cards/pawns';
import '../cards/actions';
import '../cards/conditions';

export type GameCommand =
    | { type: 'chooseTurnOrder'; order: 'first' | 'second' }
    | { type: 'voidSelection'; sourceId: string; cardId: string }
    | { type: 'placeVoidReturn'; cardId: string; slot: number }
    | { type: 'summon'; cardId: string; hidden: boolean; slot: number; tributes?: number[] }
    | { type: 'play'; cardId: string; set: boolean; slot: number }
    | { type: 'position'; index: number }
    | { type: 'activate'; context: CardContext; trigger: EffectTrigger }
    | { type: 'cancelEffect'; cardId: string }
    | { type: 'chainTargets'; targets: CardTarget[] }
    | { type: 'attack'; attackerIndex: number; targetIndex: number | 'direct' }
    | { type: 'attackReplay'; retry: boolean }
    | { type: 'confirmHandSummon'; sourceId: string; cardId: string; slot: number; position: Position }
    | { type: 'declineHandSummon'; sourceId: string }
    | { type: 'phase' | 'end' | 'pass' };

/** Host commands advance automatic rules; players cannot submit them as game commands. */
export type SystemCommand = { type: 'draw' | 'completeDeferred' | 'landCoin' };
export type GameEvent = { type: 'destroyed'; playerIndex: number; index: number; card: Card };
export interface Transition { state: GameState; events: GameEvent[] }

export function createGame(players: [
    { id: string; name: string; deck: Card[]; reserve?: Card[]; deckName?: string },
    { id: string; name: string; deck: Card[]; reserve?: Card[]; deckName?: string }
], coinWinner?: 0 | 1): GameState {
    const makePlayer = (input: typeof players[number]): Player => ({
        ...structuredClone(input), lp: 800, initialDeck: structuredClone(input.deck),
        deck: structuredClone(input.deck.slice(5)), hand: structuredClone(input.deck.slice(0, 5)),
        reserve: structuredClone(input.reserve ?? []),
        discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null),
        normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [],
    });
    return { players: [makePlayer(players[0]), makePlayer(players[1])], activePlayerIndex: 0,
        ...(coinWinner === undefined ? {} : { openingCoin: { winnerIndex: coinWinner, stage: 'flipping' as const } }),
        currentPhase: Phase.DRAW, turnNumber: 1, winner: null, pendingEffects: [], landStack: [],
        log: ['Turn 1', `Duel initialized. ${players[0].name}: ${players[0].deckName ?? 'Random test deck'}; ${players[1].name}: ${players[1].deckName ?? 'Random test deck'}.`] };
}

const isMain = (state: GameState, actor: number) => !state.pendingActivation && !state.openingCoin && !state.winner && !state.response && !state.pendingVoidReturns?.length && !state.pendingVoidSelections?.length && !state.pendingReactions?.length && !state.pendingHandSummons?.length
    && actor === state.activePlayerIndex && [Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase);
const validSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < 5;

export function canChangePosition(state: GameState, actor: number, index: number): boolean {
    const zone = state.players[actor]?.pawnZones[index];
    return isMain(state, actor) && !!zone && !zone.hasAttacked && !zone.hasChangedPosition && zone.summonedTurn !== state.turnNumber
        && (cardRegistry.getEffect(zone.card.id)?.canManuallyChangePosition?.(state, { card: zone.card, playerIndex: actor }, zone) ?? true);
}

export function canAttack(state: GameState, actor: number, index: number): boolean {
    const zone = state.players[actor]?.pawnZones[index];
    return !state.pendingActivation && !state.openingCoin && !state.winner && !state.response && !state.pendingVoidReturns?.length && !state.pendingVoidSelections?.length && !state.pendingReactions?.length && !state.pendingHandSummons?.length && state.activePlayerIndex === actor && state.currentPhase === Phase.BATTLE
        && state.turnNumber > 1 && !!zone && zone.position === Position.ATTACK
        && (!state.attackReplay || state.attackReplay.choosingTarget && state.attackReplay.attackerId === zone.card.instanceId)
        && (zone.attacksRemaining !== undefined ? zone.attacksRemaining > 0 : !zone.hasAttacked) && canPawnAttack(state, actor, zone);
}

export function canPlayCard(state: GameState, card: Card): boolean {
    const actor = state.activePlayerIndex, player = state.players[actor];
    if (!isMain(state, actor) || !player.hand.some(c => c.instanceId === card.instanceId)) return false;
    if (isReservePawn(card)) return false;
    if (isLand(card)) return !hasLand(state, card);
    if (card.type === CardType.PAWN) return card.level <= 4
        ? player.pawnZones.includes(null) && (!player.normalSummonUsed || !player.hiddenSummonUsed)
        : player.pawnZones.filter(z => z && canTributeForSummon(z.card, card)).length >= (card.level <= 7 ? 1 : 2);
    const effect = cardRegistry.getEffect(card.id);
    return player.actionZones.includes(null) && (card.type === CardType.CONDITION || !effect?.canActivate || effect.canActivate(state, { card, playerIndex: actor }));
}

export const previewEffect = (state: GameState, context: CardContext, trigger: EffectTrigger) => runEffect(state,
    cardRegistry.getEffect(context.card.id)?.targetsAtResolution && context.execution !== 'resolve'
        ? { ...context, target: undefined, targets: undefined, execution: 'reserve' } : context, trigger);

function reduceCommand(state: GameState, actor: number, command: GameCommand): GameState {
    if (state.winner || !state.players[actor]) return state;
    if (command.type === 'chooseTurnOrder') {
        if (state.openingCoin?.stage !== 'choosing' || state.openingCoin.winnerIndex !== actor
            || !['first', 'second'].includes(command.order)) return state;
        const first = command.order === 'first' ? actor : 1 - actor;
        return { ...state, openingCoin: undefined, activePlayerIndex: first,
            log: [`${state.players[actor].name} won the coin flip and chose to go ${command.order}. ${state.players[first].name} starts.`, ...state.log] };
    }
    if (state.openingCoin) return state;
    if (state.pendingVoidReturns?.length && command.type !== 'placeVoidReturn') return state;
    if (state.attackReplay && !['attackReplay', 'attack'].includes(command.type)) return state;
    if (state.pendingVoidSelections?.length && command.type !== 'voidSelection') return state;
    if (state.pendingHandSummons?.length && !['confirmHandSummon', 'declineHandSummon', 'activate', 'pass', 'cancelEffect', 'voidSelection'].includes(command.type)) return state;
    const player = state.players[actor];
    switch (command.type) {
        case 'placeVoidReturn': {
            const entry = state.pendingVoidReturns?.[0];
            if (!entry || actor !== entry.playerIndex || command.cardId !== entry.cardId
                || !validSlot(command.slot) || player.pawnZones[command.slot]) return state;
            const index = player.void.findIndex(card => card.instanceId === entry.cardId);
            if (index < 0) return state;
            const next = structuredClone(state);
            const [card] = next.players[actor].void.splice(index, 1);
            next.players[actor].pawnZones[command.slot] = { card, position: entry.position,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false };
            next.pendingVoidReturns!.shift();
            next.log = [`"${card.name}" returned from the Void.`, ...next.log].slice(0, 50);
            prepareVoidReturn(next);
            return next;
        }
        case 'voidSelection': {
            const pending = state.pendingVoidSelections?.[0];
            if (!pending || pending.playerIndex !== actor || pending.source.instanceId !== command.sourceId) return state;
            const index = state.players[pending.pilePlayerIndex].discard.findIndex(card => card.instanceId === command.cardId);
            if (index < 0) return state;
            const next = structuredClone(state);
            const [card] = next.players[pending.pilePlayerIndex].discard.splice(index, 1);
            sendToOwnerPile(next, card, 'void');
            next.pendingVoidSelections = next.pendingVoidSelections!.slice(1)
                .filter(request => next.players[request.pilePlayerIndex].discard.length);
            next.log = [`"${pending.source.name}" sends "${card.name}" from the Discard Pile to the Void.`, ...next.log].slice(0, 50);
            return startPendingTriggers(autoPass(notifyAttachedActivation(state, next, pending.source)));
        }
        case 'declineHandSummon': {
            const pending = state.pendingHandSummons?.[0];
            if (!pending || state.response || state.resolvingChain || pending.playerIndex !== actor || pending.sourceId !== command.sourceId) return state;
            return { ...state, pendingHandSummons: state.pendingHandSummons!.slice(1) };
        }
        case 'confirmHandSummon': {
            const pending = state.pendingHandSummons?.[0];
            if (!pending || state.response || state.resolvingChain || pending.playerIndex !== actor || pending.sourceId !== command.sourceId
                || !validSlot(command.slot) || player.pawnZones[command.slot]
                || ![Position.ATTACK, Position.DEFENSE].includes(command.position)) return state;
            const source = [...player.pawnZones, ...player.actionZones].find(zone => zone?.card.instanceId === pending.sourceId && zone.position !== Position.HIDDEN);
            const card = player.hand.find(candidate => candidate.instanceId === command.cardId);
            if (!source || !card || !handSummonCandidates(state, pending).some(candidate => candidate.instanceId === card.instanceId)) return state;
            const next = structuredClone(state), own = next.players[actor];
            own.hand = own.hand.filter(candidate => candidate.instanceId !== card.instanceId);
            own.pawnZones[command.slot] = { card: { ...card }, position: command.position,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false };
            next.pendingHandSummons = next.pendingHandSummons!.slice(1);
            next.log = [`"${card.name}" was special summoned by "${source.card.name}".`, ...next.log].slice(0, 50);
            return notifyAttachedActivation(state, next, source.card);
        }
        case 'summon': {
            if (!isMain(state, actor) || !validSlot(command.slot)) return state;
            const card = player.hand.find(c => c.instanceId === command.cardId);
            if (!card || card.type !== CardType.PAWN || isReservePawn(card)) return state;
            const tributes = command.tributes ?? [];
            const required = card.level <= 4 ? 0 : card.level <= 7 ? 1 : 2;
            if (tributes.length !== required || new Set(tributes).size !== required || tributes.some(i => !validSlot(i) || !player.pawnZones[i] || !canTributeForSummon(player.pawnZones[i]!.card, card))) return state;
            if (!required && (command.hidden ? player.hiddenSummonUsed : player.normalSummonUsed)) return state;
            if (player.pawnZones[command.slot] && !tributes.includes(command.slot)) return state;
            const next = structuredClone(state), p = next.players[actor];
            tributes.forEach(index => { sendToOwnerPile(next, p.pawnZones[index]!.card, 'discard'); p.pawnZones[index] = null; });
            p.pawnZones[command.slot] = { card: { ...card }, position: command.hidden ? Position.HIDDEN : Position.ATTACK,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: command.hidden };
            p.hand = p.hand.filter(c => c.instanceId !== card.instanceId);
            if (!required) { if (command.hidden) p.hiddenSummonUsed = true; else p.normalSummonUsed = true; }
            if (!command.hidden) next.log = [formatSummonLog(card), ...next.log].slice(0, 50);
            if (command.hidden) next.pendingResponse = { timing: 'minor_action', reason: 'A Pawn was set' };
            else if (cardRegistry.getEffect(card.id)?.onSummon) next.pendingReactions = [...(next.pendingReactions ?? []), { card, playerIndex: actor, trigger: 'summon' }];
            return destroyOrphanedAttachments(command.hidden ? next : notifyPawnSummoned(next, card, actor, required));
        }
        case 'play': {
            if (!isMain(state, actor)) return state;
            const card = player.hand.find(c => c.instanceId === command.cardId);
            if (!card || card.type === CardType.PAWN || !command.set && card.type === CardType.CONDITION) return state;
            if (isLand(card)) {
                if (command.set || hasLand(state, card)) return state;
                const next = structuredClone(state);
                next.landStack = [...(next.landStack ?? []), { card: { ...card }, position: Position.FACE_UP,
                    hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false }];
                next.players[actor].hand = next.players[actor].hand.filter(value => value.instanceId !== card.instanceId);
                next.pendingResponse = { timing: 'activation', reason: `${card.name} entered the Land Zone` };
                next.log = [`"${card.name}" became the active Land.`, ...next.log].slice(0, 50);
                return next;
            }
            if (!validSlot(command.slot) || player.actionZones[command.slot]) return state;
            const effect = cardRegistry.getEffect(card.id);
            if (!command.set && effect?.canActivate && !effect.canActivate(state, { card, playerIndex: actor })) return state;
            const next = structuredClone(state), p = next.players[actor];
            p.actionZones[command.slot] = { card: { ...card }, position: command.set ? Position.HIDDEN : Position.FACE_UP,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: command.set };
            p.hand = p.hand.filter(c => c.instanceId !== card.instanceId);
            if (command.set) next.pendingResponse = { timing: 'minor_action', reason: 'A card was set' };
            else if (!effect?.onActivate) next.pendingResponse = { timing: 'activation', reason: `${card.name} activated` };
            return next;
        }
        case 'position': {
            if (!canChangePosition(state, actor, command.index)) return state;
            const next = structuredClone(state), zone = next.players[actor].pawnZones[command.index]!;
            zone.position = zone.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
            zone.hasChangedPosition = true;
            return { ...next, pendingResponse: { timing: 'minor_action', reason: 'A Pawn changed position' } };
        }
        case 'activate': {
            if (command.context.playerIndex !== actor) return state;
            const source = isLand(command.context.card) ? activeLand(state) : sourceZone(state, command.context);
            if (source && source.card.instanceId !== command.context.card.instanceId) return state;
            if (source && !isLand(source.card) && ![...player.pawnZones, ...player.actionZones].includes(source)) return state;
            const pendingReaction = state.pendingReactions?.find(entry => entry.card.instanceId === command.context.card.instanceId && entry.playerIndex === actor && entry.trigger === command.trigger);
            if (!source && !pendingReaction) return state;
            const context = { ...command.context, card: source?.card ?? pendingReaction!.card };
            if (['switch', 'battle_destroyed', 'destroyed', 'attack_completed', 'sent_discard'].includes(command.trigger)) {
                if (!pendingReaction) return state;
            } else if (command.trigger === 'summon') {
                if (state.response || actor !== state.activePlayerIndex || source.position === Position.HIDDEN || source.summonedTurn !== state.turnNumber) return state;
            } else if (!fieldActivations(state, actor, !!state.response).some(a => a.card.instanceId === source.card.instanceId && a.trigger === command.trigger)) {
                // A newly played Action may have no onActivate (e.g. a Lingering Action).
                if (!(command.trigger === 'activate' && isMain(state, actor) && source.card.type === CardType.ACTION
                    && !isLand(source.card) && source.position !== Position.HIDDEN && source.summonedTurn === state.turnNumber)) return state;
            }
            return addChainLink(state, context, command.trigger);
        }
        case 'cancelEffect': {
            if (state.response) return state;
            const mandatory = state.pendingReactions?.find(entry => entry.card.instanceId === command.cardId && entry.playerIndex === actor);
            if (mandatory && cardRegistry.getEffect(mandatory.card.id)?.mandatoryReactions && effectChoices(state, mandatory.card, mandatory.trigger, 1).length) return state;
            if (state.pendingReactions?.some(entry => entry.card.instanceId === command.cardId && entry.playerIndex === actor)) return {
                ...state, pendingReactions: state.pendingReactions.filter(entry => entry.card.instanceId !== command.cardId)
            };
            const source = [...player.actionZones, activeLand(state)].find(z => z?.card.instanceId === command.cardId);
            return source ? finishEffect(state, source.card) : state;
        }
        case 'attackReplay': {
            if (!state.attackReplay || actor !== state.activePlayerIndex) return state;
            if (command.retry) return { ...state, attackReplay: { ...state.attackReplay, choosingTarget: true } };
            const next = structuredClone(state);
            const attacker = next.players[actor].pawnZones.find(zone => zone?.card.instanceId === state.attackReplay!.attackerId);
            if (attacker) {
                if (attacker.attacksRemaining !== undefined) attacker.attacksRemaining = Math.max(0, attacker.attacksRemaining - 1);
                attacker.hasAttacked = attacker.attacksRemaining === undefined || attacker.attacksRemaining <= 0;
            }
            next.attackReplay = undefined;
            return next;
        }
        case 'attack': {
            if (!canAttack(state, actor, command.attackerIndex)) return state;
            const attacker = player.pawnZones[command.attackerIndex]!;
            const opponent = state.players[1 - actor];
            const targetId = command.targetIndex === 'direct' ? 'direct' : opponent.pawnZones[command.targetIndex]?.card.instanceId;
            if (!targetId || targetId === 'direct' && !canAttackDirectly(state, actor, attacker.card)) return state;
            return openResponse({ ...state, attackReplay: undefined, attacksThisTurn: [...(state.attacksThisTurn ?? []).filter(event => event.turn === state.turnNumber), { turn: state.turnNumber, card: { ...attacker.card }, playerIndex: actor }] }, { kind: 'attack', attackerId: attacker.card.instanceId, targetId }, `${attacker.card.name} declares an attack`);
        }
        case 'pass': return state.response?.priority === actor ? passPriority(state) : state;
        case 'phase':
        case 'end': {
            if (actor !== state.activePlayerIndex || state.response || state.pendingReactions?.length || command.type === 'end' && state.currentPhase === Phase.END) return state;
            if (state.currentPhase === Phase.DRAW && state.turnNumber > 1
                && (state.drawProgress?.turn !== state.turnNumber || state.drawProgress.remaining > 0)) return state;
            const turnEnd = state.currentPhase === Phase.END;
            return openResponse(state, { kind: command.type }, turnEnd ? 'End of turn' : `Leave ${state.currentPhase}`, turnEnd ? 'turn_end' : 'phase_exit');
        }
    }
}

/** Rules-only state transition. Rejected commands retain the original state identity. */
export function applyCommand(state: GameState, actor: number, command: GameCommand): Transition {
    if (state.pendingChainTarget || command.type === 'chainTargets') {
        const link = state.chain?.at(-1);
        return { state: state.pendingChainTarget && link?.context.playerIndex === actor && command.type === 'chainTargets'
            ? resolveChainStep(state, command.targets) : state, events: [] };
    }
    if (state.pendingActivation) {
        const pending = state.pendingActivation;
        const cardId = command.type === 'activate' ? command.context.card.instanceId
            : command.type === 'cancelEffect' ? command.cardId : undefined;
        if (actor !== pending.playerIndex || cardId !== pending.cardId) return { state, events: [] };
        const unlocked = { ...state, pendingActivation: undefined };
        const next = reduceCommand(unlocked, actor, command);
        return { state: next === unlocked ? state : startPendingTriggers(queueEventResponses(unlocked, queueRevealedSwitches(unlocked, next))), events: [] };
    }
    const next = reduceCommand(state, actor, command);
    return { state: next === state ? state : startPendingTriggers(queueEventResponses(state, queueRevealedSwitches(state, next))), events: [] };
}

/** A local adapter or server drives these steps; animation delay is entirely its choice. */
export function applySystemCommand(state: GameState, command: SystemCommand): Transition {
    if (command.type === 'landCoin') return { state: state.openingCoin?.stage === 'flipping'
        ? { ...state, openingCoin: { ...state.openingCoin, stage: 'choosing' } } : state, events: [] };
    if (state.openingCoin) return { state, events: [] };
    if (state.winner || isAwaitingDecision(state)) return { state, events: [] };
    if (command.type === 'draw') {
        const next = stepDraw(state);
        const drew = next.players[next.activePlayerIndex].hand.length > state.players[state.activePlayerIndex].hand.length;
        return { state: drew && !next.winner && !isDrawingForTurn(next)
            ? { ...next, pendingResponse: { timing: 'draw', reason: 'Finished drawing for turn' } } : next, events: [] };
    }
    if (!state.response?.ready || !state.deferredAction) return { state, events: [] };
    const action = state.deferredAction;
    let next: GameState = { ...state, response: undefined, deferredAction: undefined, pendingResponse: undefined };
    if (action.kind === 'phase' || action.kind === 'end') {
        next = advancePhaseState(next, action.kind === 'end' ? Phase.END : undefined);
    } else if (action.kind === 'attack') {
        if (!action.battleStep) {
            const battle = openResponse(next, { ...action, battleStep: true }, 'Before battle damage', 'battle_step');
            if (!battle.response?.ready) return { state: battle, events: [] };
        }
        const actor = state.activePlayerIndex;
        const attacker = state.players[actor].pawnZones.findIndex(z => z?.card.instanceId === action.attackerId);
        const target = action.targetId === 'direct'
            ? attacker >= 0 && canAttackDirectly(next, actor, next.players[actor].pawnZones[attacker]!.card) ? 'direct' : -1
            : state.players[1 - actor].pawnZones.findIndex(z => z?.card.instanceId === action.targetId);
        if (attacker >= 0 && canAttack(next, actor, attacker) && target === -1) next.attackReplay = { attackerId: action.attackerId };
        if (attacker >= 0 && (target === 'direct' || target >= 0)) next = resolveCombat(next, attacker, target);
    }
    const events: GameEvent[] = [];
    if (action.kind === 'attack') state.players.forEach((p, playerIndex) => p.pawnZones.forEach((zone, index) => {
        if (zone && next.players[playerIndex].pawnZones[index]?.card.instanceId !== zone.card.instanceId
            && (isToken(zone.card) || next.players.some(player => player.discard.some(c => c.instanceId === zone.card.instanceId))
                || next.players.some(player => player.pawnZones.some(z => z?.card.instanceId === zone.card.instanceId)))) {
            events.push({ type: 'destroyed', playerIndex, index, card: zone.card });
        }
    }));
    if (action.kind === 'attack' && !next.winner && !next.attackReplay) next.pendingResponse = { timing: 'battle_step', reason: 'Battle finished' };
    return { state: startPendingTriggers(queueEventResponses(state, queueRevealedSwitches(state, next))), events };
}
