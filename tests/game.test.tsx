import './fixtures/attachedCondition';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, GameState, Phase, Position, OpponentMode, PlaytestDebugSettings } from '../src/types';
import { Zone } from '../src/components/game/Zone';
import PlaytestSetup from '../src/components/decks/PlaytestSetup';
import { DeckPile } from '../src/components/game/Pile';
import { XrayOverlay } from '../src/components/game/XrayOverlay';
import { GameSidebar } from '../src/components/game/GameSidebar';
import { CardDetail } from '../src/components/cards/CardDetail';

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
        s.openingCoin = undefined;
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

    const tributeSummon: Card = { ...card('pawn_01'), level: 5 };
    setup(s => {
        s.players[0].hand = [tributeSummon];
        s.players[0].pawnZones = s.players[0].pawnZones.map(() => placed(card('pawn_01')));
    });
    act(() => game.actions.setTriggeredEffect(null));
    act(() => game.actions.handleSummon(tributeSummon, 'normal', 0));
    act(() => game.actions.setTributeSelection([1]));
    act(() => game.actions.handleTributeSummon());
    expect(game.state.targetSelectMode).toBe('place_pawn');
    expect(game.gameState!.players[0].pawnZones[1]).not.toBeNull();
    act(() => game.actions.handlePlacement(1));
    expect(game.gameState!.players[0].pawnZones[1]?.card.instanceId).toBe(tributeSummon.instanceId);
    expect(game.gameState!.players[0].pawnZones[0]).not.toBeNull();
    expect(game.state.targetSelectMode).toBeNull();

    const handSummon = card('condition_06', 1);
    const light = card('pawn_01', 1);
    setup(s => {
        s.activePlayerIndex = 0;
        s.players[1].actionZones[0] = placed(handSummon);
        s.players[1].hand = [light];
        s.pendingHandSummons = [{ sourceId: handSummon.instanceId, playerIndex: 1 }];
    });
    act(() => game.actions.setTriggeredEffect(null));
    act(() => game.actions.handSummonChooseCard(0));
    expect(game.state.handSummonCardId).toBe(light.instanceId);
    act(() => game.actions.confirmHandSummon(3, Position.DEFENSE));
    expect(game.gameState!.players[1].pawnZones[0]).toBeNull();
    expect(game.gameState!.players[1].pawnZones[3]?.card.instanceId).toBe(light.instanceId);
    expect(game.gameState!.players[1].pawnZones[3]?.position).toBe(Position.DEFENSE);
    expect(game.state.handSummonCardId).toBeNull();

    const tribunal = card('action_06');
    const pawn = { ...card('pawn_01'), level: 5 as const };
    setup(s => {
        s.activePlayerIndex = 0;
        s.pendingHandSummons = [];
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
    expect(game.state.effectChoiceReq).toBeNull();
    act(() => game.setGameState(s => {
        const next = structuredClone(s!);
        next.players[0].actionZones[0]!.counters = { 'Tribute Counters': 2 };
        return next;
    }));
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
    expect(overlay!.root.findAllByProps({ 'aria-label': 'Tribute Counters: 2' })).toHaveLength(1);
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

it('opening turns, AI-only debug setup, and automated drawing preserve hands and hidden card rules', () => {
    const winner = game.gameState!.openingCoin!.winnerIndex;
    act(() => { game.actions.chooseTurnOrder('first'); game.actions.nextPhase(); vi.advanceTimersByTime(2399); });
    expect(game.gameState!.openingCoin?.stage).toBe('flipping');
    expect(game.gameState!.drawProgress).toBeUndefined();
    act(() => vi.advanceTimersByTime(1));
    expect(game.gameState!.openingCoin?.stage).toBe('choosing');
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState!.currentPhase).toBe(Phase.DRAW);
    act(() => game.actions.chooseTurnOrder('second'));
    expect(game.gameState!.openingCoin).toBeUndefined();
    expect(game.gameState!.activePlayerIndex).toBe(1 - winner);
    act(() => vi.advanceTimersByTime(1700));
    expect(game.gameState!.currentPhase).toBe(Phase.STANDBY);
    expect(game.gameState!.players[1 - winner].hand).toHaveLength(5);
    act(() => vi.advanceTimersByTime(1200));
    expect(game.gameState!.currentPhase).toBe(Phase.MAIN1);
    act(() => game.actions.nextPhase());
    act(() => vi.advanceTimersByTime(1200));
    expect(game.gameState!.activePlayerIndex).toBe(winner);
    expect(game.gameState!.turnNumber).toBe(2);
    act(() => game.setGameState(prev => ({ ...prev!, activePlayerIndex: 0, currentPhase: Phase.MAIN1, drawProgress: undefined })));
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].hand = [card('action_01')]; s.players[0].deck = Array.from({ length: 10 }, () => card('pawn_01')); });
    act(() => vi.advanceTimersByTime(1700));
    expect(game.gameState!.players[0].hand).toHaveLength(5);
    expect(game.gameState!.currentPhase).toBe(Phase.STANDBY);
    act(() => vi.advanceTimersByTime(1200));
    expect(game.gameState!.currentPhase).toBe(Phase.MAIN1);
    expect(game.gameState!.turnNumber).toBe(2);
    const debug: PlaytestDebugSettings = { alwaysGoFirst: true, chooseStartingHand: true, xray: true };
    function DebugHarness({ mode }: { mode: OpponentMode }) { game = useGameLogic(undefined, mode, debug); return null; }
    act(() => root.update(<React.StrictMode><DebugHarness mode="ai" /></React.StrictMode>));
    expect(game.gameState).toBeNull();
    const choices = game.state.startingHandCards!;
    expect(choices).toHaveLength(40);
    act(() => vi.advanceTimersByTime(10000));
    expect(game.gameState).toBeNull();
    for (const invalid of [[0, 1], [0, 0, 1, 2, 3], [0, 1, 2, 3, 40]]) {
        act(() => game.actions.chooseStartingHand(invalid));
        expect(game.gameState).toBeNull();
    }
    const indices = [7, 9, 12, 20, 31];
    act(() => game.actions.chooseStartingHand(indices));
    expect(game.state.startingHandCards).toBeNull();
    expect(game.gameState!.openingCoin).toBeUndefined();
    expect(game.gameState!.activePlayerIndex).toBe(0);
    expect(game.gameState!.players[0].hand).toEqual(indices.map(index => choices[index]));
    expect(game.gameState!.players[0].deck).toEqual(choices.filter((_, index) => !indices.includes(index)));
    expect(game.gameState!.players[1].hand).toHaveLength(5);
    const debugGame = game.gameState!;
    // Remount self-play with the same settings to verify they are ignored at the boundary.
    act(() => root.update(null));
    act(() => root.update(<React.StrictMode><DebugHarness mode="self" /></React.StrictMode>));
    expect(game.state.startingHandCards).toBeNull();
    expect(game.gameState!.openingCoin).toBeDefined();

    const started = vi.fn();
    act(() => root.update(<PlaytestSetup onBack={() => {}} onStart={started} />));
    act(() => root.root.findByProps({ 'aria-label': 'Debug settings' }).props.onClick());
    const toggles = () => root.root.findAllByProps({ type: 'checkbox' });
    expect(toggles().every(toggle => toggle.props.disabled)).toBe(true);
    expect(toggles().every(toggle => toggle.props['data-sound'] === 'toggle')).toBe(true);
    act(() => root.root.findAllByProps({ type: 'radio' })[1].props.onChange());
    act(() => toggles().forEach(toggle => toggle.props.onChange({ target: { checked: true } })));
    act(() => root.root.findByProps({ 'aria-label': 'Begin playtest' }).props.onClick());
    expect(started).toHaveBeenLastCalledWith([null, null], 'ai', debug);
    act(() => root.root.findAllByProps({ type: 'radio' })[0].props.onChange());
    act(() => root.root.findByProps({ 'aria-label': 'Begin playtest' }).props.onClick());
    expect(started).toHaveBeenLastCalledWith([null, null]);

    const hidden = { ...placed(card('pawn_01', 1)), position: Position.HIDDEN };
    debugGame.players[1].pawnZones[0] = hidden;
    const inspect = vi.fn();
    act(() => root.update(<><Zone card={hidden} type="pawn" xray /><DeckPile count={35} label="Deck" xrayCard={choices[0]} onInspect={inspect} /><GameSidebar gameState={debugGame} viewerIndex={0} xray selectedCard={null} selectedFieldSlot={{ playerIndex: 1, type: 'pawn', index: 0 }} isOpen setIsOpen={() => {}} /></>));
    expect(root.root.findAllByType(XrayOverlay)).toHaveLength(2);
    const fieldOverlay = root.root.findByType(Zone).findByType(XrayOverlay);
    expect(fieldOverlay.parent.props.className).toContain('rotate-90');
    expect(fieldOverlay.parent.props['data-field-card-id']).toBe(hidden.card.instanceId);
    expect(root.root.findByType(GameSidebar).findByType(CardDetail).props.isSet).toBe(false);
    act(() => root.root.findByProps({ 'aria-label': 'Deck: 35 cards. Inspect top card' }).props.onClick());
    expect(inspect).toHaveBeenCalledOnce();
    expect(hidden.position).toBe(Position.HIDDEN);
    act(() => root.update(<><Zone card={hidden} type="pawn" /><DeckPile count={0} label="Deck" /><GameSidebar gameState={debugGame} viewerIndex={0} selectedCard={null} selectedFieldSlot={{ playerIndex: 1, type: 'pawn', index: 0 }} isOpen setIsOpen={() => {}} /></>));
    expect(root.root.findAllByType(XrayOverlay)).toHaveLength(0);
    expect(root.root.findByType(GameSidebar).findByType(CardDetail).props.isSet).toBe(true);
});
