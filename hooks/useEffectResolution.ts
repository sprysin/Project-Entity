import { useCallback, Dispatch, SetStateAction, useRef } from 'react';
import { GameState, Card, CardContext, EffectResult } from '../types';
import { cardRegistry } from '../src/cards/CardRegistry';

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
        setTargetSelectMode: (mode: 'attack' | 'tribute' | 'effect' | null) => void,
        setTargetSelectType: (type: 'entity' | 'action' | 'any') => void,
        setIsPeekingField: (peek: boolean) => void,
        setDiscardSelectionReq: (req: any) => void,
        setSelectedDiscardIndex: (idx: number | null) => void,
        setHandSelectionReq: (req: any) => void,
        setSelectedHandSelectionIndex: (idx: number | null) => void,
        pendingEffectCard: Card | null,
        discardSelectionReq: any,
        setPendingTriggerType: (t: 'summon' | 'activate' | 'phase' | null) => void,
        pendingTriggerType: 'summon' | 'activate' | 'phase' | null,
    }
) => {
    const {
        setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType,
        setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
        setHandSelectionReq, setSelectedHandSelectionIndex,
        setPendingTriggerType, pendingTriggerType,
    } = selectionState;

    // Use a ref to persist context properties (like target or handIndex) between chained prompts.
    const pendingContext = useRef<Partial<CardContext> & { triggerType?: 'summon' | 'activate' | 'phase' }>({});

    /** Executes a card's unique ability. Handles targeting logic with peek-first pattern. */
    const resolveEffect = useCallback((
        card: Card,
        target?: { playerIndex: number, type: 'entity' | 'action', index: number },
        discardIndex?: number,
        handIndex?: number,
        triggerType: 'summon' | 'activate' | 'phase' = 'activate'
    ) => {
        const activeIndex = gameState?.activePlayerIndex ?? 0;

        const actualTarget = target ?? pendingContext.current.target;
        const actualDiscardIndex = discardIndex ?? pendingContext.current.discardIndex;
        const actualHandIndex = handIndex ?? pendingContext.current.handIndex;
        const actualTriggerType = pendingContext.current.triggerType ?? triggerType;

        pendingContext.current = {
            target: actualTarget,
            discardIndex: actualDiscardIndex,
            handIndex: actualHandIndex,
            triggerType: actualTriggerType
        };

        // DELAYED ANIMATION HANDLING for Void Caster (entity_04)
        if (card.id === 'entity_04' && triggerType === 'summon') {
            const discardIdx = gameState?.players[activeIndex].discard.findIndex(c => c.id === 'action_01');
            if (discardIdx !== undefined && discardIdx !== -1) {
                const cardInDiscard = gameState!.players[activeIndex].discard[discardIdx];
                setTriggeredEffect(null);
                setPendingEffectCard(null);
                setIsPeekingField(false);
                triggerVisual(`discard-${activeIndex}`, `${activeIndex}-hand-${gameState?.players[activeIndex].hand.length ?? 0}`, 'retrieve', cardInDiscard);
                setTimeout(() => {
                    setGameState(prev => {
                        if (!prev) return null;
                        const context: CardContext = { card, playerIndex: activeIndex, target: actualTarget, discardIndex: discardIdx, handIndex: actualHandIndex };
                        const effect = cardRegistry.getEffect(card.id);
                        if (effect && effect.onSummon) {
                            const { newState, log } = effect.onSummon(prev, context);
                            return { ...newState, log: [log, ...newState.log].slice(0, 50) };
                        }
                        return prev;
                    });
                }, 800);
                return;
            }
        }

        if (card.id === 'condition_02' && actualTarget) {
            if (gameState?.players[actualTarget.playerIndex].actionZones[actualTarget.index]) {
                const targetCard = gameState.players[actualTarget.playerIndex].actionZones[actualTarget.index]!.card;
                triggerVisual(`${actualTarget.playerIndex}-action-${actualTarget.index}`, `void-${actualTarget.playerIndex}`, 'void', targetCard);
            }
        }

        // Peek at the effect result to check if we need a selection mode
        const effect = cardRegistry.getEffect(card.id);
        let peekResult: EffectResult | undefined;
        const contextForPeek: CardContext = { card, playerIndex: activeIndex, target: actualTarget, discardIndex: actualDiscardIndex, handIndex: actualHandIndex };

        if (effect && gameState) {
            if (actualTriggerType === 'summon' && effect.onSummon) peekResult = effect.onSummon(gameState, contextForPeek);
            else if (actualTriggerType === 'activate' && effect.onActivate) peekResult = effect.onActivate(gameState, contextForPeek);
        }

        // Enter selection mode if needed — return early without touching game state
        if (peekResult?.requireTarget && !actualTarget) {
            setTriggeredEffect(null);
            setPendingEffectCard(card);
            setTargetSelectMode('effect');
            setTargetSelectType(peekResult.requireTarget);
            setIsPeekingField(false);
            setPendingTriggerType(actualTriggerType);
            return;
        }
        if (peekResult?.requireDiscardSelection && actualDiscardIndex === undefined) {
            setPendingEffectCard(card);
            setDiscardSelectionReq(peekResult.requireDiscardSelection);
            setSelectedDiscardIndex(null);
            return;
        }
        if (peekResult?.requireHandSelection && actualHandIndex === undefined) {
            setPendingEffectCard(card);
            setHandSelectionReq(peekResult.requireHandSelection);
            setSelectedHandSelectionIndex(null);
            return;
        }

        // Apply the effect to game state
        setGameState(prev => {
            if (!prev) return null;
            const executionContext: CardContext = { card, playerIndex: activeIndex, target: actualTarget, discardIndex: actualDiscardIndex, handIndex: actualHandIndex };
            let result: EffectResult | undefined;
            if (effect) {
                if (actualTriggerType === 'summon' && effect.onSummon) result = effect.onSummon(prev, executionContext);
                else if (actualTriggerType === 'activate' && effect.onActivate) result = effect.onActivate(prev, executionContext);
            }
            if (!result) return prev;
            const { newState, log } = result;
            return { ...newState, log: [log, ...newState.log].slice(0, 50) };
        });

        // Cleanup selection modes
        setTriggeredEffect(null);
        setPendingEffectCard(null);
        setTargetSelectMode(null);
        setTargetSelectType('entity');
        setIsPeekingField(false);
        setPendingTriggerType(null);
        pendingContext.current = {};
        if (actualDiscardIndex !== undefined) { setDiscardSelectionReq(null); setSelectedDiscardIndex(null); }
        if (actualHandIndex !== undefined) { setHandSelectionReq(null); setSelectedHandSelectionIndex(null); }
    }, [gameState, setGameState, triggerVisual, setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex, setHandSelectionReq, setSelectedHandSelectionIndex]);

    /** Handles selection from the Discard Pile Modal. */
    const handleDiscardSelection = useCallback((index: number) => {
        if (!selectionState.discardSelectionReq || !gameState || !selectionState.pendingEffectCard) return;
        const pIdx = selectionState.discardSelectionReq.playerIndex;
        const card = gameState.players[pIdx].discard[index];

        setDiscardSelectionReq(null);
        setSelectedDiscardIndex(null);
        triggerVisual(`discard-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

        const pendingCard = selectionState.pendingEffectCard;
        setTimeout(() => {
            resolveEffect(pendingCard, undefined, index, undefined, undefined);
        }, 700);
    }, [gameState, selectionState.discardSelectionReq, selectionState.pendingEffectCard, resolveEffect, triggerVisual, setDiscardSelectionReq, setSelectedDiscardIndex, setPendingEffectCard]);

    /** Handles selection from the Hand Selection Modal (e.g. for Discard costs). */
    const handleHandSelection = useCallback((index: number) => {
        if (!selectionState.discardSelectionReq && !selectionState.pendingEffectCard) return;
        if (!gameState || !selectionState.pendingEffectCard) return;

        const pIdx = gameState.activePlayerIndex;
        const card = gameState.players[pIdx].hand[index];

        setHandSelectionReq(null);
        setSelectedHandSelectionIndex(null);
        triggerVisual(`${pIdx}-hand-${index}`, `discard-${pIdx}`, 'discard', card);

        const pendingCard = selectionState.pendingEffectCard;
        setTimeout(() => {
            resolveEffect(pendingCard, undefined, undefined, index, undefined);
        }, 400);
    }, [gameState, selectionState.pendingEffectCard, resolveEffect, triggerVisual, setHandSelectionReq, setSelectedHandSelectionIndex, setPendingEffectCard]);

    return { resolveEffect, handleDiscardSelection, handleHandSelection };
};
