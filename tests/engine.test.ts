import { expect, it, vi } from 'vitest';
// Importing the engine must not initialize React or any UI module.
vi.mock('react', () => { throw new Error('The rules engine must not import React'); });
import { applyCommand, applySystemCommand, createGame, GameCommand } from '../src/game/engine';
import { Card, GameState, Phase, Position } from '../src/types';
import { cardRegistry } from '../src/cards/CardRegistry';
import { passPriority, resolveChainStep, resolveChain, startPendingResponse } from '../src/game/chains';

let serial = 0;
const card = (id: string, player = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `engine-${serial++}`, ownerId: `player${player + 1}` });
const placed = (value: Card) => ({ card: value, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
const game = (): GameState => createGame([
    { id: 'player1', name: 'Player 1', deck: Array.from({ length: 12 }, () => card('P_Solstice_Sentinel')) },
    { id: 'player2', name: 'Player 2', deck: Array.from({ length: 12 }, () => card('P_Solstice_Sentinel', 1)) },
]);
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(freeze);
    }
    return value;
}
const command = (state: GameState, value: GameCommand, actor = state.activePlayerIndex) => applyCommand(state, actor, value).state;
// A headless host declines optional choices and drives every automatic timing step.
function settle(state: GameState): GameState {
    for (let i = 0; i < 40; i++) {
        const before = state;
        const reaction = state.pendingReactions?.[0];
        if (reaction && !state.response) state = command(state, { type: 'cancelEffect', cardId: reaction.card.instanceId }, reaction.playerIndex);
        else if (state.resolvingChain) state = resolveChainStep(state);
        else if (state.response && !state.response.ready) state = passPriority(state);
        else if (state.response?.ready) state = applySystemCommand(state, { type: 'completeDeferred' }).state;
        else if (state.pendingResponse) state = startPendingResponse(state);
        if (state === before) break;
    }
    return state;
}
const nextPhase = (state: GameState) => settle(command(settle(state), { type: 'phase' }));

it('runs opening turns, summons, and a winning attack with no React or timers', () => {
    for (const winnerIndex of [0, 1] as const) for (const order of ['first', 'second'] as const) {
        const pending = freeze({ ...game(), openingCoin: { winnerIndex, stage: 'flipping' as const } });
        expect(command(pending, { type: 'chooseTurnOrder', order }, winnerIndex)).toBe(pending);
        expect(nextPhase(pending)).toBe(pending);
        expect(applySystemCommand(pending, { type: 'draw' }).state).toBe(pending);
        const landed = applySystemCommand(pending, { type: 'landCoin' }).state;
        expect(command(landed, { type: 'chooseTurnOrder', order }, 1 - winnerIndex)).toBe(landed);
        const chosen = command(landed, { type: 'chooseTurnOrder', order }, winnerIndex);
        expect(chosen.openingCoin).toBeUndefined();
        expect(chosen.activePlayerIndex).toBe(order === 'first' ? winnerIndex : 1 - winnerIndex);
        expect(command(chosen, { type: 'chooseTurnOrder', order }, winnerIndex)).toBe(chosen);
        const main = nextPhase(nextPhase(applySystemCommand(chosen, { type: 'draw' }).state));
        expect(main.players[chosen.activePlayerIndex].hand).toHaveLength(5);
        expect(nextPhase(main).currentPhase).toBe(Phase.END);
        expect(nextPhase(nextPhase(main)).activePlayerIndex).toBe(1 - chosen.activePlayerIndex);
    }
    let state = freeze(game());
    expect(state.players[0].hand).toHaveLength(5);
    state = applySystemCommand(state, { type: 'draw' }).state;
    state = nextPhase(state);
    state = nextPhase(state);
    state = command(state, { type: 'summon', cardId: state.players[0].hand[0].instanceId, hidden: false, slot: 0 });
    state = nextPhase(state);
    expect(state.currentPhase).toBe(Phase.END); // First player cannot battle.
    state = nextPhase(state);
    expect(state.activePlayerIndex).toBe(1);
    expect(nextPhase(state)).toBe(state); // Required draw cannot be skipped.
    state = applySystemCommand(state, { type: 'draw' }).state;
    expect(state.players[1].hand).toHaveLength(6);
    state = nextPhase(state);
    state = nextPhase(state);
    state = command(state, { type: 'end' });
    state = settle(state);
    state = nextPhase(state);
    state = applySystemCommand(state, { type: 'draw' }).state;
    state = nextPhase(nextPhase(state));
    state = nextPhase(state);
    expect(state.currentPhase).toBe(Phase.BATTLE);
    state = { ...state, players: [state.players[0], { ...state.players[1], lp: 1 }] };
    const before = freeze(state);
    state = command(before, { type: 'attack', attackerIndex: 0, targetIndex: 'direct' });
    expect(state.players[1].lp).toBe(1); // Declaration opens responses; no damage yet.
    state = applySystemCommand(state, { type: 'completeDeferred' }).state;
    expect(state.winner).toBe('Player 1');
    expect(before.players[1].lp).toBe(1);
    expect(command(state, { type: 'phase' })).toBe(state);
});

