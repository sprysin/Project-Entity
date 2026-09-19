import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { Card, GameState, Phase, Position } from '../src/types';
import { cardRegistry } from '../src/cards/CardRegistry';
import PlaytestSetup from '../src/components/PlaytestSetup';
import { GameOverlays } from '../src/components/game/GameOverlays';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let game: ReturnType<typeof useGameLogic>;
let root: ReturnType<typeof create>;
let serial = 0;
const card = (id: string, pi = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `integration-${serial++}`, ownerId: `player${pi + 1}` });
const zone = (card: Card, position = Position.ATTACK) => ({ card, position, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: position === Position.HIDDEN });
function Harness() {
    game = useGameLogic([null, null], 'ai');
    return game.gameState ? <GameOverlays gameState={game.gameState} activePlayer={game.gameState.players[0]} state={game.state} actions={game.actions} actionsDisabled={false} onQuit={() => {}} /> : null;
}
function setup(edit: (s: GameState) => void) {
    act(() => game.setGameState(prev => {
        const s = structuredClone(prev!);
        s.turnNumber = 3; s.currentPhase = Phase.MAIN1; s.activePlayerIndex = 1;
        for (const p of s.players) { p.hand = []; p.deck = []; p.discard = []; p.pawnZones.fill(null); p.actionZones.fill(null); }
        edit(s); return s;
    }));
}
beforeEach(() => { vi.useFakeTimers(); act(() => { root = create(<React.StrictMode><Harness /></React.StrictMode>); }); });
afterEach(() => { act(() => root.unmount()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const tick = () => act(() => vi.advanceTimersByTime(700));

it('keeps self-play as default and passes the AI mode from setup', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const onStart = vi.fn(); let setupRoot!: ReturnType<typeof create>;
    act(() => { setupRoot = create(<PlaytestSetup onBack={() => {}} onStart={onStart} />); });
    expect(setupRoot.root.findAllByProps({ type: 'radio' })[0].props.checked).toBe(true);
    act(() => setupRoot.root.findAllByProps({ type: 'radio' })[1].props.onChange());
    act(() => setupRoot.root.findByProps({ 'aria-label': 'Begin playtest' }).props.onClick());
    expect(onStart).toHaveBeenCalledWith([null, null], 'ai');
    act(() => setupRoot.unmount());
});

it('automates summon effects, battle, and the rest of an AI turn', () => {
    setup(s => { s.players[1].hand = [card('pawn_01', 1)]; });
    for (let i = 0; i < 18 && game.gameState!.activePlayerIndex === 1; i++) tick();
    expect(game.gameState!.activePlayerIndex).toBe(0);
    expect(game.gameState!.players[1].pawnZones.filter(Boolean)).toHaveLength(1);
    expect(game.gameState!.players[1].lp).toBe(900);
    expect(game.gameState!.players[0].lp).toBe(680);
    expect(game.state.pendingEffectCard).toBeNull();
});

it('pauses an AI attack for an eligible human response, displays its count, then resumes exactly once', () => {
    setup(s => {
        s.currentPhase = Phase.BATTLE;
        s.players[1].pawnZones[0] = zone(card('pawn_08', 1));
        s.players[0].actionZones[0] = zone(card('condition_01'), Position.HIDDEN);
    });
    tick();
    expect(game.gameState!.response?.priority).toBe(0);
    expect(game.gameState!.players[0].lp).toBe(800);
    const popup = root.root.findByProps({ 'aria-label': 'Response window' });
    expect(popup.findAllByType('p').map(p => p.children.join('')).join(' ')).toContain('1 activatable card');
    expect(game.state.responseOptions).toHaveLength(1);
    for (let i = 0; i < 5; i++) tick();
    expect(game.gameState!.players[0].lp).toBe(800);
    act(() => game.actions.passResponse());
    expect(game.gameState!.players[0].lp).toBe(670);
    expect(game.gameState!.players[1].pawnZones[0]!.hasAttacked).toBe(true);
});

it('lets the human choose a response target during the AI turn without paying or resolving early', () => {
    const reinforcement = card('condition_01');
    setup(s => {
        s.currentPhase = Phase.BATTLE;
        s.players[1].pawnZones[0] = zone(card('pawn_08', 1));
        s.players[0].pawnZones[0] = zone(card('pawn_01'));
        s.players[0].actionZones[0] = zone(reinforcement, Position.HIDDEN);
    });
    tick();
    act(() => game.actions.respond(reinforcement.instanceId));
    expect(game.state.pendingEffectCard?.instanceId).toBe(reinforcement.instanceId);
    expect(root.root.findAllByProps({ 'aria-label': 'Response window' })).toHaveLength(0);
    act(() => game.actions.resolveEffect(reinforcement, { playerIndex: 0, type: 'pawn', index: 0 }));
    expect(game.gameState!.players[0].pawnZones[0]!.card.atk).toBe(140);
    expect(game.gameState!.players[1].pawnZones[0]).toBeNull();
    expect(game.gameState!.players[0].lp).toBe(800);
    expect(game.gameState!.players[1].lp).toBe(790);
});

it('canceling response selection retains the set card and response priority', () => {
    const reinforcement = card('condition_01');
    setup(s => { s.currentPhase = Phase.BATTLE; s.players[1].pawnZones[0] = zone(card('pawn_08', 1)); s.players[0].actionZones[0] = zone(reinforcement, Position.HIDDEN); });
    tick();
    act(() => game.actions.respond(reinforcement.instanceId));
    act(() => game.actions.cancelEffect());
    expect(game.gameState!.players[0].actionZones[0]?.position).toBe(Position.HIDDEN);
    expect(game.gameState!.response?.priority).toBe(0);
    expect(game.gameState!.players[0].discard).toHaveLength(0);
});

it('never creates a response popup when the human has no activatable cards', () => {
    setup(s => { s.currentPhase = Phase.BATTLE; s.players[1].pawnZones[0] = zone(card('pawn_08', 1)); });
    tick();
    expect(root.root.findAllByProps({ 'aria-label': 'Response window' })).toHaveLength(0);
    expect(game.gameState!.players[0].lp).toBe(670);
});

it('does not activate the human’s cost-only Condition while the AI waits to leave a phase', () => {
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].actionZones[0] = zone(card('condition_03'), Position.HIDDEN); });
    for (let i = 0; i < 8; i++) tick();
    expect(game.gameState!.response?.priority).toBe(0);
    expect(game.gameState!.currentPhase).toBe(Phase.DRAW);
    expect(game.gameState!.players[0].lp).toBe(800);
    expect(game.gameState!.players[0].actionZones[0]?.position).toBe(Position.HIDDEN);
});

it('ends an AI game on lethal effect damage without continuing its turn', () => {
    setup(s => { s.players[0].lp = 50; s.players[1].hand = [card('action_01', 1)]; });
    tick();
    expect(game.gameState!.winner).toBe('AI');
    const state = game.gameState;
    for (let i = 0; i < 4; i++) tick();
    expect(game.gameState).toBe(state);
});
