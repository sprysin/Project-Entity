import './fixtures/attachedCondition';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Attribute, Card, GameState, Phase, Position, OpponentMode, PlaytestDebugSettings } from '../src/types';
import { Zone } from '../src/components/game/Zone';
import * as audio from '../src/audio';
import PlaytestSetup from '../src/components/decks/PlaytestSetup';
import { DeckPile } from '../src/components/game/Pile';
import { XrayOverlay } from '../src/components/game/XrayOverlay';
import { GameSidebar } from '../src/components/game/GameSidebar';
import { CardReveal } from '../src/components/game/CardReveal';
import { CardDetail } from '../src/components/cards/CardDetail';
import { detectSummonReverbs } from '../src/components/game/SummonReverb';
import { WinnerModal } from '../src/components/game/MatchModals';
import { getDuelMvp } from '../src/game/mvp';
import { GameOverlays } from '../src/components/game/GameOverlays';
import { DiscardSelectionModal } from '../src/components/game/SelectionModals';
import { HealthHud } from '../src/components/game/HealthHud';
import { useAnimations } from '../src/hooks/useAnimations';
import { useCardMotion } from '../src/hooks/useCardMotion';
import { buildEffect } from '../src/cards/engine/Builder';
import { Effect } from '../src/cards/engine/Effects';
vi.mock('../src/desktop/files', () => ({ showMessage: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let game: ReturnType<typeof useGameLogic>;
let root: ReturnType<typeof create>;
let serial = 0;
let gameRenders = 0;
const card = (id: string, player = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `test-${serial++}`, ownerId: `player${player + 1}` });
const placed = (c: Card) => ({ card: c, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
function Harness() {
    gameRenders++;
    game = useGameLogic();
    return game.gameState ? <HealthHud player={game.gameState.players[1]} position="opponent" flash={game.state.lpFlash[1]} /> : null;
}
function setup(edit: (s: GameState) => void) {
    act(() => game.setGameState(prev => {
        const s = structuredClone(prev!);
        s.turnNumber = 2; s.currentPhase = Phase.MAIN1;
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
beforeEach(() => { vi.useFakeTimers(); act(() => { root = create(<React.StrictMode><Harness /></React.StrictMode>); }); });
afterEach(() => { act(() => root.unmount()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('prompts only after cards settle and honors a chosen special-summon slot', async () => {
    const recovery = card('A_Quick_Recovery');
    setup(s => { s.players[0].hand = [recovery]; s.players[0].discard = [card('P_Void_Caster')]; });
    const previousLog = game.gameState!.log;
    act(() => game.actions.handleActionFromHand(recovery, 'activate', 0));
    expect(game.gameState!.log).toBe(previousLog);
    expect(game.gameState!.players[0].hand[0].instanceId).toBe(recovery.instanceId);
    expect(game.gameState!.players[0].actionZones[0]).toBeNull();

    const caster = card('P_Void_Caster');
    setup(s => { s.players[0].hand = [caster]; });
    act(() => game.actions.handleSummon(caster, 'normal', 0));
    expect(game.state.triggeredEffect).toBeNull();

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
    const measureDeck = vi.fn(() => rect);
    game.actions.setRef('deck-0')({ getBoundingClientRect: measureDeck } as unknown as HTMLElement);
    setup(s => {
        s.players[0].hand = [eligibleCaster]; s.players[0].discard = [card('A_Void_Blast')];
        s.players[0].deck = Array.from({ length: 40 }, () => card('P_Solstice_Sentinel'));
    });
    expect(measureDeck).toHaveBeenCalledOnce();
    act(() => game.actions.handleSummon(eligibleCaster, 'normal', 0));
    expect(game.state.triggeredEffect?.instanceId).toBe(eligibleCaster.instanceId);
    expect(game.state.cardMovementPending).toBe(true);
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
    expect(game.state.cardMovementPending).toBe(false);
    act(() => prompt!.update(promptView()));
    expect(prompt!.root.findAllByProps({ 'aria-label': 'Summon effect prompt' })).toHaveLength(1);
    act(() => prompt!.unmount());
    game.actions.setRef('0-hand-0')(null);
    game.actions.setRef('0-pawn-0')(null);
    game.actions.setRef('deck-0')(null);
    vi.unstubAllGlobals();
    const waitingForActivation = game.gameState!;
    act(() => { game.actions.setIsPeekingField(true); vi.advanceTimersByTime(5000); });
    expect(game.gameState).toBe(waitingForActivation);
    expect(game.gameState!.pendingActivation).toMatchObject({ cardId: eligibleCaster.instanceId, playerIndex: 0 });
    act(() => game.actions.resolveEffect(eligibleCaster, undefined, undefined, undefined, undefined, 'summon'));
    expect(game.state.discardSelectionReq).not.toBeNull();
    let discardModal: ReturnType<typeof create>;
    act(() => { discardModal = create(<DiscardSelectionModal selectionReq={game.state.discardSelectionReq} gameState={game.gameState}
        selectedDiscardIndex={game.state.selectedDiscardIndex} setSelectedDiscardIndex={game.actions.setSelectedDiscardIndex}
        handleDiscardSelection={game.actions.handleDiscardSelection} />); });
    expect(discardModal!.root.findByProps({ 'aria-label': 'Discard pile search' }).props.className).toContain('duel-prompt--card-search');
    expect(discardModal!.root.findAllByType('button').filter(button => button.children.includes('Cancel'))).toHaveLength(0);
    const promptEvents = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('window', promptEvents);
    act(() => discardModal!.root.findByProps({ 'aria-label': 'Hide prompt and peek at field' }).props.onClick());
    expect(discardModal!.root.findByProps({ 'aria-label': 'Discard pile search' }).props['aria-modal']).toBe(false);
    const escape = new Event('keydown', { cancelable: true });
    Object.defineProperty(escape, 'key', { value: 'Escape' });
    act(() => promptEvents.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);
    expect(discardModal!.root.findByProps({ 'aria-label': 'Discard pile search' }).props['aria-modal']).toBe(true);
    act(() => discardModal!.unmount());
    const waitingForSelection = game.gameState!;
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState).toBe(waitingForSelection);
    act(() => game.actions.handleDiscardSelection(0));
    expect(game.gameState!.pendingActivation).toBeUndefined();
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].hand).toHaveLength(1);

    // A decision opened during Draw cancels queued draws and resumes them on decline.
    setup(s => { s.currentPhase = Phase.DRAW; s.drawProgress = undefined; s.players[0].deck = Array.from({ length: 6 }, () => card('P_Solstice_Sentinel')); });
    act(() => game.actions.setTriggeredEffect(eligibleCaster));
    const waitingDuringDraw = game.gameState!;
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState).toBe(waitingDuringDraw);
    act(() => game.actions.setTriggeredEffect(null));
    act(() => vi.advanceTimersByTime(300));
    expect(game.gameState!.players[0].hand).toHaveLength(1);

    const tributeSummon: Card = { ...card('P_Solstice_Sentinel'), level: 5 };
    setup(s => {
        s.players[0].hand = [tributeSummon];
        s.players[0].pawnZones = s.players[0].pawnZones.map(() => placed(card('P_Solstice_Sentinel')));
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
    expect(game.state.handSummonCardId).toBe(light.instanceId);
    act(() => game.actions.confirmHandSummon(3, Position.DEFENSE));
    expect(game.gameState!.players[1].pawnZones[0]).toBeNull();
    expect(game.gameState!.players[1].pawnZones[3]?.card.instanceId).toBe(light.instanceId);
    expect(game.gameState!.players[1].pawnZones[3]?.position).toBe(Position.DEFENSE);
    expect(game.state.handSummonCardId).toBeNull();

    for (const position of [Position.ATTACK, Position.DEFENSE, Position.HIDDEN]) {
        setup(s => { s.pendingHandSummons = []; s.players[1].void = [light]; s.pendingVoidReturns = [{ cardId: light.instanceId, playerIndex: 1, position }]; });
        expect(game.state.pawnPlacementReq).toMatchObject({ playerIndex: 1, position });
        act(() => game.actions.handlePawnPlacement(2, Position.ATTACK));
        expect(game.gameState!.players[1].pawnZones[2]).toMatchObject({ card: light, position });
        expect(game.gameState!.pendingHandSummons).toEqual([]);
    }

    const tribunal = card('A_Tribute_Tribunal');
    const pawn = { ...card('P_Solstice_Sentinel'), level: 5 as const };
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
        next.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel'));
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

    const beforeReverb = structuredClone(game.gameState!);
    beforeReverb.players.forEach(player => player.pawnZones.fill(null));
    const boss = { ...card('P_Solstice_Sentinel', 1), level: 8 as const, attribute: Attribute.WATER };
    const ordinary = { ...card('P_Solstice_Sentinel'), level: 7 as const };
    const afterReverb = structuredClone(beforeReverb);
    afterReverb.players[1].pawnZones[3] = placed(boss);
    afterReverb.players[0].pawnZones[0] = placed(ordinary);
    expect(detectSummonReverbs(beforeReverb, afterReverb)).toEqual([{ playerIndex: 1, slot: 3, color: '#4d9cff', instanceId: boss.instanceId }]);
    const hidden = structuredClone(beforeReverb);
    hidden.players[1].pawnZones[3] = { ...placed(boss), position: Position.HIDDEN };
    expect(detectSummonReverbs(beforeReverb, hidden)).toEqual([]);
    expect(detectSummonReverbs(hidden, afterReverb)).toEqual([]);
    const moved = structuredClone(afterReverb);
    moved.players[1].pawnZones[4] = moved.players[1].pawnZones[3];
    moved.players[1].pawnZones[3] = null;
    expect(detectSummonReverbs(afterReverb, moved)).toEqual([]);

    const responseCards = [card('C_Dark_Draw'), card('C_Dark_Draw'), card('C_Void_Call')];
    setup(s => {
        s.activePlayerIndex = 1;
        s.currentPhase = Phase.STANDBY;
        s.players[0].lp = 800;
        s.players[0].pawnZones[0] = placed({ ...card('P_Void_Caster'), attribute: Attribute.DARK });
        s.players[0].deck = [card('P_Solstice_Sentinel')];
        responseCards.forEach((c, index) => { s.players[0].actionZones[index] = { ...placed(c), position: Position.HIDDEN }; });
        s.players[0].actionZones[3] = { ...placed(card('C_Dark_Draw')), position: Position.HIDDEN, summonedTurn: 2 };
        s.response = { priority: 0, passes: 0, reason: 'Leave STANDBY' };
        s.chain = [];
    });
    const responseView = () => <>
        <GameOverlays gameState={game.gameState!} state={game.state} actions={game.actions} actionsDisabled viewerIndex={0} onQuit={() => {}} />
        <GameSidebar gameState={game.gameState!} viewerIndex={0} selectedCard={null} selectedFieldSlot={game.state.selectedFieldSlot}
            isOpen={game.state.isRightPanelOpen} setIsOpen={game.actions.setIsRightPanelOpen} />
    </>;
    act(() => { overlay = create(responseView()); });
    expect(overlay!.root.findByType('h2').findAllByType('span').map(span => span.children.join('')))
        .toEqual(['Opponent Leaving STANDBY', '-', 'Activate a card or effect?']);
    const responseButtons = () => overlay!.root.findByProps({ 'aria-label': 'Activatable response cards' }).findAllByType('button');
    const activateResponse = () => overlay!.root.findAllByType('button').find(button => button.children.includes('Activate'))!;
    expect(activateResponse().props.disabled).toBe(true);
    expect(responseButtons().map(button => button.findByType(CardDetail).props.card.instanceId)).toEqual(responseCards.map(c => c.instanceId));
    expect(overlay!.root.findAllByProps({ 'aria-label': 'Response field controls' })).toHaveLength(0);
    act(() => overlay!.root.findByProps({ 'aria-label': 'Hide prompt and peek at field' }).props.onClick());
    expect(game.state.responseFieldMode).toBe('peek');
    expect(game.gameState!.chain).toEqual([]);
    act(() => overlay!.update(responseView()));
    act(() => overlay!.root.findByProps({ 'aria-label': 'Return to response window' }).props.onClick());
    act(() => responseButtons()[0].props.onClick());
    act(() => overlay!.update(responseView()));
    expect(game.state.isRightPanelOpen).toBe(true);
    expect(overlay!.root.findByType(GameSidebar).findByType(CardDetail).props).toMatchObject({ card: responseCards[0], isSet: false });
    expect(game.gameState!.chain).toEqual([]);
    expect(game.gameState!.players[0].lp).toBe(800);
    expect(responseButtons()[0].props['aria-pressed']).toBe(true);
    expect(activateResponse().props.disabled).toBe(false);
    act(() => responseButtons()[1].props.onClick());
    act(() => overlay!.update(responseView()));
    expect(overlay!.root.findByType(GameSidebar).findByType(CardDetail).props.card.instanceId).toBe(responseCards[1].instanceId);
    expect(responseButtons().map(button => button.props['aria-pressed'])).toEqual([false, true, false]);
    expect(game.gameState!.chain).toEqual([]);
    act(() => responseButtons()[0].props.onClick());
    act(() => activateResponse().props.onClick());
    expect(game.state.responseFieldMode).toBeNull();
    expect(game.gameState!.chain?.[0].context.card.instanceId).toBe(responseCards[0].instanceId);
    expect(game.gameState!.players[0].lp).toBe(800);
    act(() => overlay!.update(responseView()));
    expect(activateResponse().props.disabled).toBe(true);
    expect(responseButtons().map(button => button.findByType(CardDetail).props.card.instanceId)).toEqual(responseCards.slice(1).map(c => c.instanceId));
    act(() => overlay!.root.findByProps({ 'aria-label': 'Select Void Call' }).props.onClick());
    expect(game.state.pendingEffectCard).toBeNull();
    act(() => activateResponse().props.onClick());
    expect(game.state.pendingEffectCard?.instanceId).toBe(responseCards[2].instanceId);
    const waitingForResponseTarget = game.gameState!;
    act(() => { game.actions.passResponse(); vi.advanceTimersByTime(5000); });
    expect(game.gameState).toBe(waitingForResponseTarget);
    expect(game.state.targetSelectMode).toBe('effect');
    act(() => overlay!.update(responseView()));
    expect(overlay!.root.findAllByProps({ 'aria-label': 'Activatable response cards' })).toHaveLength(0);
    act(() => game.actions.cancelEffect());
    act(() => overlay!.update(responseView()));
    act(() => overlay!.root.findAllByType('button').find(button => button.children.includes('Decline'))!.props.onClick());
    expect(game.gameState!.resolvingChain).toBeDefined();
    act(() => overlay!.unmount());
    const outlander = card('P_Future_Outlander'), dragon = card('P_Everlasting_Dragonlord', 1), other = card('P_Quickstrike_Serpent', 1);
    act(() => game.actions.setActivationPopupMode('on'));
    setup(s => {
        s.activePlayerIndex = 0;
        s.players[0].pawnZones[0] = placed(outlander);
        s.players[1].pawnZones[0] = placed(dragon);
        s.players[1].pawnZones[1] = placed(other);
    });
    act(() => game.actions.resolveEffect(outlander));
    expect(game.state.targetSelectMode).toBeNull();
    expect(game.gameState!.chain?.[0].context.target).toBeUndefined();
    expect(game.gameState!.response?.priority).toBe(1);
    act(() => game.actions.respond(dragon.instanceId));
    for (let i = 0; i < 8; i++) act(() => vi.advanceTimersByTime(0));
    expect(game.gameState!.players[1].pawnZones[0]?.card.effectTargetBlockedThisTurn).toBe(true);
    expect(game.gameState!.pendingChainTarget).toBe(true);
    expect(game.state.targetSelectMode).toBe('effect');
    expect(game.state.pendingEffectCard?.instanceId).toBe(outlander.instanceId);
    const choosing = game.gameState;
    act(() => { game.actions.nextPhase(); game.actions.passResponse(); vi.advanceTimersByTime(5000); });
    expect(game.gameState).toBe(choosing);
    act(() => game.actions.resolveEffect(outlander, { playerIndex: 1, type: 'pawn', index: 1 }));
    expect(game.gameState!.pendingChainTarget).toBeUndefined();
    expect(game.gameState!.chain).toEqual([]);
    expect(game.state.targetSelectMode).toBeNull();
    expect(game.gameState!.players[1].pawnZones[0]?.card.instanceId).toBe(dragon.instanceId);
    expect(game.gameState!.players[1].void.map(card => card.instanceId)).toEqual([other.instanceId]);
    for (const mode of ['off', 'auto', 'on'] as const) for (const timing of ['activation', 'minor_action'] as const) {
        setup(() => {});
        act(() => game.actions.setActivationPopupMode(mode));
        setup(s => {
            s.players[0].pawnZones[0] = placed(card('P_Void_Caster'));
            s.players[0].actionZones[0] = { ...placed(card('C_Dark_Draw')), position: Position.HIDDEN };
            s.players[0].deck = [card('P_Solstice_Sentinel')];
            s.response = { priority: 0, passes: 0, timing, reason: timing };
        });
        expect(!!game.gameState!.response).toBe(mode === 'on' || mode === 'auto' && timing === 'activation');
        if (game.gameState!.response) act(() => game.actions.passResponse());
    }
    act(() => game.actions.setActivationPopupMode('off'));
    const summonTrigger = card('P_Solstice_Sentinel');
    setup(s => { s.activePlayerIndex = 0; s.players[0].hand = [summonTrigger]; });
    act(() => game.actions.handleSummon(summonTrigger, 'normal', 0));
    expect(game.state.triggeredEffect?.instanceId).toBe(summonTrigger.instanceId);
    act(() => game.actions.cancelEffect());

});

it('holds attacks and battle-destruction choices before mandatory effects move the defeated card', async () => {
    setup(s => { s.currentPhase = Phase.BATTLE; s.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel')); s.players[1].pawnZones[0] = placed(card('P_Void_Caster', 1)); });
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
    const rendersBeforeCount = gameRenders;
    const lpValue = () => root.root.findAllByType('span').find(span => span.props.className?.includes('health-hud__lp-value'))!.children.join('');
    expect(lpValue()).toBe('800');
    act(() => vi.advanceTimersByTime(100));
    expect(lpValue()).toBe('790');
    expect(gameRenders).toBe(rendersBeforeCount);
    act(() => vi.advanceTimersByTime(100));
    expect(lpValue()).toBe('780');
    expect(gameRenders).toBe(rendersBeforeCount);
    act(() => game.actions.handleAttack(0, 'direct'));
    expect(game.gameState!.players[1].lp).toBe(780);

    for (const accept of [false, true]) {
        const necromancer = card('P_Zombie_Necromancer');
        const knight = card('P_Cockroach_Knight', 1);
        const recruit = { ...card('P_Solstice_Sentinel', 1), attribute: Attribute.EARTH, atk: 100 };
        let finishRecruitLanding!: () => void;
        if (accept) {
            vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
            const finished = new Promise<void>(resolve => { finishRecruitLanding = resolve; });
            const rect = { left: 0, top: 0, width: 100, height: 150 };
            game.actions.setRef('deck-1')({ getBoundingClientRect: () => rect, querySelector: () => null } as unknown as HTMLElement);
            game.actions.setRef('1-pawn-2')({ getBoundingClientRect: () => rect,
                querySelector: (selector: string) => selector === '[data-card-face]' ? { animate: () => ({ finished }) } : null } as unknown as HTMLElement);
        }
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
            // The next mandatory effect waits for the recruit to land, without a fixed gap afterward.
            expect(game.state.cardMovementPending).toBe(true);
            act(() => vi.advanceTimersByTime(5000));
            expectKnightInDiscard();
            act(() => game.state.cardMotions.forEach(motion => game.state.finishMotion(motion.id)));
            expect(game.state.cardMovementPending).toBe(true);
            await act(async () => { finishRecruitLanding(); });
            expect(game.state.cardMovementPending).toBe(false);
        } else {
            act(() => overlay!.root.findAllByType('button').find(button => button.children.includes('Decline'))!.props.onClick());
            expectKnightInDiscard();
        }
        act(() => vi.advanceTimersByTime(0));
        expect(game.gameState!.players[0].pawnZones[1]?.card.instanceId).toBe(knight.instanceId);
        expect(game.gameState!.players[0].pawnZones[1]?.position).toBe(Position.DEFENSE);
        expect(game.gameState!.players[1].discard).toHaveLength(0);
        act(() => overlay!.unmount());
        game.actions.setRef('deck-1')(null);
        game.actions.setRef('1-pawn-2')(null);
        vi.unstubAllGlobals();
    }
    // A new LP change retargets the active count; switching players never
    // interpolates between unrelated totals.
    const hudPlayer = game.gameState!.players[0];
    act(() => root.update(<HealthHud player={{ ...hudPlayer, lp: 800 }} position="active" flash={null} />));
    act(() => root.update(<HealthHud player={{ ...hudPlayer, lp: 600 }} position="active" flash="damage" />));
    act(() => vi.advanceTimersByTime(60));
    expect(lpValue()).toBe('740');
    act(() => root.update(<HealthHud player={{ ...hudPlayer, lp: 900 }} position="active" flash="heal" />));
    act(() => vi.advanceTimersByTime(200));
    expect(lpValue()).toBe('900');
    act(() => root.update(<HealthHud player={{ ...hudPlayer, id: 'other', lp: 350 }} position="opponent" flash={null} />));
    expect(lpValue()).toBe('350');
    act(() => vi.advanceTimersByTime(200));
    expect(lpValue()).toBe('350');

    const placementSound = vi.spyOn(audio, 'playSound').mockImplementation(() => {});
    for (const [id, type] of [['A_Shrouded_Kingdom', 'land'], ['A_Tribute_Tribunal', 'action']] as const) {
        const zoneCard = placed(card(id));
        act(() => root.update(<Zone card={null} type={type} />));
        placementSound.mockClear();
        act(() => root.update(<Zone card={zoneCard} type={type} />));
        expect(placementSound).toHaveBeenCalledExactlyOnceWith('hide-card');
        act(() => root.update(<Zone card={{ ...zoneCard }} type={type} />));
        expect(placementSound).toHaveBeenCalledTimes(1);
    }
    act(() => root.update(<Zone card={null} type="action" />));
    placementSound.mockClear();
    act(() => root.update(<Zone card={placed(card('A_Void_Blast'))} type="action" />));
    expect(placementSound).not.toHaveBeenCalled();
    placementSound.mockRestore();

    // Placement has one direct trip; only effects that leave the field need a stop.
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const motionCard = card('A_Void_Blast');
    const motionState = structuredClone(game.gameState!);
    motionState.players[0].hand = [motionCard];
    motionState.players[0].actionZones.fill(null);
    const rect = { left: 0, top: 0, width: 100, height: 150 } as DOMRect;
    const motionRefs = { current: new Map(['0-hand-0', '0-action-0', 'discard-0'].map(key =>
        [key, { getBoundingClientRect: () => rect, querySelector: () => null } as unknown as HTMLElement])) };
    let movement!: ReturnType<typeof useCardMotion>;
    function MotionHarness({ state }: { state: GameState }) { movement = useCardMotion(state, motionRefs, 0); return null; }
    for (const position of [Position.HIDDEN, Position.ATTACK]) {
        act(() => root.update(<MotionHarness state={structuredClone(motionState)} />));
        movement.recordMovement('0-hand-0', '0-action-0', 'discard', motionCard);
        const onField = structuredClone(motionState);
        onField.players[0].hand = [];
        onField.players[0].actionZones[0] = { ...placed(motionCard), position };
        act(() => root.update(<MotionHarness state={onField} />));
        expect(movement.motions).toHaveLength(1);
        expect(movement.motions[0].hidden).toBe(position === Position.HIDDEN);
        expect(movement.motions[0].delay).toBeUndefined();
        act(() => root.update(<div />));
    }
    act(() => root.update(<MotionHarness state={motionState} />));
    movement.recordMovement('0-hand-0', '0-action-0', 'discard', motionCard);
    const resolved = structuredClone(motionState);
    resolved.players[0].hand = [];
    resolved.players[0].discard = [motionCard];
    act(() => root.update(<MotionHarness state={resolved} />));
    expect(movement.motions).toHaveLength(2);
    expect(movement.motions[1].delay).toBe(650);
    const actionSound = vi.spyOn(audio, 'playSound');
    for (const destroy of [false, true]) {
        act(() => root.update(<div />));
        const onField = structuredClone(motionState);
        onField.players[0].hand = [];
        onField.players[0].actionZones[0] = { ...placed(motionCard), position: Position.HIDDEN };
        act(() => root.update(<MotionHarness state={onField} />));
        actionSound.mockClear();
        const removed = structuredClone(onField);
        removed.players[0].actionZones[0] = null;
        removed.players[0].discard.push(motionCard);
        if (destroy) removed.destroyedCardIds = [...(removed.destroyedCardIds ?? []), motionCard.instanceId];
        act(() => root.update(<MotionHarness state={removed} />));
        expect(actionSound.mock.calls.some(([sound]) => sound === 'action-condition-destroyed')).toBe(destroy);
        expect(movement.motions).toHaveLength(destroy ? 0 : 1);
    }
    actionSound.mockRestore();
    // Generated Bombs originate from their source even when it leaves in the same effect.
    for (const destination of [0, 1]) {
        act(() => root.update(<div />));
        const sourceRect = { ...rect, left: 50, top: 80 } as DOMRect;
        const deckRect = { ...rect, left: 400, top: 200 } as DOMRect;
        let finishShuffle!: () => void;
        const shuffle = vi.fn(() => ({ finished: new Promise<void>(resolve => { finishShuffle = resolve; }) }));
        motionRefs.current.set(`deck-${destination}`, { getBoundingClientRect: () => deckRect, animate: shuffle } as unknown as HTMLElement);
        motionRefs.current.set('0-action-0', { getBoundingClientRect: () => sourceRect, querySelector: () => null } as unknown as HTMLElement);
        const beforeBombs = structuredClone(motionState);
        beforeBombs.players[0].hand = [];
        beforeBombs.players[0].actionZones[0] = placed(motionCard);
        act(() => root.update(<MotionHarness state={beforeBombs} />));
        const afterBombs = buildEffect([Effect.SendTargetToDiscard(), Effect.ShuffleBombsIntoDeck('A_Jet_Explosive', 2, destination)])(beforeBombs, {
            card: motionCard, playerIndex: 0, target: { playerIndex: 0, type: 'action', index: 0 }
        }).newState;
        act(() => root.update(<MotionHarness state={afterBombs} />));
        const bombMotions = movement.motions.filter(motion => motion.card.id === 'A_Jet_Explosive');
        expect(bombMotions).toHaveLength(2);
        expect(bombMotions.every(motion => !motion.hidden && motion.from === sourceRect && motion.to === deckRect)).toBe(true);
        expect(bombMotions.map(motion => motion.delay)).toEqual([0, 200]);
        expect(shuffle).toHaveBeenCalledOnce();
        expect(bombMotions.every(motion => motion.duration === 1000 && motion.deckFlipDelay === 1500)).toBe(true);
        expect(shuffle.mock.calls[0]).toEqual([expect.any(Array), expect.objectContaining({ delay: 2250, duration: 450 })]);
        act(() => root.update(<MotionHarness state={structuredClone(afterBombs)} />));
        expect(shuffle).toHaveBeenCalledOnce();
        act(() => movement.motions.forEach(motion => movement.finishMotion(motion.id)));
        expect(movement.isMoving).toBe(true);
        await act(async () => { finishShuffle(); });
        expect(movement.isMoving).toBe(false);
        // Reduced motion skips both travel and shuffle without changing deck contents.
        act(() => root.update(<div />));
        vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
        act(() => root.update(<MotionHarness state={beforeBombs} />));
        act(() => root.update(<MotionHarness state={afterBombs} />));
        expect(movement.motions).toEqual([]);
        expect(shuffle).toHaveBeenCalledOnce();
        vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    }
    vi.unstubAllGlobals();

    // Overlapping shatters retain each card's face and clean up independently.
    let animations!: ReturnType<typeof useAnimations>;
    function AnimationHarness() { animations = useAnimations(); return null; }
    act(() => root.update(<AnimationHarness />));
    act(() => {
        for (const [index, rotated] of [false, true, false].entries()) {
            animations.triggerShatter('', { rect, cardMarkup: `<div>Card ${index}</div>`, rotated, faceDown: index === 2 });
        }
    });
    expect(animations.shatterEffects.map(effect => [effect.cardMarkup, effect.rotated, effect.faceDown])).toEqual([
        ['<div>Card 0</div>', false, false], ['<div>Card 1</div>', true, false], ['<div>Card 2</div>', false, true],
    ]);
    expect(animations.shatterEffects.every(effect => effect.shards.length <= 12)).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    act(() => animations.triggerShatter('', { rect, cardMarkup: '<div>Later card</div>', rotated: false, faceDown: false }));
    act(() => vi.advanceTimersByTime(1150));
    expect(animations.shatterEffects.map(effect => effect.cardMarkup)).toEqual(['<div>Later card</div>']);
    act(() => vi.advanceTimersByTime(100));
    expect(animations.shatterEffects).toEqual([]);
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
    expect(game.gameState!.log[0]).toContain('"Mechanical Maintenance" activated');
    expect(game.gameState!.log[0]).toContain('tributes "Solstice Sentinel", "Void Caster"');
    expect(game.gameState!.log[0]).toContain('special summons "Solstice Sentinel"');

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

    const zero = card('P_Justice_Jet_Zero_Day'), fighter = card('P_Justice_Jet_Fighter');
    setup(s => { s.players[0].pawnZones[0] = placed(zero); s.players[0].deck = [fighter]; });
    act(() => game.actions.activateOnField(0, 'pawn', 0));
    expect(game.state.deckSelectionReq).not.toBeNull();
    act(() => game.actions.handleDeckSelection(0));
    expect(game.state.handSelectionReq?.cards?.map(card => card.instanceId)).toEqual([fighter.instanceId]);
    expect(game.gameState!.players[0].hand).toEqual([]);
    act(() => game.actions.handleHandSelection(0));
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].discard[0].instanceId).toBe(fighter.instanceId);
    expect(game.gameState!.players[0].hand).toEqual([]);
    expect(game.gameState!.players[0].deck).toEqual([]);

    setup(s => {
        s.players[0].hand = [fighter];
        s.players[0].pawnZones = Array.from({ length: 5 }, (_, index) => placed(index === 2 ? zero : card('P_Solstice_Sentinel')));
    });
    act(() => game.actions.resolveEffect(fighter, undefined, undefined, undefined, undefined, 'hand_activate'));
    expect(game.state.targetSelectMode).toBe('effect');
    act(() => game.actions.resolveEffect(fighter, { playerIndex: 0, type: 'pawn', index: 2 }));
    expect(game.state.pawnPlacementReq?.slots).toEqual([2]);
    act(() => game.actions.handlePawnPlacement(2, Position.ATTACK));
    expect(game.gameState!.peekEvents?.[0].card.instanceId).toBe(fighter.instanceId);
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].pawnZones[2]?.card.instanceId).toBe(zero.instanceId);
    act(() => game.actions.dismissPeek(game.gameState!.peekEvents![0].id));
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].pawnZones[2]?.card.instanceId).toBe(fighter.instanceId);
    expect(game.gameState!.players[0].pawnZones[2]?.card.atk).toBe(220);
});

it('opening turns, AI-only debug setup, and automated drawing preserve hands and hidden card rules', () => {
    const openingGame = game.gameState;
    const destructionSound = vi.spyOn(audio, 'playSound');
    const face = { getBoundingClientRect: () => ({ width: 160, height: 240, left: 200, top: 100 }), innerHTML: 'Jet Explosive' };
    for (const playerIndex of [0, 1]) {
        destructionSound.mockClear();
        const bomb = card('A_Jet_Explosive', playerIndex);
        setup(s => { s.drawnBombs = [{ card: bomb, playerIndex }]; });
        let revealView: ReturnType<typeof create>;
        act(() => { revealView = create(<>
            <GameOverlays gameState={game.gameState!} state={game.state} actions={game.actions}
                activePlayer={game.gameState!.players[0]} actionsDisabled viewerIndex={0} onQuit={() => {}} />
            <CardReveal card={bomb} revealed onDestroy={game.actions.destroyDrawnBomb} onDismiss={() => game.actions.dismissDrawnBomb(bomb.instanceId)} />
            <GameSidebar gameState={game.gameState!} viewerIndex={0} selectedCard={null} selectedFieldSlot={null} isOpen={false} setIsOpen={() => {}} />
        </>, { createNodeMock: element => element.props.className?.includes('card-reveal-front') ? { querySelector: () => face } : null }); });
        expect(revealView!.root.findAllByProps({ 'aria-label': 'Bomb drawn' })).toHaveLength(0);
        expect(revealView!.root.findByType(CardReveal).findByType(CardDetail).props.card.id).toBe(bomb.id);
        expect(revealView!.root.findByType(GameSidebar).findByType(CardDetail).props.card.id).toBe(bomb.id);
        act(() => vi.advanceTimersByTime(1799));
        expect(destructionSound).not.toHaveBeenCalledWith('card-destruction');
        act(() => vi.advanceTimersByTime(1));
        expect(destructionSound).toHaveBeenCalledWith('card-destruction');
        act(() => vi.advanceTimersByTime(1300));
        expect(game.gameState!.drawnBombs).toEqual([]);
        act(() => revealView!.unmount());
    }
    const peeked = card('P_Solstice_Sentinel', 1);
    setup(s => { s.peekEvents = [{ id: 'witch-reveal', card: peeked, ownerPlayerIndex: 1, viewerPlayerIndex: 0 }]; });
    destructionSound.mockClear();
    let peekView: ReturnType<typeof create>;
    act(() => { peekView = create(<CardReveal card={peeked} revealed onDismiss={() => game.actions.dismissPeek('witch-reveal')} />); });
    act(() => vi.advanceTimersByTime(3100));
    expect(game.gameState!.peekEvents).toEqual([]);
    expect(destructionSound).not.toHaveBeenCalledWith('card-destruction');
    act(() => peekView!.unmount());
    destructionSound.mockRestore();
    act(() => game.setGameState(openingGame));

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
    setup(s => { s.currentPhase = Phase.DRAW; s.players[0].hand = [card('A_Void_Blast')]; s.players[0].deck = Array.from({ length: 10 }, () => card('P_Solstice_Sentinel')); });
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
    // An AI quick effect cannot interrupt any card in the required draw batch.
    act(() => game.actions.setActivationPopupMode('on'));
    setup(s => {
        s.activePlayerIndex = 0; s.currentPhase = Phase.DRAW; s.drawProgress = undefined;
        s.players[0].hand = [card('A_Void_Blast')];
        s.players[0].deck = Array.from({ length: 10 }, () => card('P_Solstice_Sentinel'));
        s.players[1].pawnZones[0] = placed(card('P_Everlasting_Dragonlord', 1));
    });
    let drawOverlay: ReturnType<typeof create>;
    const drawView = () => <GameOverlays gameState={game.gameState!} state={game.state} actions={game.actions}
        actionsDisabled viewerIndex={0} onQuit={() => {}} />;
    act(() => { drawOverlay = create(drawView()); });
    for (let i = 1; i <= 4; i++) {
        expect(drawOverlay!.root.findAllByProps({ role: 'status' })).toHaveLength(0);
        act(() => vi.advanceTimersByTime(300));
        expect(game.gameState!.players[0].hand).toHaveLength(i + 1);
        if (i < 4) expect(game.gameState!.response).toBeUndefined();
        act(() => drawOverlay!.update(drawView()));
    }
    expect(game.gameState!.response).toMatchObject({ timing: 'draw', priority: 1 });
    for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(0));
    expect(game.gameState!.currentPhase).toBe(Phase.STANDBY);
    act(() => drawOverlay!.unmount());
    // Live triggered effects must use scored targets, not the first legal Pawn.
    for (const withEnemy of [true, false]) {
        const king = card('P_High_King', 1);
        const ally = card('P_Solstice_Sentinel', 1);
        const enemy = card('P_Solstice_Sentinel');
        setup(s => {
            s.activePlayerIndex = 1;
            s.players[1].pawnZones[0] = { ...placed(king), summonedTurn: s.turnNumber };
            s.players[1].pawnZones[1] = placed(ally);
            if (withEnemy) s.players[0].pawnZones[0] = placed(enemy);
            s.pendingReactions = [{ card: king, playerIndex: 1, trigger: 'summon' }];
        });
        for (let i = 0; i < 8; i++) act(() => vi.advanceTimersByTime(0));
        expect(game.gameState!.players[1].pawnZones[0]?.card.atk).toBe(king.atk);
        expect(game.gameState!.players[1].pawnZones[1]?.card.atk).toBe(ally.atk);
        if (withEnemy) expect(game.gameState!.players[0].pawnZones[0]?.card.atk).toBe(enemy.atk - 20);
        expect(game.gameState!.pendingReactions).toEqual([]);
    }
    // Destruction reactions complete private choices on the human's turn.
    for (const sourceId of ['P_Cockroach_Knight', 'P_Soldier_Of_The_High_Ground']) {
        const source = card(sourceId, 1);
        const recruit = sourceId === 'P_Cockroach_Knight'
            ? { ...card('P_Solstice_Sentinel', 1), attribute: Attribute.EARTH, atk: 100 }
            : card('P_Infantry_Soldier', 1);
        setup(s => {
            s.activePlayerIndex = 0; s.currentPhase = Phase.BATTLE;
            s.players[1].discard = [source];
            if (sourceId === 'P_Cockroach_Knight') s.players[1].deck = [recruit, card('A_Void_Blast', 1)];
            else s.players[1].discard.push(recruit);
            s.pendingReactions = [{ card: source, playerIndex: 1,
                trigger: sourceId === 'P_Cockroach_Knight' ? 'battle_destroyed' : 'destroyed' }];
        });
        for (let i = 0; i < 10; i++) act(() => vi.advanceTimersByTime(0));
        expect(game.gameState!.pendingReactions).toEqual([]);
        expect(game.gameState!.chain).toEqual([]);
        expect(game.state.pendingEffectCard).toBeNull();
        if (sourceId === 'P_Cockroach_Knight') {
            expect(game.gameState!.players[1].pawnZones.some(z => z?.card.instanceId === recruit.instanceId)).toBe(true);
        } else expect(game.gameState!.players[1].hand.map(c => c.instanceId)).toContain(recruit.instanceId);
    }
    // The live AI chooses a target after the human's later protection link resolves.
    const future = card('P_Future_Outlander', 1), protectedDragon = card('P_Everlasting_Dragonlord'), exposed = card('P_Quickstrike_Serpent');
    act(() => game.actions.setActivationPopupMode('on'));
    setup(s => {
        s.activePlayerIndex = 0;
        s.players[1].pawnZones[0] = placed(future);
        s.players[0].pawnZones[0] = placed(protectedDragon);
        s.players[0].pawnZones[1] = placed(exposed);
    });
    act(() => game.actions.resolveEffect(future));
    expect(game.state.targetSelectMode).toBeNull();
    act(() => game.actions.respond(protectedDragon.instanceId));
    for (let i = 0; i < 8; i++) act(() => vi.advanceTimersByTime(0));
    expect(game.gameState!.chain).toEqual([]);
    expect(game.gameState!.pendingChainTarget).toBeUndefined();
    expect(game.gameState!.players[0].pawnZones[0]?.card.effectTargetBlockedThisTurn).toBe(true);
    expect(game.gameState!.players[0].void.map(card => card.instanceId)).toEqual([exposed.instanceId]);
    // Remount self-play with the same settings to verify they are ignored at the boundary.
    act(() => root.update(null));
    act(() => root.update(<React.StrictMode><DebugHarness mode="self" /></React.StrictMode>));
    expect(game.state.startingHandCards).toBeNull();
    expect(game.gameState!.openingCoin).toBeDefined();

    const started = vi.fn();
    act(() => root.update(<PlaytestSetup onBack={() => {}} onStart={started} />));
    act(() => root.root.findByProps({ 'aria-label': 'Debug settings' }).props.onClick());
    const toggles = () => root.root.findAllByProps({ type: 'checkbox' });
    expect(root.root.findAllByProps({ type: 'radio' })).toHaveLength(0);
    expect(toggles().every(toggle => toggle.props['data-sound'] === 'toggle')).toBe(true);
    act(() => toggles().forEach(toggle => toggle.props.onChange({ target: { checked: true } })));
    act(() => root.root.findByProps({ 'aria-label': 'Begin playtest' }).props.onClick());
    expect(started).toHaveBeenLastCalledWith([null, null], 'ai', debug);

    const hidden = { ...placed(card('P_Solstice_Sentinel', 1)), position: Position.HIDDEN };
    debugGame.players[1].pawnZones[0] = hidden;
    const inspect = vi.fn();
    act(() => root.update(<><Zone card={hidden} type="pawn" xray /><DeckPile count={35} label="Deck" xrayCard={choices[0]} onInspect={inspect} /><GameSidebar gameState={debugGame} viewerIndex={0} xray selectedCard={null} selectedFieldSlot={{ playerIndex: 1, type: 'pawn', index: 0 }} isOpen setIsOpen={() => {}} /></>));
    expect(root.root.findAllByType(XrayOverlay)).toHaveLength(2);
    const fieldOverlay = root.root.findByType(Zone).findByType(XrayOverlay);
    expect(fieldOverlay.parent.props.className).toContain('rotate-90');
    expect(fieldOverlay.parent.props['data-field-card-id']).toBe(hidden.card.instanceId);
    expect(root.root.findByType(Zone).findAllByType('i').some(icon => icon.props.className.includes('fa-lock'))).toBe(false);
    expect(root.root.findByType(GameSidebar).findByType(CardDetail).props.isSet).toBe(false);
    const viewer = root.root.findByType(GameSidebar);
    act(() => viewer.findByProps({ 'aria-label': `Preview ${hidden.card.name}` }).props.onClick());
    const previewDialog = viewer.findByType('dialog');
    expect(previewDialog.props['aria-label']).toBe(hidden.card.name);
    expect(previewDialog.findByProps({ 'aria-label': `${hidden.card.name} effect text` }).findByType('p').props.children).toBe(hidden.card.effectText);
    act(() => previewDialog.findAllByType('button').find(button => button.props.children === 'Close Preview')!.props.onClick());
    expect(viewer.findAllByType('dialog')).toHaveLength(0);
    act(() => root.root.findByProps({ 'aria-label': 'Deck: 35 cards. Inspect top card' }).props.onClick());
    expect(inspect).toHaveBeenCalledOnce();
    expect(hidden.position).toBe(Position.HIDDEN);
    const openReserve = vi.fn();
    act(() => root.update(<><DeckPile count={3} label="Your Reserve" backStyle="light" onOpen={openReserve} /><DeckPile count={35} label="Deck" /></>));
    const reserve = root.root.findByProps({ 'aria-label': 'Your Reserve: 3 cards. Open pile' });
    expect(reserve.props.className).toContain('card-back--light');
    expect(root.root.findByProps({ 'aria-label': 'Deck: 35 cards' }).props.className).not.toContain('card-back--light');
    expect(reserve.findByType('span').children).toEqual(['3']);
    act(() => reserve.props.onClick());
    const preventDefault = vi.fn();
    act(() => reserve.props.onKeyDown({ key: 'Enter', preventDefault }));
    expect(openReserve).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledOnce();
    act(() => root.update(<><Zone card={hidden} type="pawn" /><DeckPile count={0} label="Deck" /><GameSidebar gameState={debugGame} viewerIndex={0} selectedCard={null} selectedFieldSlot={{ playerIndex: 1, type: 'pawn', index: 0 }} isOpen setIsOpen={() => {}} /></>));
    expect(root.root.findAllByType(XrayOverlay)).toHaveLength(0);
    expect(root.root.findByType(GameSidebar).findByType(CardDetail).props.isSet).toBe(true);
    expect(root.root.findByType(GameSidebar).findByProps({ 'aria-label': 'Hidden card' }).props.disabled).toBe(true);
    const sidebar = (selectedCard: Card | null, field = false) => <GameSidebar gameState={debugGame} viewerIndex={0}
        selectedCard={selectedCard} inspectedCard={choices[1]} selectedFieldSlot={field ? { playerIndex: 1, type: 'pawn', index: 0 } : null} isOpen setIsOpen={() => {}} />;
    for (const [selected, field, expected] of [[choices[0], true, hidden.card], [choices[0], false, choices[0]], [null, false, choices[1]]] as const) {
        act(() => root.update(sidebar(selected, field)));
        expect(root.root.findByType(CardDetail).props.card).toBe(expected);
        expect(root.root.findByType(CardDetail).props.isSet).toBe(field);
    }

});

it('ranks the winning duel MVP and reveals it after one second', () => {
    const a = card('A_Void_Blast'); const b = card('A_Quick_Recovery');
    const state = { winner: 'Winner', turnNumber: 4, players: [{ name: 'Winner' }, { name: 'Loser' }], damageEvents: [
        { card: a, playerIndex: 0, amount: 200, kind: 'battle' },
        { card: b, playerIndex: 0, amount: 250, kind: 'battle' },
        { card: a, playerIndex: 0, amount: 100, kind: 'effect' },
        { card: b, playerIndex: 1, amount: 900, kind: 'effect' },
    ] } as GameState;
    expect(getDuelMvp(state)).toMatchObject({ card: a, battle: 200, effect: 100, total: 300 });
    vi.stubGlobal('document', { activeElement: null });
    act(() => root.update(<WinnerModal gameState={state} onQuit={() => {}} />));
    const front = () => root.root.findByProps({ className: 'duel-mvp-face duel-mvp-front' });
    expect(front().props['aria-hidden']).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(front().props['aria-hidden']).toBe(false);
});
