import { Attribute, Card, CardContext, CardType, EffectTrigger, GameState, Phase, Player, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { addChainLink, fieldActivations, openResponse, passPriority, runEffect } from './chains';
import { destroyOrphanedAttachments } from './attachments';
import { finishEffect } from './finishEffect';
import { formatSummonLog } from './effectLog';
import { resolveCombat } from './combat';
import { advancePhaseState, stepDraw } from './phases';
import { sendToOwnerPile } from './cardOwnership';
import { queueRevealedSwitches } from './switches';
import '../cards/pawns';
import '../cards/actions';
import '../cards/conditions';

export type GameCommand =
    | { type: 'summon'; cardId: string; hidden: boolean; slot: number; tributes?: number[] }
    | { type: 'play'; cardId: string; set: boolean; slot: number }
    | { type: 'position'; index: number }
    | { type: 'activate'; context: CardContext; trigger: EffectTrigger }
    | { type: 'cancelEffect'; cardId: string }
    | { type: 'attack'; attackerIndex: number; targetIndex: number | 'direct' }
    | { type: 'frontlineSummon'; sourceId: string; cardId: string; slot: number; position: Position }
    | { type: 'frontlineDecline'; sourceId: string }
    | { type: 'phase' | 'end' | 'pass' };

/** Host commands advance automatic rules; players cannot submit them as game commands. */
export type SystemCommand = { type: 'draw' | 'completeDeferred' };
export type GameEvent = { type: 'destroyed'; playerIndex: number; index: number; card: Card };
export interface Transition { state: GameState; events: GameEvent[] }

export function createGame(players: [
    { id: string; name: string; deck: Card[]; deckName?: string },
    { id: string; name: string; deck: Card[]; deckName?: string }
]): GameState {
    const makePlayer = (input: typeof players[number]): Player => ({
        ...structuredClone(input), lp: 800, initialDeck: structuredClone(input.deck),
        deck: structuredClone(input.deck.slice(5)), hand: structuredClone(input.deck.slice(0, 5)),
        discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null),
        normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [],
    });
    return { players: [makePlayer(players[0]), makePlayer(players[1])], activePlayerIndex: 0,
        currentPhase: Phase.DRAW, turnNumber: 1, winner: null, pendingEffects: [],
        log: ['Turn 1', `Duel initialized. ${players[0].name}: ${players[0].deckName ?? 'Random test deck'}; ${players[1].name}: ${players[1].deckName ?? 'Random test deck'}.`] };
}

const isMain = (state: GameState, actor: number) => !state.winner && !state.response && !state.pendingSwitches?.length && !state.pendingFrontline?.length
    && actor === state.activePlayerIndex && [Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase);
const validSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < 5;

export function canChangePosition(state: GameState, actor: number, index: number): boolean {
    const zone = state.players[actor]?.pawnZones[index];
    return isMain(state, actor) && !!zone && !zone.hasAttacked && !zone.hasChangedPosition && zone.summonedTurn !== state.turnNumber;
}

export function canAttack(state: GameState, actor: number, index: number): boolean {
    const zone = state.players[actor]?.pawnZones[index];
    return !state.winner && !state.response && !state.pendingSwitches?.length && !state.pendingFrontline?.length && state.activePlayerIndex === actor && state.currentPhase === Phase.BATTLE
        && state.turnNumber > 1 && !!zone && zone.position === Position.ATTACK
        && (zone.attacksRemaining !== undefined ? zone.attacksRemaining > 0 : !zone.hasAttacked);
}

export function canPlayCard(state: GameState, card: Card): boolean {
    const actor = state.activePlayerIndex, player = state.players[actor];
    if (!isMain(state, actor) || !player.hand.some(c => c.instanceId === card.instanceId)) return false;
    if (card.type === CardType.PAWN) return card.level <= 4
        ? player.pawnZones.includes(null) && (!player.normalSummonUsed || !player.hiddenSummonUsed)
        : player.pawnZones.filter(Boolean).length >= (card.level <= 7 ? 1 : 2);
    const effect = cardRegistry.getEffect(card.id);
    return player.actionZones.includes(null) && (card.type === CardType.CONDITION || !effect?.canActivate || effect.canActivate(state, { card, playerIndex: actor }));
}

export const previewEffect = runEffect;

