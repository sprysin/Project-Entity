import { useState, useEffect, useCallback, useRef } from 'react';
import {
    GameState, Card, CardType, Attribute, Position, Phase, CardSelectionRequest,
    EffectTrigger, HandSelectionRequest, OpponentMode, TargetSelectMode, TargetSelectPosition,
    TargetSelectScope, TargetSelectType, TributeSelectionRequest, PeekSelectionRequest, ShuffleSelectionRequest
} from '../types';
import { effectChoices, fieldActivations, resolveChainStep } from '../game/chains';
import { applyCommand, applySystemCommand, canPlayCard as engineCanPlayCard, createGame } from '../game/engine';
import { useOpponentAI } from './useOpponentAI';
import { createDeck } from '../constants';
import { useAnimations } from './useAnimations';
import { useCardMotion } from './useCardMotion';
import { useEffectResolution } from './useEffectResolution';
import { useCardActions } from './useCardActions';
import { useGameAnimationEffects } from './useGameAnimationEffects';
import '../cards/pawns';
import '../cards/actions';
import '../cards/conditions';
import { createRuntimeDeck, SavedDeck } from '../decks';
import { useManagedTimeout } from './useManagedTimeout';
import { getActivationPopups, getSettings, saveActivationPopups } from '../desktop/storage';
import { showMessage } from '../desktop/files';

export const ACTIVATION_POPUPS_STORAGE_KEY = 'project-entity.activation-popups-enabled';

const loadActivationPopupPreference = () => {
    try {
        return getActivationPopups();
    } catch {
        return true;
    }
};

