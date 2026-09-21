import { expect, it, vi } from 'vitest';
// Importing the engine must not initialize React or any UI module.
vi.mock('react', () => { throw new Error('The rules engine must not import React'); });
import { applyCommand, applySystemCommand, createGame, GameCommand } from '../src/game/engine';
import { Card, GameState, Phase, Position } from '../src/types';
import { cardRegistry } from '../src/cards/CardRegistry';
import { simulateAttack, simulateSummon } from '../src/game/opponentAI';

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

it('uses the same summon and combat rules for AI simulation and committed play', () => {
    const state = game();
    state.currentPhase = Phase.MAIN1;
    state.turnNumber = 3;
    const pawn = state.players[0].hand[0];
    const summoned = command(state, { type: 'summon', cardId: pawn.instanceId, hidden: false, slot: 0 });
    expect(simulateSummon(state, pawn, false, [])).toEqual(summoned);
    const battle = { ...summoned, currentPhase: Phase.BATTLE };
    battle.players[1].pawnZones[0] = placed(card('pawn_04', 1));
    freeze(battle);
    const announced = command(battle, { type: 'attack', attackerIndex: 0, targetIndex: 0 });
    const result = applySystemCommand(announced, { type: 'completeDeferred' });
    expect(result.state).toEqual(simulateAttack(battle, 0, 0));
    expect(result.events).toMatchObject([{ type: 'destroyed', playerIndex: 1, index: 0 }]);
    expect(applySystemCommand(result.state, { type: 'completeDeferred' }).state).toBe(result.state);
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

it('owns draw counts in state and prevents duplicated draws after a completed Draw Phase', () => {
    let state = game();
    state.currentPhase = Phase.DRAW;
    state.turnNumber = 3;
    state.players[0].hand = [];
    state.players[0].normalSummonUsed = true;
    for (let i = 0; i < 5; i++) state = applySystemCommand(freeze(state), { type: 'draw' }).state;
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[0].normalSummonUsed).toBe(false);
    expect(applySystemCommand(state, { type: 'draw' }).state).toBe(state);
    expect(nextPhase(state).currentPhase).toBe(Phase.STANDBY);
});

it('resolves card activation and costs through the engine without mutating the caller', () => {
    const state = game();
    state.currentPhase = Phase.MAIN1;
    state.turnNumber = 3;
    const blast = card('action_01');
    state.players[0].hand = [blast];
    const played = command(freeze(state), { type: 'play', cardId: blast.instanceId, set: false, slot: 0 });
    const result = command(freeze(played), { type: 'activate', context: { card: blast, playerIndex: 0 }, trigger: 'activate' });
    expect(result.players[1].lp).toBe(750);
    expect(result.players[0].discard.map(c => c.instanceId)).toContain(blast.instanceId);
    expect(played.players[1].lp).toBe(800);
});