function reduceCommand(state: GameState, actor: number, command: GameCommand): GameState {
    if (state.winner || !state.players[actor]) return state;
    if (state.pendingFrontline?.length && !['frontlineSummon', 'frontlineDecline', 'activate', 'pass', 'cancelEffect'].includes(command.type)) return state;
    const player = state.players[actor];
    switch (command.type) {
        case 'frontlineDecline': {
            const pending = state.pendingFrontline?.[0];
            if (!pending || state.response || state.resolvingChain || pending.playerIndex !== actor || pending.sourceId !== command.sourceId) return state;
            return { ...state, pendingFrontline: state.pendingFrontline!.slice(1) };
        }
        case 'frontlineSummon': {
            const pending = state.pendingFrontline?.[0];
            if (!pending || state.response || state.resolvingChain || pending.playerIndex !== actor || pending.sourceId !== command.sourceId
                || !validSlot(command.slot) || player.pawnZones[command.slot]
                || ![Position.ATTACK, Position.DEFENSE].includes(command.position)) return state;
            const source = player.actionZones.find(zone => zone?.card.instanceId === pending.sourceId && zone.position !== Position.HIDDEN);
            const card = player.hand.find(candidate => candidate.instanceId === command.cardId);
            if (!source || source.card.id !== 'condition_06' || !card || card.type !== CardType.PAWN
                || card.attribute !== Attribute.LIGHT || card.level > 4) return state;
            const next = structuredClone(state), own = next.players[actor];
            own.hand = own.hand.filter(candidate => candidate.instanceId !== card.instanceId);
            own.pawnZones[command.slot] = { card: { ...card }, position: command.position,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: false };
            next.pendingFrontline = next.pendingFrontline!.slice(1);
            next.log = [`"${card.name}" was special summoned by "${source.card.name}".`, ...next.log].slice(0, 50);
            return next;
        }
        case 'summon': {
            if (!isMain(state, actor) || !validSlot(command.slot)) return state;
            const card = player.hand.find(c => c.instanceId === command.cardId);
            if (!card || card.type !== CardType.PAWN) return state;
            const tributes = command.tributes ?? [];
            const required = card.level <= 4 ? 0 : card.level <= 7 ? 1 : 2;
            if (tributes.length !== required || new Set(tributes).size !== required || tributes.some(i => !validSlot(i) || !player.pawnZones[i])) return state;
            if (!required && (command.hidden ? player.hiddenSummonUsed : player.normalSummonUsed)) return state;
            if (player.pawnZones[command.slot] && !tributes.includes(command.slot)) return state;
            const next = structuredClone(state), p = next.players[actor];
            tributes.forEach(index => { sendToOwnerPile(next, p.pawnZones[index]!.card, 'discard'); p.pawnZones[index] = null; });
            p.pawnZones[command.slot] = { card: { ...card }, position: command.hidden ? Position.HIDDEN : Position.ATTACK,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: command.hidden };
            p.hand = p.hand.filter(c => c.instanceId !== card.instanceId);
            if (!required) { if (command.hidden) p.hiddenSummonUsed = true; else p.normalSummonUsed = true; }
            if (!command.hidden) next.log = [formatSummonLog(card), ...next.log].slice(0, 50);
            if (required && !command.hidden) {
                const opponentIndex = 1 - actor;
                const opponent = next.players[opponentIndex];
                if (opponent.pawnZones.some(zone => !zone)
                    && opponent.hand.some(candidate => candidate.type === CardType.PAWN && candidate.attribute === Attribute.LIGHT && candidate.level <= 4)) {
                    next.pendingFrontline = [
                        ...(next.pendingFrontline ?? []),
                        ...opponent.actionZones.flatMap(zone => zone?.card.id === 'condition_06' && zone.position !== Position.HIDDEN
                            ? [{ sourceId: zone.card.instanceId, playerIndex: opponentIndex }] : [])
                    ];
                }
            }
            return destroyOrphanedAttachments(next);
        }
        case 'play': {
            if (!isMain(state, actor) || !validSlot(command.slot) || player.actionZones[command.slot]) return state;
            const card = player.hand.find(c => c.instanceId === command.cardId);
            if (!card || card.type === CardType.PAWN || !command.set && card.type === CardType.CONDITION) return state;
            const effect = cardRegistry.getEffect(card.id);
            if (!command.set && effect?.canActivate && !effect.canActivate(state, { card, playerIndex: actor })) return state;
            const next = structuredClone(state), p = next.players[actor];
            p.actionZones[command.slot] = { card: { ...card }, position: command.set ? Position.HIDDEN : Position.FACE_UP,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: state.turnNumber, isSetTurn: command.set };
            p.hand = p.hand.filter(c => c.instanceId !== card.instanceId);
            return next;
        }
        case 'position': {
            if (!canChangePosition(state, actor, command.index)) return state;
            const next = structuredClone(state), zone = next.players[actor].pawnZones[command.index]!;
            zone.position = zone.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
            zone.hasChangedPosition = true;
            return next;
        }
        case 'activate': {
            if (command.context.playerIndex !== actor) return state;
            const source = [...player.pawnZones, ...player.actionZones].find(z => z?.card.instanceId === command.context.card.instanceId);
            const pendingSwitch = command.trigger === 'switch' && state.pendingSwitches?.find(entry => entry.card.instanceId === command.context.card.instanceId && entry.playerIndex === actor);
            if (!source && !pendingSwitch) return state;
            const context = { ...command.context, card: source?.card ?? pendingSwitch!.card };
            if (command.trigger === 'switch') {
                if (!pendingSwitch) return state;
            } else if (command.trigger === 'summon') {
                if (state.response || actor !== state.activePlayerIndex || source.position === Position.HIDDEN || source.summonedTurn !== state.turnNumber) return state;
            } else if (!fieldActivations(state, actor, !!state.response).some(a => a.card.instanceId === source.card.instanceId && a.trigger === command.trigger)) {
                // A newly played Action may have no onActivate (e.g. a Lingering Action).
                if (!(command.trigger === 'activate' && isMain(state, actor) && source.card.type === CardType.ACTION
                    && source.position !== Position.HIDDEN && source.summonedTurn === state.turnNumber)) return state;
            }
            return addChainLink(state, context, command.trigger);
        }
        case 'cancelEffect': {
            if (state.response) return state;
            if (state.pendingSwitches?.some(entry => entry.card.instanceId === command.cardId)) return {
                ...state, pendingSwitches: state.pendingSwitches.filter(entry => entry.card.instanceId !== command.cardId)
            };
            const source = player.actionZones.find(z => z?.card.instanceId === command.cardId);
            return source ? finishEffect(state, source.card) : state;
        }
        case 'attack': {
            if (!canAttack(state, actor, command.attackerIndex)) return state;
            const attacker = player.pawnZones[command.attackerIndex]!;
            const opponent = state.players[1 - actor];
            const targetId = command.targetIndex === 'direct' ? 'direct' : opponent.pawnZones[command.targetIndex]?.card.instanceId;
            if (!targetId || targetId === 'direct' && opponent.pawnZones.some(Boolean)) return state;
            return openResponse(state, { kind: 'attack', attackerId: attacker.card.instanceId, targetId }, `${attacker.card.name} declares an attack`);
        }
        case 'pass': return state.response?.priority === actor ? passPriority(state) : state;
        case 'phase':
        case 'end': {
            if (actor !== state.activePlayerIndex || state.response || state.pendingSwitches?.length || command.type === 'end' && state.currentPhase === Phase.END) return state;
            if (state.currentPhase === Phase.DRAW && state.turnNumber > 1
                && (state.drawProgress?.turn !== state.turnNumber || state.drawProgress.remaining > 0)) return state;
            return openResponse(state, { kind: command.type }, command.type === 'phase' ? `Leave ${state.currentPhase}` : `Skip from ${state.currentPhase} to END`);
        }
    }
}

