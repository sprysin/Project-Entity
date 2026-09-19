import { useState, useEffect, useCallback, useRef } from 'react';
import {
    GameState, Player, Card, CardType, Phase, CardContext, CardSelectionRequest,
    EffectTrigger, HandSelectionRequest, TargetSelectMode, TargetSelectPosition,
    TargetSelectType, TributeSelectionRequest
} from '../types';
import { createDeck } from '../constants';
import { cardRegistry } from '../cards/CardRegistry';
import { clonePlayers } from '../game/cloneState';
import { formatEffectLog } from '../game/effectLog';
import { useAnimations } from './useAnimations';
import { useCardMotion } from './useCardMotion';
import { useEffectResolution } from './useEffectResolution';
import { useCardActions } from './useCardActions';
import { useGameAnimationEffects } from './useGameAnimationEffects';
import '../cards/pawns';
import '../cards/actions';
import '../cards/conditions';
import { createRuntimeDeck, SavedDeck } from '../decks';

export const useGameLogic = (initialDecks: [SavedDeck | null, SavedDeck | null] = [null, null]) => {
    // Core Game State
    const [gameState, setGameState] = useState<GameState | null>(null);

    // Selection States
    const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
    const [selectedFieldSlot, setSelectedFieldSlot] = useState<{ playerIndex: number, type: 'pawn' | 'action', index: number } | null>(null);
    const [targetSelectMode, setTargetSelectMode] = useState<TargetSelectMode>(null);
    const [targetSelectType, setTargetSelectType] = useState<TargetSelectType>('pawn');
    const [targetSelectPosition, setTargetSelectPosition] = useState<TargetSelectPosition>('both');

    // Card Play (Manual Placement)
    const [pendingPlayCard, setPendingPlayCard] = useState<Card | null>(null);
    const [playMode, setPlayMode] = useState<'normal' | 'hidden' | 'activate' | 'set' | null>(null);

    // Tribute
    const [tributeSelection, setTributeSelection] = useState<number[]>([]);
    const [pendingTributeCard, setPendingTributeCard] = useState<Card | null>(null);
    const [tributeSummonMode, setTributeSummonMode] = useState<'normal' | 'hidden'>('normal');

    // Effect Resolution
    const [triggeredEffect, setTriggeredEffect] = useState<Card | null>(null);
    const [pendingEffectCard, setPendingEffectCard] = useState<Card | null>(null);
    const [pendingTriggerType, setPendingTriggerType] = useState<EffectTrigger | null>(null);
    const [isPeekingField, setIsPeekingField] = useState(false);

    // Discard/Hand Selection
    const [discardSelectionReq, setDiscardSelectionReq] = useState<CardSelectionRequest | null>(null);
    const [selectedDiscardIndex, setSelectedDiscardIndex] = useState<number | null>(null);
    const [handSelectionReq, setHandSelectionReq] = useState<HandSelectionRequest | null>(null);
    const [selectedHandSelectionIndex, setSelectedHandSelectionIndex] = useState<number | null>(null);
    const [deckSelectionReq, setDeckSelectionReq] = useState<CardSelectionRequest | null>(null);
    const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null);
    const [effectTributeReq, setEffectTributeReq] = useState<TributeSelectionRequest | null>(null);

    // Pile viewing
    const [viewingDiscardIdx, setViewingDiscardIdx] = useState<number | null>(null);
    const [viewingVoidIdx, setViewingVoidIdx] = useState<number | null>(null);

    // Layout
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isDeckViewerOpen, setIsDeckViewerOpen] = useState(false);

    // Compose sub-hooks
    const animations = useAnimations();
    const cardMotion = useCardMotion(gameState, animations.zoneRefs);

    const { resolveEffect, handleDiscardSelection, handleHandSelection, handleDeckSelection, cancelEffect } = useEffectResolution(
        gameState, setGameState, cardMotion.recordMovement,
        {
            setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition,
            setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
            setHandSelectionReq, setSelectedHandSelectionIndex,
            setDeckSelectionReq, setSelectedDeckIndex,
            pendingEffectCard, discardSelectionReq, deckSelectionReq,
            setPendingTriggerType, pendingTriggerType,
            setEffectTributeReq,
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
        cardMotion.recordMovement, animations.triggerShatter,
        selectedHandIndex, setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode,
        isPeekingField || pendingEffectCard !== null || triggeredEffect !== null, targetSelectMode
    );

    /** Checks if a card in hand is playable. */
    const canPlayCard = useCallback((card: Card) => {
        if (!gameState || gameState.winner) return false;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return false;
        const activeIndex = gameState.activePlayerIndex;
        const player = gameState.players[activeIndex];

        if (card.type === CardType.PAWN) {
            if (card.level <= 4) return !player.normalSummonUsed || !player.hiddenSummonUsed;
            else return player.pawnZones.filter(z => z !== null).length >= (card.level <= 7 ? 1 : 2);
        } else {
            const effect = cardRegistry.getEffect(card.id);
            const context: CardContext = { card, playerIndex: activeIndex };
            return effect?.canActivate ? effect.canActivate(gameState, context) : true;
        }
    }, [gameState]);

    /** Advances the game to the next phase. */
    const nextPhase = useCallback(() => {
        if (pendingEffectCard || triggeredEffect || targetSelectMode) return;
        setGameState(prev => {
            if (!prev || prev.winner) return prev;
            let nextPhase = prev.currentPhase;
            let activeIndex = prev.activePlayerIndex;
            let turnNumber = prev.turnNumber;

            if (prev.turnNumber === 1 && prev.currentPhase === Phase.MAIN1) {
                nextPhase = Phase.END;
            } else {
                switch (prev.currentPhase) {
                    case Phase.DRAW: nextPhase = Phase.STANDBY; break;
                    case Phase.STANDBY: nextPhase = Phase.MAIN1; break;
                    case Phase.MAIN1: nextPhase = Phase.BATTLE; break;
                    case Phase.BATTLE: nextPhase = Phase.MAIN2; break;
                    case Phase.MAIN2: nextPhase = Phase.END; break;
                    case Phase.END:
                        nextPhase = Phase.DRAW;
                        activeIndex = (activeIndex + 1) % 2;
                        turnNumber += 1;
                        break;
                }
            }

            // Handle End Phase pending effects (e.g. ATK resets)
            let currentPendingEffects = prev.pendingEffects || [];
            let updatedPlayers = [...prev.players];
            let updatedLog = prev.log;

            if (nextPhase === Phase.BATTLE) {
                updatedPlayers = updatedPlayers.map(p => ({
                    ...p,
                    pawnZones: p.pawnZones.map(z => z ? {
                        ...z,
                        attacksRemaining: z.nextBattleAttacks ?? 1,
                        nextBattleAttacks: undefined,
                    } : null)
                })) as [Player, Player];
            }

            if (nextPhase === Phase.STANDBY) {
                let phaseState = { ...prev, players: updatedPlayers as [Player, Player], currentPhase: nextPhase, activePlayerIndex: activeIndex, turnNumber };
                const standbyPlayer = phaseState.players[activeIndex];
                for (const card of [...standbyPlayer.discard]) {
                    if (!card.tributedByAction) continue;
                    const phaseEffect = cardRegistry.getEffect(card.id)?.onPhaseChange;
                    if (!phaseEffect) continue;
                    const context = { card, playerIndex: activeIndex };
                    const result = phaseEffect(phaseState, context);
                    if (result?.newState && !result.halted) {
                        const log = formatEffectLog(phaseState, result.newState, card, context, 'phase');
                        phaseState = { ...result.newState, log: [log, ...phaseState.log].slice(0, 50) };
                    }
                }
                updatedPlayers = phaseState.players;
                updatedLog = phaseState.log;
            }

            if (nextPhase === Phase.END) {
                const effectsToResolve = currentPendingEffects.filter(e => e.dueTurn === prev.turnNumber && (e.type === 'RESET_ATK' || e.type === 'RESET_DEF'));
                const remainingEffects = currentPendingEffects.filter(e => !(e.dueTurn === prev.turnNumber && (e.type === 'RESET_ATK' || e.type === 'RESET_DEF')));
                if (effectsToResolve.length > 0) {
                    updatedPlayers = updatedPlayers.map(p => ({
                        ...p,
                        activatedHardOncePerTurns: [],
                        pawnZones: p.pawnZones.map(z => {
                            if (!z) return null;
                            let newZ = { ...z };
                            if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                            const atkEffect = effectsToResolve.find(e => e.type === 'RESET_ATK' && e.targetInstanceId === z.card.instanceId);
                            if (atkEffect) newZ = { ...newZ, card: { ...newZ.card, atk: atkEffect.value } };
                            const defEffect = effectsToResolve.find(e => e.type === 'RESET_DEF' && e.targetInstanceId === z.card.instanceId);
                            if (defEffect) newZ = { ...newZ, card: { ...newZ.card, def: defEffect.value } };
                            return newZ;
                        }),
                        actionZones: p.actionZones.map(z => {
                            if (!z) return null;
                            let newZ = { ...z };
                            if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                            return newZ;
                        })
                    })) as [Player, Player];
                    currentPendingEffects = remainingEffects;
                } else {
                    updatedPlayers = updatedPlayers.map(p => ({
                        ...p,
                        activatedHardOncePerTurns: [],
                        pawnZones: p.pawnZones.map(z => {
                            if (!z) return null;
                            let newZ = { ...z };
                            if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                            return newZ;
                        }),
                        actionZones: p.actionZones.map(z => {
                            if (!z) return null;
                            let newZ = { ...z };
                            if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                            return newZ;
                        })
                    })) as [Player, Player];
                }
            }

            return { ...prev, currentPhase: nextPhase, activePlayerIndex: activeIndex, turnNumber, players: updatedPlayers as [Player, Player], pendingEffects: currentPendingEffects, log: updatedLog };
        });
    }, [pendingEffectCard, triggeredEffect, targetSelectMode]);

    // === EFFECTS ===

    /** Initialization */
    useEffect(() => {
        const p1Deck = initialDecks[0] ? createRuntimeDeck(initialDecks[0], 'player1') : createDeck('player1');
        const p2Deck = initialDecks[1] ? createRuntimeDeck(initialDecks[1], 'player2') : createDeck('player2');
        const mkPlayer = (id: string, name: string, deck: Card[]): Player => ({
            id, name, lp: 800, deck: deck.slice(5), initialDeck: [...deck], hand: deck.slice(0, 5), discard: [], void: [],
            pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null),
            normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [],
        });
        animations.lastLp.current = [800, 800];
        setGameState({
            players: [mkPlayer('player1', 'Player 1', p1Deck), mkPlayer('player2', 'Player 2', p2Deck)],
            activePlayerIndex: 0, currentPhase: Phase.DRAW, turnNumber: 1,
            log: [`Duel initialized. Player 1: ${initialDecks[0]?.name ?? 'Random test deck'}; Player 2: ${initialDecks[1]?.name ?? 'Random test deck'}.`],
            winner: null, pendingEffects: []
        });
    }, []);

    useGameAnimationEffects(gameState, setGameState, animations, nextPhase);

    // === RETURN ===
    return {
        gameState, setGameState,
        state: {
            selectedHandIndex, selectedFieldSlot, targetSelectMode, targetSelectType, targetSelectPosition,
            tributeSelection, pendingTributeCard, tributeSummonMode,
            pendingPlayCard, playMode,
            triggeredEffect, pendingEffectCard, pendingTriggerType, isPeekingField,
            discardSelectionReq, selectedDiscardIndex, handSelectionReq, selectedHandSelectionIndex,
            deckSelectionReq, selectedDeckIndex,
            phaseFlash: animations.phaseFlash, turnFlash: animations.turnFlash,
            displayedLp: animations.displayedLp, lpScale: animations.lpScale, lpFlash: animations.lpFlash,
            viewingDiscardIdx, viewingVoidIdx,
            cardMotions: cardMotion.motions, finishMotion: cardMotion.finishMotion,
            floatingTexts: animations.floatingTexts, shatterEffects: animations.shatterEffects,
            discardFlash: animations.discardFlash, voidFlash: animations.voidFlash,
            isRightPanelOpen, isDeckViewerOpen, effectTributeReq,
        },
        actions: {
            setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition,
            setTributeSelection, setIsPeekingField,
            setDiscardSelectionReq, setSelectedDiscardIndex, setHandSelectionReq, setSelectedHandSelectionIndex,
            setDeckSelectionReq, setSelectedDeckIndex,
            setTriggeredEffect, setPendingEffectCard,
            setViewingDiscardIdx, setViewingVoidIdx, setIsRightPanelOpen, setIsDeckViewerOpen,
            setRef: animations.setRef,
            nextPhase, canPlayCard, resolveEffect, cancelEffect,
            handleDiscardSelection, handleHandSelection, handleDeckSelection,
            handleSummon: (card: Card, mode: 'normal' | 'hidden' | 'tribute', autoSlotIndex?: number) =>
                cardActions.handleSummon(card, mode, { setPendingTributeCard, setTributeSummonMode, setTributeSelection, setPendingPlayCard, setPlayMode, setTriggeredEffect, setPendingTriggerType }, autoSlotIndex),
            handleTributeSummon: () =>
                cardActions.handleTributeSummon(pendingTributeCard, tributeSelection, tributeSummonMode, { setPendingTributeCard, setTributeSelection, setPendingPlayCard, setPlayMode }),
            handleEffectTribute: () => {
                if (!gameState || !pendingEffectCard || !effectTributeReq) return;
                if (tributeSelection.length !== effectTributeReq.count) return;
                const activeIndex = gameState.activePlayerIndex;
                const copiedSelection = [...tributeSelection];
                
                if (new Set(copiedSelection).size !== effectTributeReq.count || copiedSelection.some(idx => {
                    const zone = gameState.players[activeIndex].pawnZones[idx];
                    return !zone || (effectTributeReq.filter && !effectTributeReq.filter(zone.card));
                })) return;
                copiedSelection.forEach(idx => cardMotion.recordMovement(`${activeIndex}-pawn-${idx}`, `discard-${activeIndex}`, 'discard', gameState.players[activeIndex].pawnZones[idx]!.card));
                setGameState(prev => {
                    if (!prev) return null;
                    const players = clonePlayers(prev.players);
                    const p = players[activeIndex];
                    copiedSelection.forEach(idx => {
                        const tribute = p.pawnZones[idx];
                        if (tribute) { 
                            p.discard = [...p.discard, { ...tribute.card, tributedByAction: pendingEffectCard.type === CardType.ACTION }];
                            p.pawnZones[idx] = null; 
                        }
                    });
                    players[activeIndex] = p;
                    return { ...prev, players: players as [Player, Player] };
                });
                
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
            handleAttack: cardActions.handleAttack,
        }
    };
};
