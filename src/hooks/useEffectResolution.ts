import { useCallback, Dispatch, SetStateAction, useRef } from 'react';
import {
    GameState, Card, CardContext, CardSelectionRequest, CardTarget, CardType,
    EffectTrigger, HandSelectionRequest, ShuffleSelectionRequest, TargetSelectMode, TargetSelectPosition,
    TargetSelectType, TargetSelectScope, TributeSelectionRequest, PeekSelectionRequest
} from '../types';
import { applyCommand, previewEffect } from '../game/engine';
import { playSound } from '../audio';

/**
 * Hook for resolving card effects, including target/discard/hand selection flows.
 */
export const useEffectResolution = (
    gameState: GameState | null,
    setGameState: Dispatch<SetStateAction<GameState | null>>,
    triggerVisual: (src: string, tgt: string, type: 'discard' | 'void' | 'retrieve', card?: Card) => void,
    selectionState: {
        setTriggeredEffect: (card: Card | null) => void,
        setPendingEffectCard: (card: Card | null) => void,
        setTargetSelectMode: (mode: TargetSelectMode) => void,
        setTargetSelectType: (type: TargetSelectType) => void,
        setTargetSelectPosition: (pos: TargetSelectPosition) => void,
        setTargetSelectScope: (scope: TargetSelectScope) => void,
        setTargetSelectFilter: Dispatch<SetStateAction<((card: Card) => boolean) | null>>,
        setIsPeekingField: (peek: boolean) => void,
        setDiscardSelectionReq: (req: CardSelectionRequest | null) => void,
        setSelectedDiscardIndex: (idx: number | null) => void,
        setHandSelectionReq: (req: HandSelectionRequest | null) => void,
        setSelectedHandSelectionIndex: (idx: number | null) => void,
        pendingEffectCard: Card | null,
        discardSelectionReq: CardSelectionRequest | null,
        handSelectionReq: HandSelectionRequest | null,
        setPeekSelectionReq: (req: PeekSelectionRequest | null) => void,
        setSelectedPeekIndex: (idx: number | null) => void,
        peekSelectionReq: PeekSelectionRequest | null,
        autoSelectPeekForPlayer?: number,
        preparePeekSelection?: (card: Card, continueSelection: () => void) => void,
        clearPreparedPeek?: (card: Card) => void,
        setPendingTriggerType: (t: EffectTrigger | null) => void,
        pendingTriggerType: EffectTrigger | null,
        setDeckSelectionReq: (req: CardSelectionRequest | null) => void,
        setSelectedDeckIndex: (idx: number | null) => void,
        deckSelectionReq: CardSelectionRequest | null,
        setEffectTributeReq: (req: TributeSelectionRequest | null) => void,
        setShuffleSelectionReq: (req: ShuffleSelectionRequest | null) => void,
        shuffleSelectionReq: ShuffleSelectionRequest | null,
        showEffect?: (card: Card, target?: CardTarget) => void,
    }
) => {
    const {
        setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition,
        setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
        setHandSelectionReq, setSelectedHandSelectionIndex,
        setPendingTriggerType,
        setDeckSelectionReq, setSelectedDeckIndex,
        setEffectTributeReq, setShuffleSelectionReq, setPeekSelectionReq, setSelectedPeekIndex
    } = selectionState;

    // Use a ref to persist context properties (like target or handIndex) between chained prompts.
    const pendingContext = useRef<Partial<CardContext> & { triggerType?: EffectTrigger, tributeCards?: Card[], targetIndex?: number, peekAnimationPlayed?: boolean }>({});

    /** Executes a card's unique ability. Handles targeting logic with peek-first pattern. */
    const resolveEffect = useCallback((
        card: Card,
        target?: CardTarget,
        discardIndex?: number,
        handIndex?: number,
        deckIndex?: number,
        triggerType: EffectTrigger = 'activate',
        tributeIndices?: number[],
        providedTargets?: CardTarget[],
        peekIndex?: number,
        shuffleIndices?: number[]
    ) => {
        if (!gameState || gameState.winner) return;
        const controllerIndex = gameState.players.findIndex((p, index) => p.pawnZones.some(z => z?.card.instanceId === card.instanceId)
            || p.actionZones.some(z => z?.card.instanceId === card.instanceId)
            || gameState.pendingSwitches?.some(entry => entry.card.instanceId === card.instanceId && entry.playerIndex === index));
        const switchIndex = gameState.pendingSwitches?.find(entry => entry.card.instanceId === card.instanceId)?.playerIndex;
        const activeIndex = switchIndex ?? (controllerIndex >= 0 ? controllerIndex : gameState.players.findIndex(p => p.id === card.ownerId));
        if (activeIndex < 0) return;

        const actualTargets = [...(providedTargets ?? pendingContext.current.targets ?? (pendingContext.current.target ? [pendingContext.current.target] : []))];
        if (target) actualTargets[pendingContext.current.targetIndex ?? 0] = target;
        const actualTarget = actualTargets[0];
        const actualDiscardIndex = discardIndex ?? pendingContext.current.discardIndex;
        const actualHandIndex = handIndex ?? pendingContext.current.handIndex;
        const actualDeckIndex = deckIndex ?? pendingContext.current.deckIndex;
        const actualPeekIndex = peekIndex ?? pendingContext.current.peekIndex;
        const actualTriggerType = pendingContext.current.triggerType ?? triggerType;
        const actualTributeIndices = tributeIndices ?? pendingContext.current.tributeIndices;
        const actualShuffleIndices = shuffleIndices ?? pendingContext.current.shuffleIndices;
        const tributeCards = tributeIndices
            ? tributeIndices.flatMap(index => gameState.players[activeIndex].pawnZones[index]?.card ?? [])
            : pendingContext.current.tributeCards ?? [];

        pendingContext.current = {
            target: actualTarget,
            targets: actualTargets,
            discardIndex: actualDiscardIndex,
            handIndex: actualHandIndex,
            deckIndex: actualDeckIndex,
            peekIndex: actualPeekIndex,
            triggerType: actualTriggerType,
            tributeIndices: actualTributeIndices,
            shuffleIndices: actualShuffleIndices,
            tributeCards
        };

        // Peek at the effect result to check if we need a selection mode
        const contextForPeek: CardContext = { card, playerIndex: activeIndex, target: actualTarget, targets: actualTargets, discardIndex: actualDiscardIndex, handIndex: actualHandIndex, deckIndex: actualDeckIndex, peekIndex: actualPeekIndex, tributeIndices: actualTributeIndices, shuffleIndices: actualShuffleIndices };
        const peekResult = previewEffect(gameState, contextForPeek, actualTriggerType);

        // Enter selection mode if needed — return early without touching game state
        const requiredTargetIndex = peekResult?.requireTargetIndex ?? 0;
        if (peekResult?.requireTarget && !actualTargets[requiredTargetIndex]) {
            pendingContext.current.targetIndex = requiredTargetIndex;
            setTriggeredEffect(null);
            setPendingEffectCard(card);
            setTargetSelectMode('effect');
            setTargetSelectType(peekResult.requireTarget);
            setTargetSelectPosition(peekResult.requireTargetPosition || 'both');
            selectionState.setTargetSelectFilter(() => peekResult.requireTargetFilter ?? null);
            selectionState.setTargetSelectScope(peekResult.requireTargetScope || 'both');
            setIsPeekingField(false);
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requireDiscardSelection && actualDiscardIndex === undefined) {
            setPendingEffectCard(card);
            setDiscardSelectionReq({ ...peekResult.requireDiscardSelection, title: `${card.name}: Select a card from the discard pile` });
            setSelectedDiscardIndex(null);
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requireHandSelection && actualHandIndex === undefined) {
            setPendingEffectCard(card);
            setHandSelectionReq({ ...peekResult.requireHandSelection, title: `${card.name}: Select a card to discard` });
            setSelectedHandSelectionIndex(null);
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requirePeekSelection && actualPeekIndex === undefined) {
            setPendingEffectCard(card);
            setPendingTriggerType(actualTriggerType);
            const continueSelection = () => {
                if (selectionState.autoSelectPeekForPlayer === peekResult.requirePeekSelection!.playerIndex) {
                    const hand = gameState.players[peekResult.requirePeekSelection!.playerIndex].hand;
                    const chosenIndex = Math.floor(Math.random() * hand.length);
                    resolveEffect(card, target, actualDiscardIndex, actualHandIndex, actualDeckIndex,
                        actualTriggerType, actualTributeIndices, actualTargets, chosenIndex);
                    return;
                }
                setPeekSelectionReq({ ...peekResult.requirePeekSelection!, title: `${card.name}: Select a card in your hand to show` });
                setSelectedPeekIndex(null);
            };
            if (selectionState.preparePeekSelection && !pendingContext.current.peekAnimationPlayed) {
                pendingContext.current.peekAnimationPlayed = true;
                selectionState.preparePeekSelection(card, continueSelection);
            } else {
                continueSelection();
            }
            return;
        }
        if (peekResult?.requireDeckSelection && actualDeckIndex === undefined) {
            setPendingEffectCard(card);
            setDeckSelectionReq({ ...peekResult.requireDeckSelection, title: `${card.name}: Select a card from the deck` });
            setSelectedDeckIndex(null);
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requireEffectTribute && actualTributeIndices === undefined) {
            setPendingEffectCard(card);
            setEffectTributeReq({
                ...peekResult.requireEffectTribute,
                title: peekResult.requireEffectTribute.title ?? `${card.name}: Select ${peekResult.requireEffectTribute.count} Pawn(s) to tribute`
            });
            setTargetSelectMode('tribute');
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requireShuffleSelection && actualShuffleIndices === undefined) {
            setPendingEffectCard(card);
            setShuffleSelectionReq(peekResult.requireShuffleSelection);
            setPendingTriggerType(actualTriggerType);
            return;
        }

        if (peekResult?.halted) {
            setTriggeredEffect(null);
            setPendingEffectCard(null);
            setTargetSelectMode(null);
            selectionState.setTargetSelectScope('both');
            setPendingTriggerType(null);
            pendingContext.current = {};
            return;
        }

        playSound(card.type === CardType.PAWN && card.level > 4 ? 'high-effect' : 'minor-card-effect');
        selectionState.showEffect?.(card, actualTarget);

        // Apply the effect to game state
        setGameState(prev => {
            if (!prev || prev.winner) return prev;
            const executionContext: CardContext = { card, playerIndex: activeIndex, target: actualTarget, targets: actualTargets, discardIndex: actualDiscardIndex, handIndex: actualHandIndex, deckIndex: actualDeckIndex, peekIndex: actualPeekIndex, tributeIndices: actualTributeIndices, shuffleIndices: actualShuffleIndices };
            return applyCommand(prev, activeIndex, { type: 'activate', context: executionContext, trigger: actualTriggerType }).state;
        });

        // Cleanup selection modes
        setTriggeredEffect(null);
        setPendingEffectCard(null);
        setTargetSelectMode(null);
        setTargetSelectType('pawn');
        setTargetSelectPosition('both');
        selectionState.setTargetSelectScope('both');
        selectionState.setTargetSelectFilter(null);
        setIsPeekingField(false);
        setPendingTriggerType(null);
        pendingContext.current = {};
        selectionState.clearPreparedPeek?.(card);
        if (actualDiscardIndex !== undefined) { setDiscardSelectionReq(null); setSelectedDiscardIndex(null); }
        if (actualHandIndex !== undefined) { setHandSelectionReq(null); setSelectedHandSelectionIndex(null); }
        if (actualPeekIndex !== undefined) { setPeekSelectionReq(null); setSelectedPeekIndex(null); }
        if (actualDeckIndex !== undefined) { setDeckSelectionReq(null); setSelectedDeckIndex(null); }
        if (actualTributeIndices !== undefined) { setEffectTributeReq(null); }
        if (actualShuffleIndices !== undefined) setShuffleSelectionReq(null);
    }, [gameState, setGameState, setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition, setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex, setHandSelectionReq, setSelectedHandSelectionIndex, setPeekSelectionReq, setSelectedPeekIndex, setDeckSelectionReq, setSelectedDeckIndex, setEffectTributeReq, setShuffleSelectionReq]);

    const handleShuffleSelection = (indices: number[]) => {
        const req = selectionState.shuffleSelectionReq;
        const pending = selectionState.pendingEffectCard;
        if (!gameState || !req || !pending || indices.length !== req.count || new Set(indices).size !== req.count) return;
        setShuffleSelectionReq(null);
        resolveEffect(pending, undefined, undefined, undefined, undefined,
            selectionState.pendingTriggerType || 'activate', undefined, undefined, undefined, indices);
    };

    /** Handles selection from the Discard Pile Modal. */
    const handleDiscardSelection = useCallback((index: number) => {
        if (!selectionState.discardSelectionReq || !gameState || !selectionState.pendingEffectCard) return;
        const pIdx = selectionState.discardSelectionReq.playerIndex;
        const card = gameState.players[pIdx].discard[index];
        if (!card || !selectionState.discardSelectionReq.filter(card)) return;

        setDiscardSelectionReq(null);
        setSelectedDiscardIndex(null);
        triggerVisual(`discard-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

        const pendingCard = selectionState.pendingEffectCard;
        const pendingTrigger = selectionState.pendingTriggerType || 'activate';
        resolveEffect(pendingCard, undefined, index, undefined, undefined, pendingTrigger);
    }, [gameState, selectionState.discardSelectionReq, selectionState.pendingEffectCard, selectionState.pendingTriggerType, resolveEffect, triggerVisual, setDiscardSelectionReq, setSelectedDiscardIndex, setPendingEffectCard]);

    /** Handles selection from the Hand Selection Modal (e.g. for Discard costs). */
    const handleHandSelection = useCallback((index: number) => {
        if (!selectionState.discardSelectionReq && !selectionState.pendingEffectCard) return;
        if (!gameState || !selectionState.pendingEffectCard) return;

        const pIdx = gameState.players.findIndex(p => p.id === selectionState.pendingEffectCard!.ownerId);
        const card = gameState.players[pIdx].hand[index];
        if (!card || (selectionState.handSelectionReq?.filter && !selectionState.handSelectionReq.filter(card))) return;

        setHandSelectionReq(null);
        setSelectedHandSelectionIndex(null);
        triggerVisual(`${pIdx}-hand-${index}`, `discard-${pIdx}`, 'discard', card);

        const pendingCard = selectionState.pendingEffectCard;
        const pendingTrigger = selectionState.pendingTriggerType || 'activate';
        resolveEffect(pendingCard, undefined, undefined, index, undefined, pendingTrigger);
    }, [gameState, selectionState.pendingEffectCard, selectionState.pendingTriggerType, resolveEffect, triggerVisual, setHandSelectionReq, setSelectedHandSelectionIndex, setPendingEffectCard]);

    /** Records the opponent's chosen card without moving it out of their hand. */
    const handlePeekSelection = useCallback((index: number) => {
        if (!selectionState.peekSelectionReq || !gameState || !selectionState.pendingEffectCard) return;
        const owner = selectionState.peekSelectionReq.playerIndex;
        if (!gameState.players[owner].hand[index]) return;
        setPeekSelectionReq(null);
        setSelectedPeekIndex(null);
        resolveEffect(selectionState.pendingEffectCard, undefined, undefined, undefined, undefined,
            selectionState.pendingTriggerType || 'activate', undefined, undefined, index);
    }, [gameState, selectionState.peekSelectionReq, selectionState.pendingEffectCard, selectionState.pendingTriggerType, resolveEffect, setPeekSelectionReq, setSelectedPeekIndex]);

    /** Handles selection from the Deck Selection Modal. */
    const handleDeckSelection = useCallback((index: number) => {
        if (!selectionState.deckSelectionReq || !gameState || !selectionState.pendingEffectCard) return;
        const pIdx = selectionState.deckSelectionReq.playerIndex;
        // The card is pulled out of deck during final resolution to ensure state is consistent,
        // but visually we can trigger it immediately:
        const card = gameState.players[pIdx].deck[index];
        if (!card || !selectionState.deckSelectionReq.filter(card)) return;

        setDeckSelectionReq(null);
        setSelectedDeckIndex(null);
        
        // Try not to trigger visual animation yet, actually let's do 'retrieve' 
        // to fly a card to hand, which visually simulates searching from deck.
        triggerVisual(`deck-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

        const pendingCard = selectionState.pendingEffectCard;
        const pendingTrigger = selectionState.pendingTriggerType || 'activate';
        resolveEffect(pendingCard, undefined, undefined, undefined, index, pendingTrigger);
    }, [gameState, selectionState.deckSelectionReq, selectionState.pendingEffectCard, selectionState.pendingTriggerType, resolveEffect, triggerVisual, setDeckSelectionReq, setSelectedDeckIndex, setPendingEffectCard]);

    const cancelEffect = () => {
        const card = selectionState.pendingEffectCard;
        if (card && !card.switchMandatory) setGameState(prev => prev && !prev.response ? applyCommand(prev,
            prev.pendingSwitches?.find(entry => entry.card.instanceId === card.instanceId)?.playerIndex ?? prev.players.findIndex(p => p.id === card.ownerId),
            { type: 'cancelEffect', cardId: card.instanceId }).state : prev);
        pendingContext.current = {};
        if (card) selectionState.clearPreparedPeek?.(card);
        setTriggeredEffect(null);
        setPendingEffectCard(null);
        setPendingTriggerType(null);
        setTargetSelectMode(null);
        selectionState.setTargetSelectScope('both');
        selectionState.setTargetSelectFilter(null);
        setIsPeekingField(false);
        setDiscardSelectionReq(null);
        setHandSelectionReq(null);
        setPeekSelectionReq(null);
        setDeckSelectionReq(null);
        setEffectTributeReq(null);
        setShuffleSelectionReq(null);
        setSelectedDiscardIndex(null);
        setSelectedHandSelectionIndex(null);
        setSelectedPeekIndex(null);
        setSelectedDeckIndex(null);
    };
    return { resolveEffect, handleDiscardSelection, handleHandSelection, handlePeekSelection, handleDeckSelection, handleShuffleSelection, cancelEffect };
};