/** Rules-only state transition. Rejected commands retain the original state identity. */
export function applyCommand(state: GameState, actor: number, command: GameCommand): Transition {
    return { state: queueRevealedSwitches(state, reduceCommand(state, actor, command)), events: [] };
}

/** A local adapter or server drives these steps; animation delay is entirely its choice. */
export function applySystemCommand(state: GameState, command: SystemCommand): Transition {
    if (state.winner) return { state, events: [] };
    if (command.type === 'draw') return { state: stepDraw(state), events: [] };
    if (!state.response?.ready || !state.deferredAction) return { state, events: [] };
    const action = state.deferredAction;
    let next: GameState = { ...state, response: undefined, deferredAction: undefined };
    if (action.kind === 'phase') next = advancePhaseState(next);
    else if (action.kind === 'end') {
        for (let i = 0; i < 6 && next.currentPhase !== Phase.END && !next.winner; i++) next = advancePhaseState(next);
    } else if (action.kind === 'attack') {
        const actor = state.activePlayerIndex;
        const attacker = state.players[actor].pawnZones.findIndex(z => z?.card.instanceId === action.attackerId);
        const target = action.targetId === 'direct' ? 'direct' : state.players[1 - actor].pawnZones.findIndex(z => z?.card.instanceId === action.targetId);
        if (attacker >= 0 && (target === 'direct' || target >= 0)) next = resolveCombat(next, attacker, target);
    }
    const events: GameEvent[] = [];
    if (action.kind === 'attack') state.players.forEach((p, playerIndex) => p.pawnZones.forEach((zone, index) => {
        if (zone && next.players[playerIndex].pawnZones[index]?.card.instanceId !== zone.card.instanceId
            && (next.players.some(player => player.discard.some(c => c.instanceId === zone.card.instanceId))
                || next.players.some(player => player.pawnZones.some(z => z?.card.instanceId === zone.card.instanceId)))) {
            events.push({ type: 'destroyed', playerIndex, index, card: zone.card });
        }
    }));
    return { state: queueRevealedSwitches(state, next), events };
}
