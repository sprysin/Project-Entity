import { isLand } from '../game/field';
import { useCallback, useState, Dispatch, SetStateAction, useRef } from 'react';
import {
    GameState, Card, CardContext, CardSelectionRequest, CardTarget, CardType,
    EffectResult, EffectTrigger, HandSelectionRequest, ShuffleSelectionRequest, TargetSelectMode, TargetSelectPosition,
    TargetSelectType, TargetSelectScope, TributeSelectionRequest, PeekSelectionRequest, LevelTributeSelectionRequest
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
    const [effectChoiceReq, setEffectChoiceReq] = useState<EffectResult['requireEffectChoice'] | null>(null);
    const [pawnPlacementReq, setPawnPlacementReq] = useState<NonNullable<EffectResult['requirePawnPlacement']> | null>(null);
    const [reserveSelectionReq, setReserveSelectionReq] = useState<CardSelectionRequest | null>(null);
    const [levelTributeReq, setLevelTributeReq] = useState<LevelTributeSelectionRequest | null>(null);
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
        shuffleCardIds?: string[],
        pawnPlacement?: CardContext['pawnPlacement'],
        effectId?: string,
        reserveIndex?: number,
        materialIds?: string[],
        pawnPlacements?: CardContext['pawnPlacements'],
        discardCardIds?: string[]
    ) => {
        if (!gameState || gameState.winner) return;
        const resolvingLink = gameState.pendingChainTarget && gameState.chain?.at(-1)?.context.card.instanceId === card.instanceId
            ? gameState.chain.at(-1) : undefined;
        const controllerIndex = gameState.players.findIndex((p, index) => p.pawnZones.some(z => z?.card.instanceId === card.instanceId)
            || p.actionZones.some(z => z?.card.instanceId === card.instanceId)
            || gameState.pendingReactions?.some(entry => entry.card.instanceId === card.instanceId && entry.playerIndex === index));
        const reactionIndex = gameState.pendingReactions?.find(entry => entry.card.instanceId === card.instanceId)?.playerIndex;
        const activeIndex = resolvingLink?.context.playerIndex ?? reactionIndex ?? (isLand(card) ? gameState.activePlayerIndex : undefined) ?? (controllerIndex >= 0 ? controllerIndex : gameState.players.findIndex(p => p.id === card.ownerId));
        if (activeIndex < 0) return;

        const actualTargets = [...(providedTargets ?? pendingContext.current.targets ?? (pendingContext.current.target ? [pendingContext.current.target] : []))];
        if (target) actualTargets[pendingContext.current.targetIndex ?? 0] = target;
        const actualTarget = actualTargets[0];
        const actualDiscardIndex = discardIndex ?? pendingContext.current.discardIndex;
        const actualDiscardCardIds = discardCardIds ?? pendingContext.current.discardCardIds;
        const actualHandIndex = handIndex ?? pendingContext.current.handIndex;
        const actualDeckIndex = deckIndex ?? pendingContext.current.deckIndex;
        const actualPeekIndex = peekIndex ?? pendingContext.current.peekIndex;
        const actualTriggerType = pendingContext.current.triggerType ?? triggerType;
        const actualTributeIndices = tributeIndices ?? pendingContext.current.tributeIndices;
        const actualPawnPlacement = pawnPlacement ?? pendingContext.current.pawnPlacement;
        const actualPawnPlacements = pawnPlacements ?? pendingContext.current.pawnPlacements;
        const actualShuffleCardIds = shuffleCardIds ?? pendingContext.current.shuffleCardIds;
        const actualEffectId = effectId ?? pendingContext.current.effectId;
        const actualReserveIndex = reserveIndex ?? pendingContext.current.reserveIndex;
        const actualMaterialIds = materialIds ?? pendingContext.current.materialIds;
        const tributeCards = tributeIndices
            ? tributeIndices.flatMap(index => gameState.players[activeIndex].pawnZones[index]?.card ?? [])
            : pendingContext.current.tributeCards ?? [];

        pendingContext.current = {
            effectId: actualEffectId,
            reserveIndex: actualReserveIndex,
            materialIds: actualMaterialIds,
            target: actualTarget,
            targets: actualTargets,
            discardIndex: actualDiscardIndex,
            discardCardIds: actualDiscardCardIds,
            handIndex: actualHandIndex,
            deckIndex: actualDeckIndex,
            peekIndex: actualPeekIndex,
            triggerType: actualTriggerType,
            tributeIndices: actualTributeIndices,
            shuffleCardIds: actualShuffleCardIds,
            pawnPlacement: actualPawnPlacement,
            pawnPlacements: actualPawnPlacements,
            tributeCards
        };

        // Peek at the effect result to check if we need a selection mode
        const contextForPeek: CardContext = { card, effectId: actualEffectId, playerIndex: activeIndex, target: actualTarget, targets: actualTargets, discardIndex: actualDiscardIndex, handIndex: actualHandIndex, deckIndex: actualDeckIndex, peekIndex: actualPeekIndex, tributeIndices: actualTributeIndices, shuffleCardIds: actualShuffleCardIds, pawnPlacement: actualPawnPlacement,
            reserveIndex: actualReserveIndex, materialIds: actualMaterialIds, pawnPlacements: actualPawnPlacements,
            battleAttacker: gameState.pendingReactions?.find(entry => entry.card.instanceId === card.instanceId)?.battleAttacker,
            discardCardIds: actualDiscardCardIds,
            execution: resolvingLink ? 'resolve' : undefined };
        const peekResult = previewEffect(gameState, contextForPeek, actualTriggerType);

        if (peekResult.requireEffectChoice) {
            setTriggeredEffect(null);
            setPendingEffectCard(card);
            setPendingTriggerType(actualTriggerType);
            setEffectChoiceReq(peekResult.requireEffectChoice);
            return;
        }
        setEffectChoiceReq(null);

        if (peekResult.requireLevelTribute && !actualMaterialIds) {
            setTriggeredEffect(null);
            setPendingEffectCard(card);
            setPendingTriggerType(actualTriggerType);
            setLevelTributeReq(peekResult.requireLevelTribute);
            return;
        }
        if (peekResult.requireReserveSelection && actualReserveIndex === undefined) {
            setPendingEffectCard(card);
            setPendingTriggerType(actualTriggerType);
            setReserveSelectionReq({ ...peekResult.requireReserveSelection, title: card.name });
            return;
        }

        if (peekResult.requirePawnPlacement) {
            setTriggeredEffect(null);
            setPendingEffectCard(card);
            setPawnPlacementReq(peekResult.requirePawnPlacement);
            setTargetSelectMode('place_pawn');
            setPendingTriggerType(actualTriggerType);
            return;
        }

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
        if (peekResult?.requireDiscardSelection) {
            setPendingEffectCard(card);
            setDiscardSelectionReq({ ...peekResult.requireDiscardSelection, title: card.name, prompt: peekResult.requireDiscardSelection.prompt ?? 'Select a card from the discard pile' });
            setSelectedDiscardIndex(null);
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requireHandSelection && actualHandIndex === undefined) {
            setPendingEffectCard(card);
            setHandSelectionReq({ ...peekResult.requireHandSelection, title: card.name, prompt: peekResult.requireHandSelection.prompt ?? 'Select a card to discard' });
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
                setPeekSelectionReq({ ...peekResult.requirePeekSelection!, title: card.name, prompt: 'Select a card in your hand to show' });
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
            setDeckSelectionReq({ ...peekResult.requireDeckSelection, title: card.name, prompt: 'Select a card from the deck' });
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
        if (peekResult?.requireShuffleSelection && actualShuffleCardIds === undefined) {
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
            setPawnPlacementReq(null);
            setLevelTributeReq(null);
            setReserveSelectionReq(null);
            return;
        }

        playSound(card.type === CardType.PAWN && card.level > 4 ? 'high-effect' : 'minor-card-effect');
        selectionState.showEffect?.(card, actualTarget);

        // Apply the effect to game state
        setGameState(prev => {
            if (!prev || prev.winner) return prev;
            return applyCommand(prev, activeIndex, resolvingLink ? { type: 'chainTargets', targets: actualTargets }
                : { type: 'activate', context: contextForPeek, trigger: actualTriggerType }).state;
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
        setPawnPlacementReq(null);
        setLevelTributeReq(null);
        setReserveSelectionReq(null);
        selectionState.clearPreparedPeek?.(card);
        if (actualDiscardIndex !== undefined || actualDiscardCardIds) { setDiscardSelectionReq(null); setSelectedDiscardIndex(null); }
        if (actualHandIndex !== undefined) { setHandSelectionReq(null); setSelectedHandSelectionIndex(null); }
        if (actualPeekIndex !== undefined) { setPeekSelectionReq(null); setSelectedPeekIndex(null); }
        if (actualDeckIndex !== undefined) { setDeckSelectionReq(null); setSelectedDeckIndex(null); }
        if (actualTributeIndices !== undefined) { setEffectTributeReq(null); }
        if (actualShuffleCardIds !== undefined) setShuffleSelectionReq(null);
    }, [gameState, setGameState, setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition, setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex, setHandSelectionReq, setSelectedHandSelectionIndex, setPeekSelectionReq, setSelectedPeekIndex, setDeckSelectionReq, setSelectedDeckIndex, setEffectTributeReq, setShuffleSelectionReq]);

    const handlePawnPlacement = (slot: number, position: NonNullable<CardContext['pawnPlacement']>['position']) => {
        const card = selectionState.pendingEffectCard;
        if (!card || !pawnPlacementReq || !gameState
            || (pawnPlacementReq.slots ? !pawnPlacementReq.slots.includes(slot) : !!gameState.players[pawnPlacementReq.playerIndex].pawnZones[slot])) return;
        const placements = [...(pendingContext.current.pawnPlacements ?? [])];
        if (pawnPlacementReq.placementIndex !== undefined) placements[pawnPlacementReq.placementIndex] = { slot, position };
        resolveEffect(card, undefined, undefined, undefined, undefined, selectionState.pendingTriggerType ?? 'activate',
            undefined, undefined, undefined, undefined, pawnPlacementReq.placementIndex === undefined ? { slot, position } : undefined,
            undefined, undefined, undefined, placements);
    };

    const handleShuffleSelection = (cardIds: string[]) => {
        const req = selectionState.shuffleSelectionReq;
        const pending = selectionState.pendingEffectCard;
        if (!gameState || !req || !pending || cardIds.length !== req.count || new Set(cardIds).size !== req.count) return;
        setShuffleSelectionReq(null);
        resolveEffect(pending, undefined, undefined, undefined, undefined,
            selectionState.pendingTriggerType || 'activate', undefined, undefined, undefined, cardIds);
    };

    /** Handles selection from the Discard Pile Modal. */
    const handleDiscardSelection = useCallback((index: number) => {
        if (!selectionState.discardSelectionReq || !gameState || !selectionState.pendingEffectCard) return;
        const pIdx = selectionState.discardSelectionReq.playerIndex;
        const card = gameState.players[pIdx].discard[index];
        if (!card || !selectionState.discardSelectionReq.filter(card)) return;

        setDiscardSelectionReq(null);
        setSelectedDiscardIndex(null);
        if (selectionState.discardSelectionReq.purpose !== 'summon') triggerVisual(`discard-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

        const pendingCard = selectionState.pendingEffectCard;
        const pendingTrigger = selectionState.pendingTriggerType || 'activate';
        const selectionIndex = selectionState.discardSelectionReq.selectionIndex;
        const selected = [...(pendingContext.current.discardCardIds ?? [])];
        if (selectionIndex !== undefined) selected[selectionIndex] = card.instanceId;
        resolveEffect(pendingCard, undefined, selectionIndex === undefined ? index : undefined, undefined, undefined, pendingTrigger,
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            selectionIndex === undefined ? undefined : selected);
    }, [gameState, selectionState.discardSelectionReq, selectionState.pendingEffectCard, selectionState.pendingTriggerType, resolveEffect, triggerVisual, setDiscardSelectionReq, setSelectedDiscardIndex, setPendingEffectCard]);

    /** Handles selection from the Hand Selection Modal (e.g. for Discard costs). */
    const handleHandSelection = useCallback((index: number) => {
        if (!selectionState.discardSelectionReq && !selectionState.pendingEffectCard) return;
        if (!gameState || !selectionState.pendingEffectCard) return;

        const pIdx = selectionState.handSelectionReq?.playerIndex ?? gameState.players.findIndex(p => p.id === selectionState.pendingEffectCard!.ownerId);
        const card = gameState.players[pIdx].hand[index];
        if (!card || (selectionState.handSelectionReq?.filter && !selectionState.handSelectionReq.filter(card))) return;

        setHandSelectionReq(null);
        setSelectedHandSelectionIndex(null);
        if (selectionState.handSelectionReq?.purpose !== 'summon') {
            triggerVisual(`${pIdx}-hand-${index}`, `discard-${pIdx}`, 'discard', card);
        }

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
        if (selectionState.deckSelectionReq.purpose !== 'summon') triggerVisual(`deck-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

        const pendingCard = selectionState.pendingEffectCard;
        const pendingTrigger = selectionState.pendingTriggerType || 'activate';
        resolveEffect(pendingCard, undefined, undefined, undefined, index, pendingTrigger);
    }, [gameState, selectionState.deckSelectionReq, selectionState.pendingEffectCard, selectionState.pendingTriggerType, resolveEffect, triggerVisual, setDeckSelectionReq, setSelectedDeckIndex, setPendingEffectCard]);

    const cancelEffect = () => {
        setEffectChoiceReq(null);
        setLevelTributeReq(null);
        setReserveSelectionReq(null);
        const card = selectionState.pendingEffectCard;
        if (gameState?.pendingChainTarget) setGameState(prev => prev?.pendingChainTarget ? applyCommand(prev,
            prev.chain!.at(-1)!.context.playerIndex, { type: 'chainTargets', targets: [] }).state : prev);
        if (card && !card.switchMandatory) setGameState(prev => prev && !prev.response ? applyCommand(prev,
            prev.pendingReactions?.find(entry => entry.card.instanceId === card.instanceId)?.playerIndex ?? (isLand(card) ? prev.activePlayerIndex : prev.players.findIndex(p => p.id === card.ownerId)),
            { type: 'cancelEffect', cardId: card.instanceId }).state : prev);
        pendingContext.current = {};
        setPawnPlacementReq(null);
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
    const handleEffectChoice = (id: string) => {
        const card = selectionState.pendingEffectCard;
        if (!card || !effectChoiceReq?.some(choice => choice.id === id && !choice.disabled)) return;
        resolveEffect(card, undefined, undefined, undefined, undefined, selectionState.pendingTriggerType ?? 'field_activate',
            undefined, undefined, undefined, undefined, undefined, id);
    };
    const handleLevelTribute = (materialIds: string[]) => {
        const card = selectionState.pendingEffectCard;
        if (!card || !levelTributeReq) return;
        setLevelTributeReq(null);
        resolveEffect(card, undefined, undefined, undefined, undefined, selectionState.pendingTriggerType ?? 'activate',
            undefined, undefined, undefined, undefined, undefined, undefined, undefined, materialIds);
    };
    const handleReserveSelection = (reserveIndex: number) => {
        const card = selectionState.pendingEffectCard;
        if (!card || !reserveSelectionReq || !gameState) return;
        const selected = gameState.players[reserveSelectionReq.playerIndex].reserve[reserveIndex];
        if (!selected || !reserveSelectionReq.filter(selected)) return;
        setReserveSelectionReq(null);
        resolveEffect(card, undefined, undefined, undefined, undefined, selectionState.pendingTriggerType ?? 'activate',
            undefined, undefined, undefined, undefined, undefined, undefined, reserveIndex);
    };
    return { effectChoiceReq, handleEffectChoice, pawnPlacementReq, handlePawnPlacement, reserveSelectionReq, handleReserveSelection,
        levelTributeReq, handleLevelTribute, resolveEffect, handleDiscardSelection, handleHandSelection, handlePeekSelection, handleDeckSelection, handleShuffleSelection, cancelEffect };
};
