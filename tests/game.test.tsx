import CardDatabase from '../src/components/CardDatabase';
import DeckCreator from '../src/components/DeckCreator';
import { CardDetail } from '../src/components/game/CardDetail';
import { GameSidebar } from '../src/components/game/GameSidebar';
import './fixtures/attachedCondition';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, GameState, Phase, Position } from '../src/types';
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
    setup(s => { s.players[0].pawnZones[0] = placed(sparker); s.players[1].lp = 10; s.players[1].actionZones[0] = { ...placed(card('test_attached_condition', 1)), position: Position.HIDDEN }; });
    act(() => game.actions.resolveEffect(sparker, undefined, undefined, undefined, undefined, 'summon'));
    expect(game.gameState!.response?.priority).toBe(1);
    act(() => game.actions.passResponse());
    expect(game.gameState!.winner).toBe('Player 1');
});

it('a set lingering deck search can activate, charges half LP once, and retains its source', () => {
    const mark = card('action_03'); const bear = card('pawn_07');
    setup(s => { s.players[0].actionZones[0] = { ...placed(mark), position: Position.HIDDEN }; s.players[0].deck = [bear]; });
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
    expect(game.gameState!.log[0]).toBe('"Solstice Sentinel" destroyed "Void Caster" by battle. "Player 2" -20 LP.');
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

it('automated drawing refills to five and advances exactly one turn under StrictMode', () => {
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].hand = [card('action_01')]; s.players[0].deck = Array.from({ length: 10 }, () => card('pawn_01')); });
    act(() => vi.advanceTimersByTime(1700));
    expect(game.gameState!.players[0].hand).toHaveLength(5);
    expect(game.gameState!.currentPhase).toBe(Phase.STANDBY);
    act(() => vi.advanceTimersByTime(1200));
    expect(game.gameState!.currentPhase).toBe(Phase.MAIN1);
    expect(game.gameState!.turnNumber).toBe(2);
});

it('skips the remaining phases to End while applying End Phase maintenance', () => {
    const sentinel = card('pawn_01');
    setup(s => {
        s.currentPhase = Phase.MAIN1;
        sentinel.atk += 100;
        s.players[0].pawnZones[0] = placed(sentinel);
        s.pendingEffects = [{ type: 'RESET_ATK', targetInstanceId: sentinel.instanceId, value: sentinel.atk - 100, dueTurn: s.turnNumber }];
    });
    act(() => game.actions.skipToEndPhase());
    expect(game.gameState!.currentPhase).toBe(Phase.END);
    expect(game.gameState!.players[0].pawnZones[0]!.card.atk).toBe(sentinel.atk - 100);
    expect(game.gameState!.pendingEffects).toHaveLength(0);
});

it('adds a numbered turn divider to the system log between turns', () => {
    setup(s => { s.currentPhase = Phase.END; s.log = ['Last action', 'Turn 2']; });
    act(() => game.actions.nextPhase());
    expect(game.gameState!.currentPhase).toBe(Phase.DRAW);
    expect(game.gameState!.turnNumber).toBe(3);
    expect(game.gameState!.log).toEqual(['Turn 3', 'Last action', 'Turn 2']);
});

it('opens a card preview from a linked card name in the system log', () => {
    const state = { ...game.gameState!, log: ['"Void Blast" activated.', 'Turn 2'] };
    let sidebar: ReturnType<typeof create>;
    act(() => {
        sidebar = create(<GameSidebar gameState={state} selectedCard={null} selectedFieldSlot={null} isOpen={true} setIsOpen={() => {}} />);
    });
    const link = sidebar!.root.findAllByType('button').find(button => button.children.join('') === '"Void Blast"');
    expect(link).toBeDefined();
    expect(sidebar!.root.findByProps({ role: 'separator' }).props['aria-label']).toBe('Turn 2');
    act(() => link!.props.onClick());
    expect(sidebar!.root.findByType(CardDetail).props.card.id).toBe('action_01');
    act(() => sidebar!.unmount());
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
    expect(game.gameState!.players[0].pawnZones[0]?.card.instanceId).toBe(king.instanceId);
    expect(game.gameState!.players[0].discard.at(-1)?.instanceId).toBe(tributeId);
    expect(game.state.targetSelectMode).toBeNull();
});


it('shows Reinforcement in the database and deck editor, including exact-name search', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('localStorage', { getItem: () => null });
    let catalog: ReturnType<typeof create>;
    act(() => { catalog = create(<CardDatabase onBack={() => {}} />); });
    const visible = () => catalog.root.findAllByType(CardDetail).some(face => face.props.card.id === 'condition_01' && face.props.card.isAttached);
    expect(visible()).toBe(true);
    act(() => catalog.root.findByType('input').props.onChange({ target: { value: 'Reinforcement' } }));
    expect(visible()).toBe(true);
    act(() => catalog.unmount());
    act(() => { catalog = create(<DeckCreator onBack={() => {}} />); });
    act(() => catalog.root.findAllByType('button').find(button => button.children.includes(' New deck'))!.props.onClick());
    expect(visible()).toBe(true);
    act(() => catalog.root.findByProps({ 'aria-label': 'Search cards' }).props.onChange({ target: { value: 'Reinforcement' } }));
    expect(catalog.root.findAllByProps({ 'aria-label': 'Add Reinforcement' }).length).toBeGreaterThan(0);
    expect(visible()).toBe(true);
    act(() => catalog.unmount());
});
