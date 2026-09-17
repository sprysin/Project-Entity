import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, GameState, Phase, Position } from '../types';
import { finishEffect } from '../src/game/finishEffect';

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

it('instant actions visually visit the field while gameplay resolves immediately', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const rect = (left: number) => ({ left, top: 100, width: 128, height: 192 });
    const element = (left: number) => ({ getBoundingClientRect: () => rect(left) }) as unknown as HTMLElement;
    game.actions.setRef('0-hand-0')(element(0));
    game.actions.setRef('0-action-0')(element(200));
    game.actions.setRef('discard-0')(element(400));
    const blast = card('action_01');
    setup(s => { s.players[0].hand = [blast]; });
    act(() => game.actions.handleActionFromHand(blast, 'activate', 0));
    expect(game.gameState!.players[1].lp).toBe(750);
    expect(game.gameState!.players[0].discard[0].instanceId).toBe(blast.instanceId);
    expect(game.state.cardMotions).toHaveLength(2);
    expect(game.state.cardMotions.map(m => [m.from.left, m.to.left])).toEqual([[0, 200], [200, 400]]);
    expect(game.state.cardMotions[0].activation).toBe(true);
    const committed = game.gameState;
    act(() => game.state.cardMotions.forEach(m => game.state.finishMotion(m.id)));
    expect(game.gameState).toBe(committed);
});

it('returning a card animates the transfer without animating hand reordering', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const element = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 128, height: 192 }) } as unknown as HTMLElement;
    ['0-hand-0', '0-hand-1', 'discard-0'].forEach(key => game.actions.setRef(key)(element));
    const first = card('pawn_01'), second = card('pawn_04');
    setup(s => { s.players[0].hand = [first]; s.players[0].discard = [second]; });
    setup(s => { s.players[0].hand = [second, first]; });
    expect(game.state.cardMotions.map(m => m.card.instanceId)).toEqual([second.instanceId]);
});

it('Void Blast wins immediately and is discarded exactly once', () => {
    const blast = card('action_01');
    setup(s => { s.players[0].hand = [blast]; s.players[1].lp = 50; });
    act(() => game.actions.handleActionFromHand(blast, 'activate', 0));
    expect(game.gameState!.winner).toBe('Player 1');
    expect(game.gameState!.players[1].lp).toBe(0);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();
    expect(game.gameState!.players[0].discard.map(c => c.instanceId)).toEqual([blast.instanceId]);
    expect(game.gameState!.log[0]).toBe('"Void Blast" activated, "Player 2" -50 LP.');
    const ended = game.gameState;
    act(() => { game.actions.nextPhase(); game.actions.resolveEffect(blast); vi.advanceTimersByTime(5000); });
    expect(game.gameState).toBe(ended);
});

it('logs a resolved target from the effect context', () => {
    const king = card('pawn_02');
    const dragon = card('pawn_05', 1);
    setup(s => {
        s.players[0].pawnZones[0] = placed(king);
        s.players[1].pawnZones[0] = placed(dragon);
    });
    act(() => game.actions.resolveEffect(king, { playerIndex: 1, type: 'pawn', index: 0 }, undefined, undefined, undefined, 'summon'));
    expect(game.gameState!.log[0]).toBe('"High King" effect activated, targets "High Voltage - Charged Dragon"; "High Voltage - Charged Dragon" -20 ATK.');
});

it('logs normal and tribute summons separately from their effects', () => {
    const serpent = card('pawn_08');
    setup(s => { s.players[0].hand = [serpent]; });
    act(() => game.actions.handleSummon(serpent, 'normal', 0));
    expect(game.gameState!.log[0]).toBe('"Quickstrike Serpent" summoned.');

    const king = card('pawn_02');
    setup(s => {
        s.players[0].hand = [king];
        s.players[0].pawnZones[0] = placed(card('pawn_01'));
    });
    act(() => game.actions.handleSummon(king, 'normal'));
    act(() => game.actions.setTributeSelection([0]));
    act(() => game.actions.handleTributeSummon());
    act(() => game.actions.handlePlacement(0));
    expect(game.gameState!.log[0]).toBe('"High King" tribute summoned.');
});