export const useGameLogic = (initialDecks: [SavedDeck | null, SavedDeck | null] = [null, null], opponentMode: OpponentMode = 'self') => {
    // Core Game State
    const [gameState, setGameState] = useState<GameState | null>(null);

    // Selection States
    const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
    const [selectedFieldSlot, setSelectedFieldSlot] = useState<{ playerIndex: number, type: 'pawn' | 'action', index: number } | null>(null);
    const [targetSelectMode, setTargetSelectMode] = useState<TargetSelectMode>(null);
    const [targetSelectType, setTargetSelectType] = useState<TargetSelectType>('pawn');
    const [targetSelectPosition, setTargetSelectPosition] = useState<TargetSelectPosition>('both');
    const [targetSelectScope, setTargetSelectScope] = useState<TargetSelectScope>('both');

    // Card Play (Manual Placement)
    const [pendingPlayCard, setPendingPlayCard] = useState<Card | null>(null);
    const [playMode, setPlayMode] = useState<'normal' | 'hidden' | 'activate' | 'set' | null>(null);
    const [frontlineCardId, setFrontlineCardId] = useState<string | null>(null);
    const [frontlineSelectedHandIndex, setFrontlineSelectedHandIndex] = useState<number | null>(null);
    useEffect(() => {
        if (!frontlineCardId) return;
        const pending = gameState?.pendingFrontline?.[0];
        if (pending && gameState.players[pending.playerIndex].hand.some(card => card.instanceId === frontlineCardId)) return;
        setFrontlineCardId(null);
        setSelectedFieldSlot(null);
    }, [gameState, frontlineCardId]);

    // Tribute
    const [tributeSelection, setTributeSelection] = useState<number[]>([]);
    const [pendingTributeCard, setPendingTributeCard] = useState<Card | null>(null);
    const [tributeSummonMode, setTributeSummonMode] = useState<'normal' | 'hidden'>('normal');
    const [pendingTributeSlot, setPendingTributeSlot] = useState<number | null>(null);

    // Effect Resolution
    const [triggeredEffect, setTriggeredEffect] = useState<Card | null>(null);
    const [pendingEffectCard, setPendingEffectCard] = useState<Card | null>(null);
    const [pendingTriggerType, setPendingTriggerType] = useState<EffectTrigger | null>(null);
    const [targetSelectFilter, setTargetSelectFilter] = useState<((card: Card) => boolean) | null>(null);
    const [isPeekingField, setIsPeekingField] = useState(false);
    const [responseFieldMode, setResponseFieldMode] = useState<'peek' | 'activate' | null>(null);
    const [visuallyDestroyedCardIds, setVisuallyDestroyedCardIds] = useState<string[]>([]);

    // Discard/Hand Selection
    const [discardSelectionReq, setDiscardSelectionReq] = useState<CardSelectionRequest | null>(null);
    const [selectedDiscardIndex, setSelectedDiscardIndex] = useState<number | null>(null);
    const [handSelectionReq, setHandSelectionReq] = useState<HandSelectionRequest | null>(null);
    const [selectedHandSelectionIndex, setSelectedHandSelectionIndex] = useState<number | null>(null);
    const [peekSelectionReq, setPeekSelectionReq] = useState<PeekSelectionRequest | null>(null);
    const [selectedPeekIndex, setSelectedPeekIndex] = useState<number | null>(null);
    const [deckSelectionReq, setDeckSelectionReq] = useState<CardSelectionRequest | null>(null);
    const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null);
    const [effectTributeReq, setEffectTributeReq] = useState<TributeSelectionRequest | null>(null);
    const [shuffleSelectionReq, setShuffleSelectionReq] = useState<ShuffleSelectionRequest | null>(null);

    // Pile viewing
    const [viewingDiscardIdx, setViewingDiscardIdx] = useState<number | null>(null);
    const [viewingVoidIdx, setViewingVoidIdx] = useState<number | null>(null);
    const [inspectedPileCard, setInspectedPileCard] = useState<Card | null>(null);

    // Layout
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isDeckViewerOpen, setIsDeckViewerOpen] = useState(false);
    const [activationPopupsEnabled, setActivationPopupsEnabled] = useState(loadActivationPopupPreference);
    const previousPopupPreference = useRef(activationPopupsEnabled);

    useEffect(() => {
        if (activationPopupsEnabled !== previousPopupPreference.current) {
            previousPopupPreference.current = activationPopupsEnabled;
            void saveActivationPopups(activationPopupsEnabled).catch(() => showMessage('Could not save the activation popup setting. It will apply for this session only.'));
        }
    }, [activationPopupsEnabled]);

    // A selected hand card only describes an action in the current phase. Clear
    // it when the turn/phase moves so placement highlights cannot leak into
    // Battle, End, or the next player's turn.
    useEffect(() => {
        setSelectedHandIndex(null);
        setSelectedFieldSlot(null);
    }, [gameState?.activePlayerIndex, gameState?.currentPhase, gameState?.turnNumber]);

    useEffect(() => {
        if (selectedHandIndex !== null || selectedFieldSlot !== null) setInspectedPileCard(null);
    }, [selectedHandIndex, selectedFieldSlot]);

    // Compose sub-hooks
    const animations = useAnimations();
    const schedule = useManagedTimeout();
    const cardMotion = useCardMotion(gameState, animations.zoneRefs, opponentMode === 'ai' ? 0 : undefined, visuallyDestroyedCardIds,
        (key, source) => animations.triggerShatter(key, source, 'action-condition-destroyed'));

    const { resolveEffect, handleDiscardSelection, handleHandSelection, handlePeekSelection, handleDeckSelection, handleShuffleSelection, cancelEffect } = useEffectResolution(
        gameState, setGameState, cardMotion.recordMovement,
        {
            setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition, setTargetSelectScope,
            setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
            setHandSelectionReq, setSelectedHandSelectionIndex,
            setPeekSelectionReq, setSelectedPeekIndex, peekSelectionReq,
            autoSelectPeekForPlayer: opponentMode === 'ai' ? 1 : undefined,
            preparePeekSelection: (card, continueSelection) => {
                const playerIndex = gameState?.players.findIndex(player => player.id === card.ownerId) ?? -1;
                const zoneIndex = playerIndex >= 0 ? gameState?.players[playerIndex].pawnZones.findIndex(zone => zone?.card.instanceId === card.instanceId) ?? -1 : -1;
                if (playerIndex >= 0 && zoneIndex >= 0) {
                    animations.triggerShatter(`${playerIndex}-pawn-${zoneIndex}`);
                    setVisuallyDestroyedCardIds(current => current.includes(card.instanceId) ? current : [...current, card.instanceId]);
                }
                schedule(continueSelection, 1300);
            },
            clearPreparedPeek: card => schedule(() => setVisuallyDestroyedCardIds(current => current.filter(id => id !== card.instanceId)), 100),
            setDeckSelectionReq, setSelectedDeckIndex,
            pendingEffectCard, discardSelectionReq, deckSelectionReq, handSelectionReq,
            setPendingTriggerType, pendingTriggerType,
            setTargetSelectFilter,
            setEffectTributeReq, setShuffleSelectionReq, shuffleSelectionReq,
            showEffect: (card, target) => {
                cardMotion.recordActivation(card);
                const pulse = (key: string, kind: string) => {
                    const el = animations.zoneRefs.current.get(key);
                    if (!el) return;
                    const marker = document.createElement('div');
                    marker.className = `effect-marker ${kind}`;
                    el.appendChild(marker);
                    marker.addEventListener('animationend', () => marker.remove(), { once: true });
                };
                gameState?.players.forEach((p, pi) => {
                    (['pawn', 'action'] as const).forEach(type => p[type === 'pawn' ? 'pawnZones' : 'actionZones'].forEach((z, i) => {
                        if (z?.card.instanceId === card.instanceId) pulse(`${pi}-${type}-${i}`, 'effect-activation');
                    }));
                });
                if (target) pulse(`${target.playerIndex}-${target.type}-${target.index}`, 'effect-target');
            }
        }
    );

    // Always keep a ref to the latest resolveEffect to avoid stale closures
    // when calling it from inside useCardActions (which may capture an old version).
    const resolveEffectRef = useRef(resolveEffect);
    resolveEffectRef.current = resolveEffect;
    const stableResolveEffect = useCallback(
        (...args: Parameters<typeof resolveEffect>) => resolveEffectRef.current(...args),
        [] // stable forever — always calls the latest via ref
    );

    const cardActions = useCardActions(
        gameState, setGameState, stableResolveEffect,
        cardMotion.recordMovement,
        setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode,
        isPeekingField || pendingEffectCard !== null || triggeredEffect !== null || !!gameState?.response
    );

    const canPlayCard = useCallback((card: Card) => !!gameState && engineCanPlayCard(gameState, card), [gameState]);

    // === EFFECTS ===

    /** Initialization */
    useEffect(() => {
        const p1Deck = initialDecks[0] ? createRuntimeDeck(initialDecks[0], 'player1') : createDeck('player1');
        const p2Deck = initialDecks[1] ? createRuntimeDeck(initialDecks[1], 'player2') : createDeck('player2');
        animations.lastLp.current = [800, 800];
        setGameState(createGame([
            { id: 'player1', name: getSettings().username, deck: p1Deck, deckName: initialDecks[0]?.name ?? 'Random test deck' },
            { id: 'player2', name: opponentMode === 'ai' ? 'AI' : 'Player 2', deck: p2Deck, deckName: initialDecks[1]?.name ?? 'Random test deck' }
        ]));
    }, []);

    const nextPhase = useCallback(() => {
        if (pendingEffectCard || triggeredEffect || targetSelectMode) return;
        setGameState(prev => prev ? applyCommand(prev, prev.activePlayerIndex, { type: 'phase' }).state : prev);
    }, [pendingEffectCard, triggeredEffect, targetSelectMode]);
    const skipToEndPhase = useCallback(() => {
        if (pendingEffectCard || triggeredEffect || targetSelectMode) return;
        setGameState(prev => prev && prev.currentPhase !== Phase.END ? applyCommand(prev, prev.activePlayerIndex, { type: 'end' }).state : prev);
    }, [pendingEffectCard, triggeredEffect, targetSelectMode]);
    const phaseRequestRef = useRef(nextPhase);
    phaseRequestRef.current = nextPhase;
    const stablePhaseRequest = useCallback(() => phaseRequestRef.current(), []);
    const requestAttack = (attackerIndex: number, targetIndex: number | 'direct') => {
        if (!gameState || pendingEffectCard || triggeredEffect) return;
        setSelectedFieldSlot(null); setTargetSelectMode(null);
        setGameState(prev => prev ? applyCommand(prev, prev.activePlayerIndex, { type: 'attack', attackerIndex, targetIndex }).state : prev);
    };
    useEffect(() => {
        if (!gameState?.response?.ready || gameState.winner) return;
        const action = gameState.deferredAction;
        const complete = () => {
            const result = applySystemCommand(gameState, { type: 'completeDeferred' });
            if (action?.kind === 'attack' && action.targetId !== 'direct') {
                const defeated = gameState.players[1 - gameState.activePlayerIndex].pawnZones
                    .find(zone => zone?.card.instanceId === action.targetId)?.card;
                const summoned = defeated && result.state.players[gameState.activePlayerIndex].pawnZones
                    .some(zone => zone?.card.instanceId === defeated.instanceId);
                if (summoned) {
                    const ownerIndex = gameState.players.findIndex(player => player.id === defeated.ownerId);
                    const discardKey = `discard-${ownerIndex < 0 ? 1 - gameState.activePlayerIndex : ownerIndex}`;
                    cardMotion.recordMovement(discardKey, discardKey, 'discard', defeated);
                }
            }
            for (const event of result.events) {
                animations.triggerShatter(`${event.playerIndex}-pawn-${event.index}`);
                cardMotion.recordMovement(`${event.playerIndex}-pawn-${event.index}`, `discard-${event.playerIndex}`, 'discard', event.card);
            }
            setGameState(prev => prev === gameState ? result.state : prev);
        };
        if (action?.kind !== 'attack') { complete(); return; }
        const timeout = setTimeout(complete, 1500);
        return () => clearTimeout(timeout);
    }, [gameState]);
    const responseOptions = gameState?.response && !gameState.response.ready ? fieldActivations(gameState, gameState.response.priority, true) : [];
    const visibleResponseRef = useRef<GameState['response']>();
    if (!gameState?.response || gameState.response.ready) visibleResponseRef.current = undefined;
    else if (activationPopupsEnabled && responseOptions.length > 0 && !pendingEffectCard && !triggeredEffect
        && responseFieldMode !== 'activate' && !(opponentMode === 'ai' && gameState.response.priority === 1)) {
        visibleResponseRef.current = gameState.response;
    }
    const showResponsePopup = activationPopupsEnabled || visibleResponseRef.current === gameState?.response;
    useEffect(() => {
        if (!gameState?.resolvingChain) return;
        const timeout = setTimeout(() => setGameState(previous => previous?.resolvingChain ? resolveChainStep(previous) : previous),
            gameState.resolvingChain.current === 1 ? 500 : 1000);
        return () => clearTimeout(timeout);
    }, [gameState?.resolvingChain, setGameState]);
    useEffect(() => {
        const pending = gameState?.pendingSwitches?.[0];
        if (!pending || triggeredEffect || pendingEffectCard || gameState?.response || gameState?.winner) return;
        const choices = effectChoices(gameState, pending.card, 'switch', 1);
        if (!choices.length) {
            setGameState(prev => prev?.pendingSwitches?.[0]?.card.instanceId === pending.card.instanceId
                ? { ...prev, pendingSwitches: prev.pendingSwitches.slice(1) } : prev);
            return;
        }
        if (opponentMode === 'ai' && pending.playerIndex === 1) {
            setGameState(prev => prev ? applyCommand(prev, 1, { type: 'activate', context: choices[0], trigger: 'switch' }).state : prev);
            return;
        }
        if (pending.card.switchMandatory) {
            resolveEffect(pending.card, undefined, undefined, undefined, undefined, 'switch');
            return;
        }
        setPendingTriggerType('switch');
        setTriggeredEffect(pending.card);
    }, [gameState, opponentMode, triggeredEffect, pendingEffectCard, resolveEffect]);
    const respond = (instanceId: string) => {
        const activation = responseOptions.find(option => option.card.instanceId === instanceId);
        if (!activation || pendingEffectCard) return;
        setResponseFieldMode(null);
        resolveEffect(activation.card, undefined, undefined, undefined, undefined, activation.trigger);
    };
    const passResponse = () => {
        setResponseFieldMode(null);
        setGameState(prev => prev ? applyCommand(prev, prev.response?.priority ?? prev.activePlayerIndex, { type: 'pass' }).state : prev);
    };
    useEffect(() => {
        if (showResponsePopup || !gameState?.response || gameState.response.ready || responseOptions.length === 0) return;
        if (pendingEffectCard || triggeredEffect || responseFieldMode) return;
        if (opponentMode === 'ai' && gameState.response.priority === 1) return;
        setGameState(prev => prev ? applyCommand(prev, prev.response?.priority ?? prev.activePlayerIndex, { type: 'pass' }).state : prev);
    }, [showResponsePopup, gameState?.response, opponentMode, pendingEffectCard, responseFieldMode, responseOptions.length, triggeredEffect]);
    useEffect(() => {
        if (!gameState?.response || gameState.response.ready || responseOptions.length === 0) setResponseFieldMode(null);
    }, [gameState?.response, responseOptions.length]);
    useOpponentAI({ gameState, setGameState, enabled: opponentMode === 'ai', busy: !!pendingEffectCard || !!triggeredEffect || !!gameState?.pendingFrontline?.length || !!gameState?.peekEvents?.some(event => event.viewerPlayerIndex === 0),
        nextPhase, skipToEndPhase, requestAttack, resolveEffect });

    useEffect(() => {
        const pending = gameState?.pendingFrontline?.[0];
        if (opponentMode !== 'ai' || pending?.playerIndex !== 1 || triggeredEffect || pendingEffectCard
            || gameState?.response || gameState?.resolvingChain) return;
        const own = gameState.players[1];
        const card = own.hand.find(candidate => candidate.type === CardType.PAWN && candidate.attribute === Attribute.LIGHT && candidate.level <= 4);
        setGameState(prev => prev ? applyCommand(prev, 1, card
            ? { type: 'frontlineSummon', sourceId: pending.sourceId, cardId: card.instanceId, slot: own.pawnZones.indexOf(null), position: Position.ATTACK }
            : { type: 'frontlineDecline', sourceId: pending.sourceId }).state : prev);
    }, [gameState, opponentMode, triggeredEffect, pendingEffectCard]);

    // AI-only reveals are private information for the AI, so they never open a
    // face-up modal on the human player's screen.
    useEffect(() => {
        if (opponentMode !== 'ai' || !gameState?.peekEvents?.some(event => event.viewerPlayerIndex === 1)) return;
        setGameState(prev => prev ? { ...prev, peekEvents: (prev.peekEvents ?? []).filter(event => event.viewerPlayerIndex !== 1) } : prev);
    }, [gameState?.peekEvents, opponentMode]);

    useGameAnimationEffects(gameState, setGameState, animations, stablePhaseRequest);


    // === RETURN ===
    return {
        gameState, setGameState,
        state: {
            opponentMode, responseOptions,
            selectedHandIndex, selectedFieldSlot, targetSelectMode, targetSelectType, targetSelectPosition, targetSelectScope,
            targetSelectFilter,
            tributeSelection, pendingTributeCard, tributeSummonMode, pendingTributeSlot,
            pendingPlayCard, playMode, frontlineCardId, frontlineSelectedHandIndex,
            triggeredEffect, pendingEffectCard, pendingTriggerType, isPeekingField, responseFieldMode,
            visuallyDestroyedCardIds,
            discardSelectionReq, selectedDiscardIndex, handSelectionReq, selectedHandSelectionIndex,
            peekSelectionReq, selectedPeekIndex,
            deckSelectionReq, selectedDeckIndex,
            phaseFlash: animations.phaseFlash, turnFlash: animations.turnFlash,
            displayedLp: animations.displayedLp, lpScale: animations.lpScale, lpFlash: animations.lpFlash,
            viewingDiscardIdx, viewingVoidIdx, inspectedPileCard,
            cardMotions: cardMotion.motions, finishMotion: cardMotion.finishMotion,
            floatingTexts: animations.floatingTexts, shatterEffects: animations.shatterEffects,
            discardFlash: animations.discardFlash, voidFlash: animations.voidFlash,
            isRightPanelOpen, isDeckViewerOpen, activationPopupsEnabled, showResponsePopup, effectTributeReq, shuffleSelectionReq,
        },
        actions: {
            setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition, setTargetSelectScope,
            setFrontlineSelectedHandIndex,
            setTributeSelection, setIsPeekingField, setResponseFieldMode,
            setDiscardSelectionReq, setSelectedDiscardIndex, setHandSelectionReq, setSelectedHandSelectionIndex,
            setPeekSelectionReq, setSelectedPeekIndex,
            setDeckSelectionReq, setSelectedDeckIndex,
            setTriggeredEffect, setPendingEffectCard,
            setViewingDiscardIdx, setViewingVoidIdx, setIsRightPanelOpen, setIsDeckViewerOpen, setActivationPopupsEnabled,
            inspectPileCard: (card: Card) => {
                setSelectedHandIndex(null);
                setSelectedFieldSlot(null);
                setInspectedPileCard(card);
                setViewingDiscardIdx(null);
                setViewingVoidIdx(null);
                setIsRightPanelOpen(true);
            },
            setRef: animations.setRef,
            nextPhase, skipToEndPhase, canPlayCard, resolveEffect, cancelEffect, respond, passResponse,
            handleDiscardSelection, handleHandSelection, handlePeekSelection, handleDeckSelection, handleShuffleSelection,
            dismissPeek: (id: string) => setGameState(prev => prev ? { ...prev, peekEvents: (prev.peekEvents ?? []).filter(event => event.id !== id) } : prev),
            handleSummon: (card: Card, mode: 'normal' | 'hidden' | 'tribute', autoSlotIndex?: number) =>
                cardActions.handleSummon(card, mode, { setPendingTributeCard, setTributeSummonMode, setTributeSelection, setPendingTributeSlot, setPendingPlayCard, setPlayMode, setTriggeredEffect, setPendingTriggerType }, autoSlotIndex),
            handleTributeSummon: () =>
                cardActions.handleTributeSummon(pendingTributeCard, tributeSelection, tributeSummonMode, pendingTributeSlot, { setPendingTributeCard, setTributeSelection, setPendingTributeSlot, setPendingPlayCard, setPlayMode, setTriggeredEffect, setPendingTriggerType }),
            handleEffectTribute: () => {
                if (!gameState || !pendingEffectCard || !effectTributeReq) return;
                if (tributeSelection.length !== effectTributeReq.count) return;
                const activeIndex = effectTributeReq.playerIndex;
                const copiedSelection = [...tributeSelection];
                
                if (new Set(copiedSelection).size !== effectTributeReq.count || copiedSelection.some(idx => {
                    const zone = gameState.players[activeIndex].pawnZones[idx];
                    return !zone || (effectTributeReq.filter && !effectTributeReq.filter(zone.card));
                })) return;
                setTargetSelectMode(null);
                setEffectTributeReq(null);
                setTributeSelection([]);
                stableResolveEffect(pendingEffectCard, undefined, undefined, undefined, undefined, pendingTriggerType || 'activate', copiedSelection);
            },
            handleActionFromHand: (card: Card, mode: 'activate' | 'set', autoSlotIndex?: number) =>
                cardActions.handleActionFromHand(card, mode, { setPendingPlayCard, setPlayMode, setTriggeredEffect, setPendingTriggerType }, autoSlotIndex),
            handlePlacement: (slotIndex: number) =>
                cardActions.handlePlacement(slotIndex, pendingPlayCard, playMode, {
                    setPendingPlayCard, setPlayMode,
                    setTriggeredEffect, setPendingTriggerType
                }),
            activateOnField: cardActions.activateOnField,
            canPlacePawn: (slot: number) => cardActions.canPlacePawn(pendingPlayCard, playMode, slot),
            changePosition: (index: number) => setGameState(prev => prev ? applyCommand(prev, prev.activePlayerIndex, { type: 'position', index }).state : prev),
            declineSwitch: (cardId: string) => setGameState(prev => prev ? applyCommand(prev,
                prev.pendingSwitches?.find(entry => entry.card.instanceId === cardId)?.playerIndex ?? prev.activePlayerIndex,
                { type: 'cancelEffect', cardId }).state : prev),
            handleAttack: requestAttack,
            frontlineChooseCard: (index: number) => {
                const pending = gameState?.pendingFrontline?.[0];
                const chosen = pending && gameState.players[pending.playerIndex].hand[index];
                if (!chosen || chosen.type !== CardType.PAWN || chosen.attribute !== Attribute.LIGHT || chosen.level > 4) return;
                setFrontlineCardId(chosen.instanceId);
                setFrontlineSelectedHandIndex(null);
                setSelectedHandIndex(null);
                setSelectedFieldSlot(null);
            },
            frontlineSummon: (slot: number, position: Position) => {
                const pending = gameState?.pendingFrontline?.[0];
                if (!pending || !frontlineCardId) return;
                setGameState(prev => prev ? applyCommand(prev, pending.playerIndex,
                    { type: 'frontlineSummon', sourceId: pending.sourceId, cardId: frontlineCardId, slot, position }).state : prev);
                setFrontlineCardId(null);
                setSelectedFieldSlot(null);
            },
            frontlineDecline: (sourceId: string) => {
                setGameState(prev => prev ? applyCommand(prev, prev.pendingFrontline?.[0]?.playerIndex ?? prev.activePlayerIndex,
                    { type: 'frontlineDecline', sourceId }).state : prev);
                setFrontlineCardId(null);
                setFrontlineSelectedHandIndex(null);
                setSelectedFieldSlot(null);
            },
        }
    };
};
