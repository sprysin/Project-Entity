import './fixtures/attachedCondition';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameLogic } from '../src/hooks/useGameLogic';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Attribute, Card, GameState, Phase, Position, OpponentMode, PlaytestDebugSettings } from '../src/types';
import { Zone } from '../src/components/game/Zone';
import PlaytestSetup from '../src/components/decks/PlaytestSetup';
import { DeckPile } from '../src/components/game/Pile';
import { XrayOverlay } from '../src/components/game/XrayOverlay';
import { GameSidebar } from '../src/components/game/GameSidebar';
import { CardDetail } from '../src/components/cards/CardDetail';
import { detectSummonReverbs } from '../src/components/game/SummonReverb';
import { WinnerModal } from '../src/components/game/MatchModals';
import { getDuelMvp } from '../src/game/mvp';
import { GameOverlays } from '../src/components/game/GameOverlays';
import { DiscardSelectionModal } from '../src/components/game/SelectionModals';
vi.mock('../src/desktop/files', () => ({ showMessage: vi.fn() }));

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
    setup(s => { s.players[0].hand = [eligibleCaster]; s.players[0].discard = [card('action_01')]; });
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
    act(() => discardModal!.unmount());
    const waitingForSelection = game.gameState!;
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState).toBe(waitingForSelection);
    act(() => game.actions.handleDiscardSelection(0));
    expect(game.gameState!.pendingActivation).toBeUndefined();
    act(() => vi.advanceTimersByTime(500));
    expect(game.gameState!.players[0].hand).toHaveLength(1);

    // A decision opened during Draw cancels queued draws and resumes them on decline.
    setup(s => { s.currentPhase = Phase.DRAW; s.drawProgress = undefined; s.players[0].deck = Array.from({ length: 6 }, () => card('pawn_01')); });
    act(() => game.actions.setTriggeredEffect(eligibleCaster));
    const waitingDuringDraw = game.gameState!;
    act(() => vi.advanceTimersByTime(5000));
    expect(game.gameState).toBe(waitingDuringDraw);
    act(() => game.actions.setTriggeredEffect(null));
    act(() => vi.advanceTimersByTime(300));
    expect(game.gameState!.players[0].hand).toHaveLength(1);

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

    for (const position of [Position.ATTACK, Position.DEFENSE, Position.HIDDEN]) {
        setup(s => { s.pendingHandSummons = []; s.players[1].void = [light]; s.pendingVoidReturns = [{ cardId: light.instanceId, playerIndex: 1, position }]; });
        expect(game.state.pawnPlacementReq).toMatchObject({ playerIndex: 1, position });
        act(() => game.actions.handlePawnPlacement(2, Position.ATTACK));
        expect(game.gameState!.players[1].pawnZones[2]).toMatchObject({ card: light, position });
        expect(game.gameState!.pendingHandSummons).toEqual([]);
    }

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

    const beforeReverb = structuredClone(game.gameState!);
    beforeReverb.players.forEach(player => player.pawnZones.fill(null));
    const boss = { ...card('pawn_01', 1), level: 8 as const, attribute: Attribute.WATER };
    const ordinary = { ...card('pawn_01'), level: 7 as const };
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

    const responseCards = [card('condition_03'), card('condition_03'), card('condition_02')];
    setup(s => {
        s.activePlayerIndex = 1;
        s.currentPhase = Phase.STANDBY;
        s.players[0].lp = 800;
        s.players[0].pawnZones[0] = placed({ ...card('pawn_04'), attribute: Attribute.DARK });
        s.players[0].deck = [card('pawn_01')];
        responseCards.forEach((c, index) => { s.players[0].actionZones[index] = { ...placed(c), position: Position.HIDDEN }; });
        s.players[0].actionZones[3] = { ...placed(card('condition_03')), position: Position.HIDDEN, summonedTurn: 2 };
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
    const outlander = card('pawn_future_outlander'), dragon = card('pawn_everlasting_dragonlord', 1), other = card('pawn_08', 1);
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
            s.players[0].pawnZones[0] = placed(card('pawn_04'));
            s.players[0].actionZones[0] = { ...placed(card('condition_03')), position: Position.HIDDEN };
            s.players[0].deck = [card('pawn_01')];
            s.response = { priority: 0, passes: 0, timing, reason: timing };
        });
        expect(!!game.gameState!.response).toBe(mode === 'on' || mode === 'auto' && timing === 'activation');
        if (game.gameState!.response) act(() => game.actions.passResponse());
    }
    act(() => game.actions.setActivationPopupMode('off'));
    const summonTrigger = card('pawn_01');
    setup(s => { s.activePlayerIndex = 0; s.players[0].hand = [summonTrigger]; });
    act(() => game.actions.handleSummon(summonTrigger, 'normal', 0));
    expect(game.state.triggeredEffect?.instanceId).toBe(summonTrigger.instanceId);
    act(() => game.actions.cancelEffect());
});

it('holds attacks and battle-destruction choices before mandatory effects move the defeated card', async () => {
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

    for (const accept of [false, true]) {
        const necromancer = card('pawn_14');
        const knight = card('pawn_cockroach_knight', 1);
        const recruit = { ...card('pawn_01', 1), attribute: Attribute.EARTH, atk: 100 };
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
    // An AI quick effect cannot interrupt any card in the required draw batch.
    act(() => game.actions.setActivationPopupMode('on'));
    setup(s => {
        s.activePlayerIndex = 0; s.currentPhase = Phase.DRAW; s.drawProgress = undefined;
        s.players[0].hand = [card('action_01')];
        s.players[0].deck = Array.from({ length: 10 }, () => card('pawn_01'));
        s.players[1].pawnZones[0] = placed(card('pawn_everlasting_dragonlord', 1));
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
        const king = card('pawn_02', 1);
        const ally = card('pawn_01', 1);
        const enemy = card('pawn_01');
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
    // The live AI chooses a target after the human's later protection link resolves.
    const future = card('pawn_future_outlander', 1), protectedDragon = card('pawn_everlasting_dragonlord'), exposed = card('pawn_08');
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

it('ranks the winning duel MVP and reveals it after one second', () => {
    const a = card('action_01'); const b = card('action_02');
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