it('rejects wrong actors, nonexistent cards, duplicate tributes, and occupied destinations without paying costs', () => {
    const state = game();
    state.currentPhase = Phase.MAIN1;
    state.turnNumber = 3;
    const king = card('P_High_King');
    king.level = 8;
    state.players[0].hand = [king];
    state.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel'));
    state.players[0].pawnZones[1] = placed(card('P_Solstice_Sentinel'));
    freeze(state);
    expect(command(state, { type: 'summon', cardId: king.instanceId, hidden: false, slot: 0, tributes: [0, 1] }, 1)).toBe(state);
    expect(command(state, { type: 'summon', cardId: 'missing', hidden: false, slot: 2 })).toBe(state);
    expect(command(state, { type: 'summon', cardId: king.instanceId, hidden: false, slot: 0, tributes: [0, 0] })).toBe(state);
    expect(command(state, { type: 'play', cardId: king.instanceId, set: false, slot: 0 })).toBe(state);
    const next = command(state, { type: 'summon', cardId: king.instanceId, hidden: false, slot: 0, tributes: [0, 1] });
    expect(next.players[0].discard).toHaveLength(2);
    expect(next.players[0].hand).toHaveLength(0);
    expect(next.players[0].pawnZones[0]?.card.instanceId).toBe(king.instanceId);
    expect(state.players[0].discard).toHaveLength(0);
    const waiting = freeze({ ...state, pendingActivation: { cardId: king.instanceId, playerIndex: 0 } });
    for (const actor of [0, 1]) {
        for (const value of [{ type: 'phase' }, { type: 'end' }, { type: 'pass' },
            { type: 'summon', cardId: king.instanceId, hidden: false, slot: 0, tributes: [0, 1] },
            { type: 'cancelEffect', cardId: 'another-card' }] as GameCommand[]) {
            expect(command(waiting, value, actor)).toBe(waiting);
        }
    }
    for (const type of ['draw', 'completeDeferred'] as const) expect(applySystemCommand(waiting, { type }).state).toBe(waiting);
    expect(resolveChainStep(waiting)).toBe(waiting);
    expect(resolveChain(waiting)).toBe(waiting);
});

it('rechecks an attack target after responses and never hits a replacement in its old slot', () => {
    const state = game();
    state.currentPhase = Phase.BATTLE;
    state.turnNumber = 3;
    state.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel'));
    state.players[1].pawnZones[0] = placed(card('P_Void_Caster', 1));
    const announced = command(state, { type: 'attack', attackerIndex: 0, targetIndex: 0 });
    announced.players = structuredClone(announced.players);
    announced.players[1].pawnZones[0] = placed(card('P_Solstice_Sentinel', 1));
    const result = applySystemCommand(freeze(announced), { type: 'completeDeferred' });
    expect(result.state.players[1].lp).toBe(800);
    expect(result.state.players[1].pawnZones[0]).toEqual(announced.players[1].pawnZones[0]);
    expect(result.events).toEqual([]);
    expect(result.state.response).toBeUndefined();
});
