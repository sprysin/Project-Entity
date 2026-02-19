import { useCallback, Dispatch, SetStateAction } from 'react';
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
    }
) => {
    const {
        setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType,
        setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
        setHandSelectionReq, setSelectedHandSelectionIndex,
    } = selectionState;

    /** Executes a card's unique ability. Handles targeting logic with peek-first pattern. */
    const resolveEffect = useCallback((
        card: Card,
        target?: { playerIndex: number, type: 'entity' | 'action', index: number },
        discardIndex?: number,
        handIndex?: number,
        triggerType: 'summon' | 'activate' | 'phase' = 'activate'
    ) => {
        const activeIndex = gameState?.activePlayerIndex ?? 0;

        // DELAYED ANIMATION HANDLING for Void Caster (entity_04)
        if (card.id === 'entity_04' && triggerType === 'summon') {
            const cardInDiscard = gameState?.players[activeIndex].discard.find(c => c.id === 'action_01');
            if (cardInDiscard) {
                setTriggeredEffect(null);
                setPendingEffectCard(null);
                setIsPeekingField(false);
                triggerVisual(`discard-${activeIndex}`, `${activeIndex}-hand-${gameState?.players[activeIndex].hand.length ?? 0}`, 'retrieve', cardInDiscard);
                setTimeout(() => {
                    setGameState(prev => {
                        if (!prev) return null;
                        const context: CardContext = { card, playerIndex: activeIndex, target, discardIndex, handIndex };
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

        if (card.id === 'condition_02' && target) {
            if (gameState?.players[target.playerIndex].actionZones[target.index]) {
                const targetCard = gameState.players[target.playerIndex].actionZones[target.index]!.card;
                triggerVisual(`${target.playerIndex}-action-${target.index}`, `void-${target.playerIndex}`, 'void', targetCard);
            }
        }

        // Peek at the effect result to check if we need a selection mode
        const effect = cardRegistry.getEffect(card.id);
        let peekResult: EffectResult | undefined;
        const contextForPeek: CardContext = { card, playerIndex: activeIndex, target, discardIndex, handIndex };

        if (effect && gameState) {
            if (triggerType === 'summon' && effect.onSummon) peekResult = effect.onSummon(gameState, contextForPeek);
            else if (triggerType === 'activate' && effect.onActivate) peekResult = effect.onActivate(gameState, contextForPeek);
        }

        // Enter selection mode if needed — return early without touching game state
        if (peekResult?.requireTarget && !target) {
            setTriggeredEffect(null);
            setPendingEffectCard(card);
            setTargetSelectMode('effect');
            setTargetSelectType(peekResult.requireTarget);
            setIsPeekingField(false);
            return;
        }
        if (peekResult?.requireDiscardSelection && discardIndex === undefined) {
            setPendingEffectCard(card);
            setDiscardSelectionReq(peekResult.requireDiscardSelection);
            setSelectedDiscardIndex(null);
            return;
        }
        if (peekResult?.requireHandSelection && handIndex === undefined) {
            setPendingEffectCard(card);
            setHandSelectionReq(peekResult.requireHandSelection);
            setSelectedHandSelectionIndex(null);
            return;
        }

        // Apply the effect to game state
        setGameState(prev => {
            if (!prev) return null;
            const executionContext: CardContext = { card, playerIndex: activeIndex, target, discardIndex, handIndex };
            let result: EffectResult | undefined;
            if (effect) {
                if (triggerType === 'summon' && effect.onSummon) result = effect.onSummon(prev, executionContext);
                else if (triggerType === 'activate' && effect.onActivate) result = effect.onActivate(prev, executionContext);
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
        if (discardIndex !== undefined) { setDiscardSelectionReq(null); setSelectedDiscardIndex(null); }
        if (handIndex !== undefined) { setHandSelectionReq(null); setSelectedHandSelectionIndex(null); }
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
            resolveEffect(pendingCard, undefined, index);
            setPendingEffectCard(null);
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
            resolveEffect(pendingCard, undefined, undefined, index);
            setPendingEffectCard(null);
        }, 400);
    }, [gameState, selectionState.pendingEffectCard, resolveEffect, triggerVisual, setHandSelectionReq, setSelectedHandSelectionIndex, setPendingEffectCard]);

    return { resolveEffect, handleDiscardSelection, handleHandSelection };
};
