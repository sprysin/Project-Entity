import './fixtures/attachedCondition';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, GameState, Phase, Position } from '../src/types';
import { Zone } from '../src/components/game/Zone';

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
        for (const p of s.players) {
            p.hand = []; p.deck = []; p.discard = []; p.pawnZones.fill(null); p.actionZones.fill(null);
            p.normalSummonUsed = false; p.hiddenSummonUsed = false; p.activatedHardOncePerTurns = [];
        }
        edit(s); return s;
    }));
}
beforeEach(() => { vi.useFakeTimers(); act(() => { root = create(<React.StrictMode><Harness /></React.StrictMode>); }); });
afterEach(() => { act(() => root.unmount()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('prompts only for available effects and honors a chosen special-summon slot', () => {
    const recovery = card('action_02');
    setup(s => { s.players[0].hand = [recovery]; s.players[0].discard = [card('pawn_04')]; });
    const previousLog = game.gameState!.log;
    act(() => game.actions.handleActionFromHand(recovery, 'activate', 0));
    expect(game.gameState!.log).toBe(previousLog);
    expect(game.gameState!.players[0].hand[0].instanceId).toBe(recovery.instanceId);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();

    const caster = card('pawn_04');
    setup(s => { s.players[0].hand = [caster]; });
    act(() => game.actions.handleSummon(caster, 'normal', 0));
    expect(game.state.triggeredEffect).toBeNull();

    const eligibleCaster = card('pawn_04');
    setup(s => { s.players[0].hand = [eligibleCaster]; s.players[0].discard = [card('action_01')]; });
    act(() => game.actions.handleSummon(eligibleCaster, 'normal', 0));
    expect(game.state.triggeredEffect?.instanceId).toBe(eligibleCaster.instanceId);

    const frontline = card('condition_06', 1);
    const light = card('pawn_01', 1);
    setup(s => {
        s.activePlayerIndex = 0;
        s.players[1].actionZones[0] = placed(frontline);
        s.players[1].hand = [light];
        s.pendingFrontline = [{ sourceId: frontline.instanceId, playerIndex: 1 }];
    });
    act(() => game.actions.setTriggeredEffect(null));
    act(() => game.actions.frontlineChooseCard(0));
    expect(game.state.frontlineCardId).toBe(light.instanceId);
    act(() => game.actions.frontlineSummon(3, Position.DEFENSE));
    expect(game.gameState!.players[1].pawnZones[0]).toBeNull();
    expect(game.gameState!.players[1].pawnZones[3]?.card.instanceId).toBe(light.instanceId);
    expect(game.gameState!.players[1].pawnZones[3]?.position).toBe(Position.DEFENSE);
    expect(game.state.frontlineCardId).toBeNull();

    const tribunal = card('action_06');
    const pawn = { ...card('pawn_01'), level: 5 as const };
    setup(s => {
        s.activePlayerIndex = 0;
        s.pendingFrontline = [];
        s.players[0].actionZones[0] = placed(tribunal);
        s.players[0].hand = [pawn];
    });
    act(() => game.actions.activateOnField(0, 'action', 0));
    expect(game.state.effectChoiceReq).toBeNull();
    act(() => game.setGameState(s => {
        const next = structuredClone(s!);
        next.players[0].pawnZones[0] = placed(card('pawn_01'));
        return next;
    }));
    act(() => game.actions.activateOnField(0, 'action', 0));
    expect(game.state.effectChoiceReq).toMatchObject([{ disabled: false }, { disabled: true }]);
    act(() => game.actions.handleEffectChoice('summon'));
    expect(game.state.handSelectionReq).toBeNull();
    act(() => game.actions.handleEffectChoice('tribute'));
    act(() => game.actions.setTributeSelection([0]));
    act(() => game.actions.handleEffectTribute());
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].actionZones[0]?.counters).toEqual({ 'Tribute Counters': 1 });
    act(() => game.actions.activateOnField(0, 'action', 0));
    expect(game.state.effectChoiceReq).toMatchObject([{ disabled: true }, { disabled: false }]);
    act(() => game.actions.handleEffectChoice('summon'));
    expect(game.state.handSelectionReq).toMatchObject({ purpose: 'summon', prompt: 'Select a Pawn to special summon' });
    act(() => game.actions.handleHandSelection(0));
    expect(game.state.pawnPlacementReq).not.toBeNull();
    act(() => game.actions.handlePawnPlacement(4, Position.ATTACK));
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].pawnZones[4]?.card.instanceId).toBe(pawn.instanceId);
    act(() => game.actions.activateOnField(0, 'action', 0));
    expect(game.state.effectChoiceReq).toBeNull();

    const fieldCard = game.gameState!.players[0].actionZones[0]!;
    let overlay: ReturnType<typeof create>;
    act(() => { overlay = create(<Zone card={fieldCard} type="action" />); });
    expect(overlay!.root.findAllByProps({ 'aria-label': 'Tribute Counters: 1' })).toHaveLength(1);
    for (const counters of [undefined, { 'Tribute Counters': 0 }]) {
        act(() => overlay!.update(<Zone card={{ ...fieldCard, counters }} type="action" />));
        expect(overlay!.root.findAllByProps({ className: 'field-pawn-overlay field-counter-overlay' })).toHaveLength(0);
    }
    act(() => overlay!.unmount());
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

it('discard and tribute costs are paid once after all activation selections are complete', () => {
    const beast = card('pawn_06'); const cost = card('action_01');
    setup(s => { s.players[0].pawnZones[0] = placed(beast); s.players[0].hand = [cost]; s.players[1].pawnZones[0] = placed(card('pawn_01', 1)); });
    act(() => game.actions.activateOnField(0, 'pawn', 0));
    act(() => game.actions.handleHandSelection(0));
    expect(game.state.targetSelectMode).toBe('effect');
    expect(game.state.handSelectionReq).toBeNull();
    expect(game.gameState!.players[0].hand).toHaveLength(1);
    act(() => game.actions.resolveEffect(beast, { playerIndex: 1, type: 'pawn', index: 0 }));
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].hand).toHaveLength(0);
    expect(game.gameState!.players[0].discard).toHaveLength(1);
    expect(game.gameState!.players[1].pawnZones[0]?.position).toBe(Position.DEFENSE);
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
    act(() => vi.advanceTimersByTime(500));
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
