import './fixtures/attachedCondition';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, GameState, Phase, Position } from '../src/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let game: ReturnType<typeof useGameLogic>;
let root: ReturnType<typeof create>;
let serial = 0;
const card = (id: string, player = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `test-${serial++}`, ownerId: `player${player + 1}` });
const placed = (c: Card) => ({ card: c, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
function Harness() { game = useGameLogic(); return null; }
function setup(edit: (s: GameState) => void) {
    act(() => game.setGameState(prev => {
        const s = structuredClone(prev!);
        s.turnNumber = 2; s.currentPhase = Phase.MAIN1;
        for (const p of s.players) { p.hand = []; p.deck = []; p.discard = []; p.pawnZones.fill(null); p.actionZones.fill(null); }
        edit(s); return s;
    }));
}
beforeEach(() => { vi.useFakeTimers(); act(() => { root = create(<React.StrictMode><Harness /></React.StrictMode>); }); });
afterEach(() => { act(() => root.unmount()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('ends the duel on the first missing Draw Phase card and cancels further phase advancement', () => {
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].deck = [card('pawn_01')]; });
    act(() => vi.advanceTimersByTime(300));
    expect(game.gameState!.winner).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(game.gameState!.winner).toBe('Player 2');
    expect(game.gameState!.players[0].hand).toHaveLength(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState!.currentPhase).toBe(Phase.DRAW);
});

it('Void Blast wins immediately and is discarded exactly once', () => {
    const blast = card('action_01');
    setup(s => { s.players[0].hand = [blast]; s.players[1].lp = 50; });
    act(() => game.actions.handleActionFromHand(blast, 'activate', 0));
    expect(game.gameState!.winner).toBe('Player 1');
    expect(game.gameState!.damageEvents).toEqual([{ card: blast, playerIndex: 0, amount: 50, kind: 'effect' }]);
    expect(game.gameState!.players[1].lp).toBe(0);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();
    expect(game.gameState!.players[0].discard.map(c => c.instanceId)).toEqual([blast.instanceId]);
    expect(game.gameState!.log[0]).toBe('"Void Blast" activated, "Player 2" -50 LP.');
    const ended = game.gameState;
    act(() => { game.actions.nextPhase(); game.actions.resolveEffect(blast); vi.advanceTimersByTime(5000); });
    expect(game.gameState).toBe(ended);
});

it('silently rejects an action whose activation requirements are not met', () => {
    const recovery = card('action_02');
    setup(s => { s.players[0].hand = [recovery]; s.players[0].discard = [card('pawn_04')]; });
    const previousLog = game.gameState!.log;
    act(() => game.actions.handleActionFromHand(recovery, 'activate', 0));
    expect(game.gameState!.log).toBe(previousLog);
    expect(game.gameState!.players[0].hand[0].instanceId).toBe(recovery.instanceId);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();
});

it('holds a declared attack for 1.5 seconds before committing combat', () => {
    setup(s => { s.currentPhase = Phase.BATTLE; s.players[0].pawnZones[0] = placed(card('pawn_01')); s.players[1].pawnZones[0] = placed(card('pawn_04', 1)); });
    const before = game.gameState!;
    act(() => game.actions.handleAttack(0, 0));
    expect(before.players[1].lp).toBe(800);
    expect(game.gameState!.players[1].lp).toBe(800);
    expect(game.gameState!.deferredAction).toMatchObject({ kind: 'attack' });
    expect(game.gameState!.response?.ready).toBe(true);
    const phase = game.gameState!.currentPhase;
    act(() => { game.actions.nextPhase(); vi.advanceTimersByTime(1499); });
    expect(game.gameState!.currentPhase).toBe(phase);
    expect(game.gameState!.players[1].lp).toBe(800);
    act(() => vi.advanceTimersByTime(1));
    expect(game.gameState!.players[1].lp).toBe(780);
    expect(game.gameState!.deferredAction).toBeUndefined();
    expect(game.gameState!.response).toBeUndefined();
    expect(game.gameState!.log).toHaveLength(before.log.length + 1);
    expect(game.gameState!.log[0]).toBe('"Solstice Sentinel" destroyed "Void Caster" by battle. "Player 2" -20 LP.');
    act(() => game.actions.handleAttack(0, 'direct'));
    expect(game.gameState!.players[1].lp).toBe(780);
});

it('discard then target charges one card and applies the selected effect', () => {
    const beast = card('pawn_06'); const cost = card('action_01');
    setup(s => { s.players[0].pawnZones[0] = placed(beast); s.players[0].hand = [cost]; s.players[1].pawnZones[0] = placed(card('pawn_01', 1)); });
    act(() => game.actions.activateOnField(0, 'pawn', 0));
    act(() => game.actions.handleHandSelection(0));
    expect(game.state.targetSelectMode).toBe('effect');
    expect(game.state.handSelectionReq).toBeNull();
    expect(game.gameState!.players[0].hand).toHaveLength(1);
    act(() => game.actions.resolveEffect(beast, { playerIndex: 1, type: 'pawn', index: 0 }));
    expect(game.gameState!.players[0].hand).toHaveLength(0);
    expect(game.gameState!.players[0].discard).toHaveLength(1);
    expect(game.gameState!.players[1].pawnZones[0]?.position).toBe(Position.DEFENSE);
});

it('effect tributes are paid once after all activation selections are complete', () => {
    const maintenance = card('action_04'); const recovered = card('pawn_01');
    setup(s => { s.players[0].hand = [maintenance]; s.players[0].discard = [recovered]; s.players[0].pawnZones[0] = placed(card('pawn_01')); s.players[0].pawnZones[1] = placed(card('pawn_04')); });
    act(() => game.actions.handleActionFromHand(maintenance, 'activate', 0));
    act(() => game.actions.setTributeSelection([0, 1]));
    act(() => game.actions.handleEffectTribute());
    expect(game.gameState!.players[0].pawnZones.filter(Boolean)).toHaveLength(2);
    expect(game.state.discardSelectionReq).not.toBeNull();
    act(() => vi.advanceTimersByTime(10000));
    expect(game.gameState!.players[0].actionZones[0]?.card.instanceId).toBe(maintenance.instanceId);
    act(() => game.actions.handleDiscardSelection(0));
    expect(game.gameState!.players[0].pawnZones[0]?.card.instanceId).toBe(recovered.instanceId);
    expect(game.gameState!.players[0].discard).toHaveLength(3);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();
    expect(game.gameState!.log[0]).toContain('"Mechanical Maintenance" activated');
    expect(game.gameState!.log[0]).toContain('tributes "Solstice Sentinel", "Void Caster"');
    expect(game.gameState!.log[0]).toContain('special summons "Solstice Sentinel"');
});

it('keeps a peeked card in hand and waits for the viewer to hide the reveal', () => {
    const witch = card('pawn_11');
    const shown = card('action_01', 1);
    setup(s => { s.players[0].pawnZones[0] = placed(witch); s.players[1].hand = [shown]; });

    act(() => game.actions.resolveEffect(witch));
    expect(game.state.peekSelectionReq).toBeNull();
    act(() => vi.advanceTimersByTime(1300));
    expect(game.state.peekSelectionReq).toMatchObject({ playerIndex: 1, viewerPlayerIndex: 0 });
    act(() => game.actions.handlePeekSelection(0));
    expect(game.gameState!.players[1].hand[0].instanceId).toBe(shown.instanceId);
    expect(game.gameState!.peekEvents?.[0].card.instanceId).toBe(shown.instanceId);
    const eventId = game.gameState!.peekEvents![0].id;
    act(() => game.actions.dismissPeek(eventId));
    expect(game.gameState!.peekEvents).toEqual([]);
});

it('automated drawing refills to five and advances exactly one turn under StrictMode', () => {
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].hand = [card('action_01')]; s.players[0].deck = Array.from({ length: 10 }, () => card('pawn_01')); });
    act(() => vi.advanceTimersByTime(1700));
    expect(game.gameState!.players[0].hand).toHaveLength(5);
    expect(game.gameState!.currentPhase).toBe(Phase.STANDBY);
    act(() => vi.advanceTimersByTime(1200));
    expect(game.gameState!.currentPhase).toBe(Phase.MAIN1);
    expect(game.gameState!.turnNumber).toBe(2);
});

it('allows a tribute summon to free and reuse a zone on a full Pawn field', () => {
    const king = card('pawn_02');
    setup(s => {
        s.players[0].hand = [king];
        s.players[0].pawnZones = Array.from({ length: 5 }, () => placed(card('pawn_01')));
    });

    act(() => game.actions.handleSummon(king, 'normal', 0));
    expect(game.state.targetSelectMode).toBe('tribute');

    const tributeId = game.gameState!.players[0].pawnZones[0]!.card.instanceId;
    act(() => game.actions.setTributeSelection([0]));
    act(() => game.actions.handleTributeSummon());
    expect(game.gameState!.players[0].pawnZones[0]?.card.instanceId).toBe(king.instanceId);
    expect(game.gameState!.players[0].discard.at(-1)?.instanceId).toBe(tributeId);
    expect(game.state.targetSelectMode).toBeNull();
});