it('does not narrate attack-count changes in an effect log', () => {
    const serpent = card('pawn_08');
    const discard = card('action_01');
    setup(s => {
        s.players[0].pawnZones[0] = placed(serpent);
        s.players[0].hand = [discard];
    });
    act(() => game.actions.activateOnField(0, 'pawn', 0));
    act(() => game.actions.handleHandSelection(0));
    expect(game.gameState!.log[0]).toBe('"Quickstrike Serpent" effect activated, discards "Void Blast".');
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

it('on-summon effect damage also wins', () => {
    const sparker = card('pawn_03');
    setup(s => { s.players[0].pawnZones[0] = placed(sparker); s.players[1].lp = 10; s.players[1].actionZones[0] = { ...placed(card('condition_01', 1)), position: Position.HIDDEN }; });
    act(() => game.actions.resolveEffect(sparker, undefined, undefined, undefined, undefined, 'summon'));
    expect(game.gameState!.winner).toBe('Player 1');
});

it('deck search charges half LP once and retains its lingering source', () => {
    const mark = card('action_03'); const bear = card('pawn_07');
    setup(s => { s.players[0].actionZones[0] = placed(mark); s.players[0].deck = [bear]; });
    act(() => game.actions.activateOnField(0, 'action', 0));
    expect(game.state.deckSelectionReq).not.toBeNull();
    expect(game.gameState!.players[0].lp).toBe(800);
    act(() => game.actions.handleDeckSelection(0));
    expect(game.gameState!.players[0].lp).toBe(400);
    expect(game.gameState!.players[0].hand[0].instanceId).toBe(bear.instanceId);
    expect(game.gameState!.players[0].actionZones[0]?.card.instanceId).toBe(mark.instanceId);
    expect(game.state.pendingEffectCard).toBeNull();
});

it('slow recovery selections keep the action in play until completion', () => {
    const recovery = card('action_02'); const pawn = card('pawn_04');
    setup(s => { s.players[0].hand = [recovery]; s.players[0].discard = [pawn]; s.players[1].pawnZones[0] = placed(card('pawn_01', 1)); });
    act(() => game.actions.handleActionFromHand(recovery, 'activate', 0));
    act(() => vi.advanceTimersByTime(10000));
    expect(game.gameState!.players[0].actionZones[0]?.card.instanceId).toBe(recovery.instanceId);
    const phase = game.gameState!.currentPhase;
    act(() => game.actions.nextPhase());
    expect(game.gameState!.currentPhase).toBe(phase);
    act(() => game.actions.handleDiscardSelection(0));
    expect(game.gameState!.players[0].hand[0].instanceId).toBe(pawn.instanceId);
    expect(game.gameState!.players[0].discard.map(c => c.instanceId)).toEqual([recovery.instanceId]);
    expect(game.gameState!.players[0].lp).toBe(820);
});

it('cancellation clears the effect context and disposes its source once', () => {
    const recovery = card('action_02');
    setup(s => { s.players[0].hand = [recovery]; s.players[0].discard = [card('pawn_04')]; s.players[1].pawnZones[0] = placed(card('pawn_01', 1)); });
    act(() => game.actions.handleActionFromHand(recovery, 'activate', 0));
    act(() => game.actions.cancelEffect());
    expect(game.state.pendingEffectCard).toBeNull();
    expect(game.state.discardSelectionReq).toBeNull();
    expect(game.state.targetSelectMode).toBeNull();
    expect(game.gameState!.players[0].lp).toBe(800);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();
});

it('combat commits damage and one log without mutating prior state', () => {
    setup(s => { s.currentPhase = Phase.BATTLE; s.players[0].pawnZones[0] = placed(card('pawn_01')); s.players[1].pawnZones[0] = placed(card('pawn_04', 1)); });
    const before = game.gameState!;
    act(() => game.actions.handleAttack(0, 0));
    expect(before.players[1].lp).toBe(800);
    expect(game.gameState!.players[1].lp).toBe(780);
    expect(game.gameState!.log).toHaveLength(before.log.length + 1);
    act(() => game.actions.handleAttack(0, 'direct'));
    expect(game.gameState!.players[1].lp).toBe(780);
});

it('cleanup never removes a replacement card from the old slot', () => {
    const old = card('action_01'); const replacement = card('action_03');
    setup(s => { s.players[0].actionZones[0] = placed(replacement); });
    const result = finishEffect(game.gameState!, old);
    expect(result.players[0].actionZones[0]?.card.instanceId).toBe(replacement.instanceId);
    expect(result.players[0].discard).toHaveLength(0);
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

it('effect tributes are paid once and the source survives until recovery selection', () => {
    const maintenance = card('action_04'); const recovered = card('pawn_01');
    setup(s => { s.players[0].hand = [maintenance]; s.players[0].discard = [recovered]; s.players[0].pawnZones[0] = placed(card('pawn_01')); s.players[0].pawnZones[1] = placed(card('pawn_04')); });
    act(() => game.actions.handleActionFromHand(maintenance, 'activate', 0));
    act(() => game.actions.setTributeSelection([0, 1]));
    act(() => game.actions.handleEffectTribute());
    expect(game.gameState!.players[0].pawnZones.filter(Boolean)).toHaveLength(0);
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

it('automated drawing refills to five and advances exactly one turn under StrictMode', () => {
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].hand = [card('action_01')]; s.players[0].deck = Array.from({ length: 10 }, () => card('pawn_01')); });
    act(() => vi.advanceTimersByTime(1700));
    expect(game.gameState!.players[0].hand).toHaveLength(5);
    expect(game.gameState!.currentPhase).toBe(Phase.STANDBY);
    act(() => vi.advanceTimersByTime(1200));
    expect(game.gameState!.currentPhase).toBe(Phase.MAIN1);
    expect(game.gameState!.turnNumber).toBe(2);
});

it('allows successive tribute summons after the normal summon has been used', () => {
    const first = card('pawn_02'); const second = card('pawn_02');
    setup(s => { s.players[0].normalSummonUsed = true; s.players[0].hand = [first, second]; s.players[0].pawnZones[0] = placed(card('pawn_01')); });
    for (const next of [first, second]) {
        act(() => game.actions.handleSummon(next, 'normal'));
        expect(game.state.targetSelectMode).toBe('tribute');
        act(() => game.actions.setTributeSelection([0]));
        act(() => game.actions.handleTributeSummon());
        act(() => game.actions.handlePlacement(0));
        expect(game.gameState!.players[0].pawnZones[0]?.card.instanceId).toBe(next.instanceId);
        act(() => { game.actions.setTriggeredEffect(null); game.actions.cancelEffect(); });
    }
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
    expect(game.gameState!.players[0].pawnZones[0]).toBeNull();

    act(() => game.actions.handlePlacement(0));
    expect(game.gameState!.players[0].pawnZones[0]?.card.instanceId).toBe(king.instanceId);
    expect(game.gameState!.players[0].discard.at(-1)?.instanceId).toBe(tributeId);
});
