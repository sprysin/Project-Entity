import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Attribute, Card, GameState, Phase, Position } from '../src/types';
import { GameOverlays } from '../src/components/game/GameOverlays';
import { GameSidebar } from '../src/components/game/GameSidebar';
import { playSound } from '../src/audio';
vi.mock('../src/audio', () => ({ playSound: vi.fn() }));
vi.mock('../src/desktop/files', () => ({ showMessage: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let game: ReturnType<typeof useGameLogic>;
let root: ReturnType<typeof create>;
let serial = 0;
const card = (id: string, player = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `test-${serial++}`, ownerId: `player${player + 1}` });
const placed = (c: Card) => ({ card: c, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
function Harness() {
    game = useGameLogic();
    return null;
}
function setup(edit: (s: GameState) => void) {
    act(() => game.setGameState(prev => {
        const s = structuredClone(prev!);
        s.turnNumber = 2; s.currentPhase = Phase.MAIN1;
        s.activePlayerIndex = 0;
        s.openingCoin = undefined;
        s.pendingResponse = undefined; s.pendingReactions = []; s.pendingTriggers = [];
        s.pendingChainTarget = undefined;
        s.response = undefined; s.chain = []; s.resolvingChain = undefined; s.deferredAction = undefined;
        for (const p of s.players) {
            p.hand = []; p.deck = []; p.discard = []; p.pawnZones.fill(null); p.actionZones.fill(null);
            p.normalSummonUsed = false; p.hiddenSummonUsed = false; p.activatedHardOncePerTurns = [];
        }
        edit(s); return s;
    }));
}
beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(playSound).mockClear();
    act(() => { root = create(<React.StrictMode><Harness /></React.StrictMode>); });
    act(() => vi.advanceTimersByTime(2400));
    act(() => game.actions.chooseTurnOrder('first'));
    expect(vi.mocked(playSound).mock.calls.filter(([sound]) => sound === 'turn-change')).toHaveLength(1);
});
afterEach(() => { act(() => root.unmount()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('retains inspected cards across phase resets without revealing hidden cards or another viewer’s hand', () => {
    const pawn = card('P_Solstice_Sentinel');
    setup(s => { s.players[0].hand = [pawn]; s.players[1].pawnZones[0] = { ...placed(card('P_Void_Caster', 1)), position: Position.HIDDEN }; });
    let sidebar: ReturnType<typeof create>;
    const render = (selectedCard: Card | null, selectedFieldSlot: React.ComponentProps<typeof GameSidebar>['selectedFieldSlot'] = null, viewerIndex = 0) =>
        <GameSidebar gameState={game.gameState!} selectedCard={selectedCard} selectedFieldSlot={selectedFieldSlot} viewerIndex={viewerIndex} isOpen setIsOpen={() => {}} />;
    act(() => { sidebar = create(render(pawn)); });
    act(() => game.setGameState(previous => ({ ...previous!, currentPhase: Phase.BATTLE })));
    act(() => sidebar!.update(render(null)));
    expect(sidebar!.root.findAllByProps({ 'aria-label': `Preview ${pawn.name}` })).toHaveLength(1);
    act(() => sidebar!.update(render(null, { playerIndex: 1, type: 'pawn', index: 0 })));
    expect(sidebar!.root.findByProps({ 'aria-label': 'Hidden card' }).props.disabled).toBe(true);
    act(() => sidebar!.update(render(null)));
    expect(sidebar!.root.findByProps({ 'aria-label': 'Hidden card' }).props.disabled).toBe(true);
    act(() => sidebar!.update(render(pawn)));
    act(() => sidebar!.update(render(null, null, 1)));
    expect(sidebar!.root.findAllByProps({ 'aria-label': `Preview ${pawn.name}` })).toHaveLength(0);
    act(() => sidebar!.unmount());
});

it('prompts only after cards settle and honors a chosen special-summon slot', async () => {
    const eligibleCaster = card('P_Void_Caster');
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    let finishLanding!: () => void;
    const landing = { finished: new Promise<void>(resolve => { finishLanding = resolve; }), pause: vi.fn() };
    const animate = vi.fn(() => landing);
    const rect = { left: 0, top: 0, width: 100, height: 150 };
    const handElement = { getBoundingClientRect: () => rect, querySelector: () => null };
    const fieldElement = { getBoundingClientRect: () => rect,
        querySelector: (selector: string) => selector === '[data-card-face]' ? { animate } : null };
    game.actions.setRef('0-hand-0')(handElement as unknown as HTMLElement);
    game.actions.setRef('0-pawn-0')(fieldElement as unknown as HTMLElement);
    setup(s => {
        s.players[0].hand = [eligibleCaster]; s.players[0].discard = [card('A_Void_Blast')];
        s.players[0].deck = Array.from({ length: 40 }, () => card('P_Solstice_Sentinel'));
    });
    act(() => game.actions.handleSummon(eligibleCaster, 'normal', 0));
    expect(animate).toHaveBeenCalledOnce();
    const promptView = () => <GameOverlays gameState={game.gameState!} state={game.state} actions={game.actions}
        activePlayer={game.gameState!.players[0]} actionsDisabled viewerIndex={0} onQuit={() => {}} />;
    let prompt: ReturnType<typeof create>;
    act(() => { prompt = create(promptView()); });
    expect(prompt!.root.findAllByProps({ 'aria-label': 'Summon effect prompt' })).toHaveLength(0);
    // Travel can finish before the field landing animation; both must settle.
    act(() => game.state.cardMotions.forEach(motion => game.state.finishMotion(motion.id)));
    expect(game.state.cardMovementPending).toBe(true);
    act(() => { vi.advanceTimersByTime(5000); prompt!.update(promptView()); });
    expect(prompt!.root.findAllByProps({ 'aria-label': 'Summon effect prompt' })).toHaveLength(0);
    expect(landing.pause).not.toHaveBeenCalled();
    await act(async () => { finishLanding(); });
    act(() => prompt!.update(promptView()));
    expect(prompt!.root.findAllByProps({ 'aria-label': 'Summon effect prompt' })).toHaveLength(1);
    act(() => prompt!.unmount());
    game.actions.setRef('0-hand-0')(null);
    game.actions.setRef('0-pawn-0')(null);
    vi.unstubAllGlobals();
    const waitingForActivation = game.gameState!;
    act(() => { game.actions.setIsPeekingField(true); vi.advanceTimersByTime(5000); });
    expect(game.gameState).toBe(waitingForActivation);
    act(() => game.actions.resolveEffect(eligibleCaster, undefined, undefined, undefined, undefined, 'summon'));
    expect(game.state.discardSelectionReq).not.toBeNull();
    const waitingForSelection = game.gameState!;
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState).toBe(waitingForSelection);
    act(() => game.actions.handleDiscardSelection(0));
    expect(game.gameState!.pendingActivation).toBeUndefined();
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].hand).toHaveLength(1);

    const handSummon = card('C_Orcustrated_Frontline_Unit', 1);
    const light = card('P_Solstice_Sentinel', 1);
    setup(s => {
        s.activePlayerIndex = 0;
        s.players[1].actionZones[0] = placed(handSummon);
        s.players[1].hand = [light];
        s.pendingHandSummons = [{ sourceId: handSummon.instanceId, playerIndex: 1 }];
    });
    act(() => game.actions.setTriggeredEffect(null));
    act(() => game.actions.handSummonChooseCard(0));
    act(() => game.actions.confirmHandSummon(3, Position.DEFENSE));
    expect(game.gameState!.players[1].pawnZones[0]).toBeNull();
    expect(game.gameState!.players[1].pawnZones[3]?.card.instanceId).toBe(light.instanceId);
    expect(game.gameState!.players[1].pawnZones[3]?.position).toBe(Position.DEFENSE);
});

it('holds attacks and battle-destruction choices before mandatory effects move the defeated card', () => {
    setup(s => { s.currentPhase = Phase.BATTLE; s.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel')); s.players[1].pawnZones[0] = placed(card('P_Void_Caster', 1)); });
    act(() => game.actions.handleAttack(0, 0));
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
    expect(game.gameState!.log[0]).toBe('"Solstice Sentinel" destroyed "Void Caster" by battle. "Player 2" -20 LP.');
    for (const accept of [false, true]) {
        const necromancer = card('P_Zombie_Necromancer');
        const knight = card('P_Cockroach_Knight', 1);
        const recruit = { ...card('P_Solstice_Sentinel', 1), attribute: Attribute.EARTH, atk: 100 };
        setup(s => {
            s.response = undefined; s.deferredAction = undefined; s.chain = []; s.resolvingChain = undefined;
            s.currentPhase = Phase.BATTLE; s.activePlayerIndex = 0;
            s.players[0].pawnZones[0] = placed(necromancer);
            s.players[1].pawnZones[0] = placed(knight);
            s.players[1].deck = [recruit];
        });
        act(() => game.actions.handleAttack(0, 0));
        act(() => vi.advanceTimersByTime(1500));
        expect(game.state.triggeredEffect?.instanceId).toBe(knight.instanceId);
        const expectKnightInDiscard = () => {
            expect(game.gameState!.players[1].discard.map(value => value.instanceId)).toContain(knight.instanceId);
            expect(game.gameState!.players.flatMap(player => player.pawnZones).some(zone => zone?.card.instanceId === knight.instanceId)).toBe(false);
        };
        expectKnightInDiscard();
        let overlay: ReturnType<typeof create>;
        act(() => { overlay = create(<GameOverlays gameState={game.gameState!} state={game.state} actions={game.actions}
            activePlayer={game.gameState!.players[0]} actionsDisabled viewerIndex={1} onQuit={() => {}} />); });
        expect(overlay!.root.findAllByProps({ 'aria-label': 'Summon effect prompt' })).toHaveLength(1);
        act(() => vi.advanceTimersByTime(5000));
        expectKnightInDiscard();
        if (accept) {
            act(() => game.actions.resolveEffect(knight, undefined, undefined, undefined, undefined, 'battle_destroyed'));
            expect(game.state.deckSelectionReq).not.toBeNull();
            act(() => vi.advanceTimersByTime(5000));
            expectKnightInDiscard();
            act(() => game.actions.handleDeckSelection(0));
            expect(game.state.pawnPlacementReq).not.toBeNull();
            act(() => vi.advanceTimersByTime(5000));
            expectKnightInDiscard();
            act(() => game.actions.handlePawnPlacement(2, Position.ATTACK));
            act(() => vi.advanceTimersByTime(0));
            expectKnightInDiscard();
            expect(game.gameState!.players[1].pawnZones[2]?.card.instanceId).toBe(recruit.instanceId);
        } else {
            act(() => overlay!.root.findAllByType('button').find(button => button.children.includes('Decline'))!.props.onClick());
            expectKnightInDiscard();
        }
        act(() => vi.advanceTimersByTime(0));
        expect(game.gameState!.players[0].pawnZones[1]?.card.instanceId).toBe(knight.instanceId);
        expect(game.gameState!.players[0].pawnZones[1]?.position).toBe(Position.DEFENSE);
        expect(game.gameState!.players[1].discard).toHaveLength(0);
        act(() => overlay!.unmount());
        vi.unstubAllGlobals();
    }
});

it('discard and tribute costs are paid once after all activation selections are complete', () => {
    const beast = card('P_Dual_Mode_Beast'); const cost = card('A_Void_Blast');
    setup(s => { s.players[0].pawnZones[0] = placed(beast); s.players[0].hand = [cost]; s.players[1].pawnZones[0] = placed(card('P_Solstice_Sentinel', 1)); });
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
    const maintenance = card('A_Mechanical_Maintenance'); const recovered = card('P_Solstice_Sentinel');
    setup(s => { s.players[0].hand = [maintenance]; s.players[0].discard = [recovered]; s.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel')); s.players[0].pawnZones[1] = placed(card('P_Void_Caster')); });
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

    const contract = card('A_Scripture_Of_Faith'), patron = card('P_Patron_Of_Judgement');
    const handMaterial = { ...card('P_Solstice_Sentinel'), level: 4 as const }, fieldMaterial = { ...card('P_High_King'), level: 6 as const };
    setup(s => {
        s.players[0].hand = [contract, handMaterial]; s.players[0].reserve = [patron];
        s.players[0].pawnZones = Array.from({ length: 5 }, (_, i) => placed(i === 2 ? fieldMaterial : card('P_Solstice_Sentinel')));
    });
    act(() => game.actions.handleActionFromHand(contract, 'activate', 0));
    expect(game.state.levelTributeReq?.totalLevel).toBe(10);
    act(() => game.actions.handleLevelTribute([handMaterial.instanceId, fieldMaterial.instanceId]));
    expect(game.state.reserveSelectionReq).not.toBeNull();
    expect(game.gameState!.players[0].discard).toEqual([]);
    act(() => game.actions.handleReserveSelection(0));
    expect(game.state.pawnPlacementReq?.slots).toEqual([2]);
    act(() => game.actions.handlePawnPlacement(2, Position.DEFENSE));
    act(() => vi.advanceTimersByTime(500));
    expect(game.state.pendingEffectCard).toBeNull();
    expect(game.gameState!.players[0].reserve).toEqual([]);
    expect(game.gameState!.players[0].pawnZones[2]).toMatchObject({ card: { instanceId: patron.instanceId }, position: Position.DEFENSE });
    expect(game.gameState!.players[0].discard).toHaveLength(3);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();
});
