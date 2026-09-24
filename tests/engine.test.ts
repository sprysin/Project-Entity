import { expect, it, vi } from 'vitest';
// Importing the engine must not initialize React or any UI module.
vi.mock('react', () => { throw new Error('The rules engine must not import React'); });
import { applyCommand, applySystemCommand, createGame, GameCommand } from '../src/game/engine';
import { Card, GameState, Phase, Position } from '../src/types';
import { cardRegistry } from '../src/cards/CardRegistry';

let serial = 0;
const card = (id: string, player = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `engine-${serial++}`, ownerId: `player${player + 1}` });
const placed = (value: Card) => ({ card: value, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
const game = (): GameState => createGame([
    { id: 'player1', name: 'Player 1', deck: Array.from({ length: 12 }, () => card('pawn_01')) },
    { id: 'player2', name: 'Player 2', deck: Array.from({ length: 12 }, () => card('pawn_01', 1)) },
]);
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(freeze);
    }
    return value;
}
const command = (state: GameState, value: GameCommand, actor = state.activePlayerIndex) => applyCommand(state, actor, value).state;
const nextPhase = (state: GameState) => applySystemCommand(command(state, { type: 'phase' }), { type: 'completeDeferred' }).state;

it('runs opening turns, summons, and a winning attack with no React or timers', () => {
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
    state = applySystemCommand(state, { type: 'completeDeferred' }).state;
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
    const king = card('pawn_02');
    king.level = 8;
    state.players[0].hand = [king];
    state.players[0].pawnZones[0] = placed(card('pawn_01'));
    state.players[0].pawnZones[1] = placed(card('pawn_01'));
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
});

it('rechecks an attack target after responses and never hits a replacement in its old slot', () => {
    const state = game();
    state.currentPhase = Phase.BATTLE;
    state.turnNumber = 3;
    state.players[0].pawnZones[0] = placed(card('pawn_01'));
    state.players[1].pawnZones[0] = placed(card('pawn_04', 1));
    const announced = command(state, { type: 'attack', attackerIndex: 0, targetIndex: 0 });
    announced.players = structuredClone(announced.players);
    announced.players[1].pawnZones[0] = placed(card('pawn_01', 1));
    const result = applySystemCommand(freeze(announced), { type: 'completeDeferred' });
    expect(result.state.players[1].lp).toBe(800);
    expect(result.state.players[1].pawnZones[0]).toEqual(announced.players[1].pawnZones[0]);
    expect(result.events).toEqual([]);
    expect(result.state.response).toBeUndefined();
});
