import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, CardType, Phase, Position, CardContext } from '../types';
import { createDeck } from '../constants';
import { cardRegistry } from '../src/cards/CardRegistry';
import { useAnimations } from './useAnimations';
import { useEffectResolution } from './useEffectResolution';
import { useCardActions } from './useCardActions';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';

export const useGameLogic = () => {
    // Core Game State
    const [gameState, setGameState] = useState<GameState | null>(null);

    // Selection States
    const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
    const [selectedFieldSlot, setSelectedFieldSlot] = useState<{ playerIndex: number, type: 'entity' | 'action', index: number } | null>(null);
    const [targetSelectMode, setTargetSelectMode] = useState<'attack' | 'tribute' | 'effect' | 'place_entity' | 'place_action' | null>(null);
    const [targetSelectType, setTargetSelectType] = useState<'entity' | 'action' | 'any'>('entity');

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
    const [pendingTriggerType, setPendingTriggerType] = useState<'summon' | 'activate' | 'phase' | null>(null);
    const [isPeekingField, setIsPeekingField] = useState(false);

    // Discard/Hand Selection
    const [discardSelectionReq, setDiscardSelectionReq] = useState<{ playerIndex: number, filter: (c: Card) => boolean, title: string } | null>(null);
    const [selectedDiscardIndex, setSelectedDiscardIndex] = useState<number | null>(null);
    const [handSelectionReq, setHandSelectionReq] = useState<{ playerIndex: number, title: string } | null>(null);
    const [selectedHandSelectionIndex, setSelectedHandSelectionIndex] = useState<number | null>(null);

    // Pile viewing
    const [viewingDiscardIdx, setViewingDiscardIdx] = useState<number | null>(null);
    const [viewingVoidIdx, setViewingVoidIdx] = useState<number | null>(null);

    // Layout
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    // Refs
    const isTransitioning = useRef(false);
    const processedAutoPhase = useRef<string>("");
    const drawIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Compose sub-hooks
    const animations = useAnimations();

    const { resolveEffect, handleDiscardSelection, handleHandSelection } = useEffectResolution(
        gameState, setGameState, animations.triggerVisual,
        {
            setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType,
            setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
            setHandSelectionReq, setSelectedHandSelectionIndex,
            pendingEffectCard, discardSelectionReq,
            setPendingTriggerType, pendingTriggerType
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
        gameState, setGameState, stableResolveEffect, addLog,
        animations.triggerVisual, animations.triggerShatter,
        selectedHandIndex, setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode, isPeekingField, targetSelectMode
    );

    /** Helper to append messages to the game log. */
    function addLog(msg: string) {
        setGameState(prev => prev ? { ...prev, log: [msg, ...prev.log].slice(0, 50) } : null);
    }

    /** Checks if a card in hand is playable. */
    const canPlayCard = useCallback((card: Card) => {
        if (!gameState) return false;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return false;
        const activeIndex = gameState.activePlayerIndex;
        const player = gameState.players[activeIndex];

        if (card.type === CardType.ENTITY) {
            if (card.level <= 4) return !player.normalSummonUsed || !player.hiddenSummonUsed;
            else return player.entityZones.filter(z => z !== null).length >= (card.level <= 7 ? 1 : 2);
        } else {
            const effect = cardRegistry.getEffect(card.id);
            const context: CardContext = { card, playerIndex: activeIndex };
            return effect?.canActivate ? effect.canActivate(gameState, context) : true;
        }
    }, [gameState]);

    /** Advances the game to the next phase. */
    const nextPhase = useCallback(() => {
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
            if (nextPhase === Phase.END) {
                const effectsToResolve = currentPendingEffects.filter(e => e.dueTurn === prev.turnNumber && e.type === 'RESET_ATK');
                const remainingEffects = currentPendingEffects.filter(e => !(e.dueTurn === prev.turnNumber && e.type === 'RESET_ATK'));
                if (effectsToResolve.length > 0) {
                    updatedPlayers = updatedPlayers.map(p => ({
                        ...p,
                        entityZones: p.entityZones.map(z => {
                            if (!z) return null;
                            let newZ = { ...z };
                            if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                            const effect = effectsToResolve.find(e => e.targetInstanceId === z.card.instanceId);
                            if (effect) newZ = { ...newZ, card: { ...newZ.card, atk: effect.value } };
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
                        entityZones: p.entityZones.map(z => {
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

            return { ...prev, currentPhase: nextPhase, activePlayerIndex: activeIndex, turnNumber, players: updatedPlayers as [Player, Player], pendingEffects: currentPendingEffects };
        });
    }, []);

    // === EFFECTS ===

    /** Initialization */
    useEffect(() => {
        const p1Deck = createDeck('player1');
        const p2Deck = createDeck('player2');
        const mkPlayer = (id: string, name: string, deck: Card[]): Player => ({
            id, name, lp: 800, deck: deck.slice(5), hand: deck.slice(0, 5), discard: [], void: [],
            entityZones: Array(5).fill(null), actionZones: Array(5).fill(null),
            normalSummonUsed: false, hiddenSummonUsed: false,
        });
        animations.lastLp.current = [800, 800];
        setGameState({
            players: [mkPlayer('player1', 'Player 1', p1Deck), mkPlayer('player2', 'Player 2', p2Deck)],
            activePlayerIndex: 0, currentPhase: Phase.DRAW, turnNumber: 1, log: ['Duel initialized.'], winner: null, pendingEffects: []
        });
    }, []);

    /** Monitor pile changes for flash effects. */
    useEffect(() => {
        if (!gameState) return;
        gameState.players.forEach((p, idx) => {
            if (p.discard.length > animations.prevDiscardLengths.current[idx]) {
                animations.setDiscardFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = true; return n; });
                setTimeout(() => animations.setDiscardFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = false; return n; }), 800);
            }
            animations.prevDiscardLengths.current[idx] = p.discard.length;
            if (p.void.length > animations.prevVoidLengths.current[idx]) {
                animations.setVoidFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = true; return n; });
                setTimeout(() => animations.setVoidFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = false; return n; }), 800);
            }
            animations.prevVoidLengths.current[idx] = p.void.length;
        });
    }, [gameState?.players]);

    /** LP animations and floating texts. */
    useEffect(() => {
        if (!gameState) return;
        gameState.players.forEach((player, idx) => {
            const oldLp = animations.lastLp.current[idx];
            if (player.lp !== oldLp) {
                const diff = player.lp - oldLp;
                const id = Math.random().toString();
                animations.setFloatingTexts(prev => [...prev, { id, text: diff > 0 ? `+${diff}` : `${diff}`, type: diff > 0 ? 'heal' : 'damage', x: 50, y: 50 }]);
                setTimeout(() => animations.setFloatingTexts(prev => prev.filter(ft => ft.id !== id)), 2500);
                animations.lastLp.current[idx] = player.lp;
            }
        });
        gameState.players.forEach((player, idx) => {
            if (player.lp !== animations.displayedLp[idx]) {
                const diff = player.lp - animations.displayedLp[idx];
                const type = diff > 0 ? 'heal' : 'damage';
                animations.setLpFlash(prev => { const f = [...prev] as [string | null, string | null]; f[idx] = type; return f; });
                animations.setLpScale(prev => { const s = [...prev] as [boolean, boolean]; s[idx] = true; return s; });
                setTimeout(() => {
                    animations.setLpFlash(prev => { const f = [...prev] as [string | null, string | null]; f[idx] = null; return f; });
                    animations.setLpScale(prev => { const s = [...prev] as [boolean, boolean]; s[idx] = false; return s; });
                }, 800);
                const step = Math.ceil(Math.abs(diff) / 10);
                const timer = setInterval(() => {
                    animations.setDisplayedLp(prev => {
                        const newLp = [...prev] as [number, number];
                        if (newLp[idx] < player.lp) { newLp[idx] = Math.min(newLp[idx] + step, player.lp); }
                        else if (newLp[idx] > player.lp) { newLp[idx] = Math.max(newLp[idx] - step, player.lp); }
                        if (newLp[idx] === player.lp) clearInterval(timer);
                        return newLp;
                    });
                }, 20);
                return () => clearInterval(timer);
            }
        });
    }, [gameState?.players[0]?.lp, gameState?.players[1]?.lp, animations.displayedLp]);

    /** Phase automation (Draw/Standby). */
    useEffect(() => {
        if (!gameState || gameState.winner) return;
        const phaseKey = `${gameState.turnNumber}-${gameState.activePlayerIndex}-${gameState.currentPhase}`;
        if (processedAutoPhase.current === phaseKey) return;

        if (gameState.currentPhase === Phase.DRAW) {
            processedAutoPhase.current = phaseKey;
            isTransitioning.current = true;
            if (gameState.turnNumber > 0) { animations.setTurnFlash("TURN CHANGE"); setTimeout(() => animations.setTurnFlash(null), 1500); }
            setTimeout(() => animations.setPhaseFlash(Phase.DRAW), 1200);

            setGameState(prev => {
                if (!prev) return null;
                const players = [...prev.players];
                const p = { ...players[prev.activePlayerIndex] };
                p.normalSummonUsed = false; p.hiddenSummonUsed = false;
                p.entityZones = p.entityZones.map(z => z ? { ...z, hasAttacked: false, hasChangedPosition: false } : null);
                players[prev.activePlayerIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            // Calculate based on initial hand size
            const activePlayerPhaseStart = gameState.players[gameState.activePlayerIndex];
            const initialHandSize = activePlayerPhaseStart.hand.length;

            let drawCount = 0;

            if (gameState.turnNumber === 1) {
                // Skip drawing on the very first turn of the game
                setTimeout(() => { isTransitioning.current = false; nextPhase(); }, 1700);
            } else if (initialHandSize >= 5) {
                drawIntervalRef.current = setInterval(() => {
                    drawCount++;
                    setGameState(current => {
                        if (!current) return null;
                        const p = current.players[current.activePlayerIndex];
                        if (drawCount > 1 || p.deck.length === 0) {
                            if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
                            setTimeout(() => { isTransitioning.current = false; nextPhase(); }, 500);
                            return current;
                        }
                        const players = [...current.players];
                        const ply = { ...players[current.activePlayerIndex] };
                        ply.hand = [...ply.hand, ply.deck[0]];
                        ply.deck = ply.deck.slice(1);
                        players[current.activePlayerIndex] = ply;
                        return { ...current, players: players as [Player, Player] };
                    });
                }, 300);
            } else {
                drawIntervalRef.current = setInterval(() => {
                    drawCount++;
                    setGameState(current => {
                        if (!current) return null;
                        const p = current.players[current.activePlayerIndex];
                        // Need to check if hand achieved 5 cards PRIOR to this tick's draw!
                        // If it came in >= 5 and this is at least our 2nd interval tick, stop.
                        if ((p.hand.length >= 5 && drawCount > 1) || p.deck.length === 0) {
                            if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
                            setTimeout(() => { isTransitioning.current = false; nextPhase(); }, 500);
                            return current;
                        }
                        const players = [...current.players];
                        const ply = { ...players[current.activePlayerIndex] };
                        ply.hand = [...ply.hand, ply.deck[0]];
                        ply.deck = ply.deck.slice(1);
                        players[current.activePlayerIndex] = ply;
                        return { ...current, players: players as [Player, Player] };
                    });
                }, 300);
            }
        } else if (gameState.currentPhase === Phase.STANDBY) {
            processedAutoPhase.current = phaseKey;
            isTransitioning.current = true;
            animations.setPhaseFlash(Phase.STANDBY);
            setTimeout(() => { isTransitioning.current = false; nextPhase(); }, 1200);
        } else if (gameState.currentPhase === Phase.END) {
            processedAutoPhase.current = phaseKey;
            isTransitioning.current = true;
            animations.setPhaseFlash(Phase.END);
            setTimeout(() => { isTransitioning.current = false; nextPhase(); }, 1200);
        } else {
            animations.setPhaseFlash(gameState.currentPhase);
        }
    }, [gameState?.currentPhase, gameState?.activePlayerIndex, gameState?.turnNumber, gameState?.winner, nextPhase]);

    // === RETURN ===
    return {
        gameState, setGameState,
        state: {
            selectedHandIndex, selectedFieldSlot, targetSelectMode, targetSelectType,
            tributeSelection, pendingTributeCard, tributeSummonMode,
            pendingPlayCard, playMode,
            triggeredEffect, pendingEffectCard, pendingTriggerType, isPeekingField,
            discardSelectionReq, selectedDiscardIndex, handSelectionReq, selectedHandSelectionIndex,
            phaseFlash: animations.phaseFlash, turnFlash: animations.turnFlash,
            displayedLp: animations.displayedLp, lpScale: animations.lpScale, lpFlash: animations.lpFlash,
            viewingDiscardIdx, viewingVoidIdx,
            flyingCards: animations.flyingCards, voidAnimations: animations.voidAnimations,
            floatingTexts: animations.floatingTexts, shatterEffects: animations.shatterEffects,
            discardFlash: animations.discardFlash, voidFlash: animations.voidFlash,
            isRightPanelOpen,
        },
        actions: {
            setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode, setTargetSelectType,
            setTributeSelection, setIsPeekingField,
            setDiscardSelectionReq, setSelectedDiscardIndex, setHandSelectionReq, setSelectedHandSelectionIndex,
            setTriggeredEffect, setPendingEffectCard,
            setViewingDiscardIdx, setViewingVoidIdx, setIsRightPanelOpen,
            setRef: animations.setRef,
            nextPhase, canPlayCard, resolveEffect,
            handleDiscardSelection, handleHandSelection,
            handleSummon: (card: Card, mode: 'normal' | 'hidden' | 'tribute', autoSlotIndex?: number) =>
                cardActions.handleSummon(card, mode, { setPendingTributeCard, setTributeSummonMode, setTributeSelection, setPendingPlayCard, setPlayMode, setTriggeredEffect, setPendingTriggerType }, autoSlotIndex),
            handleTributeSummon: () =>
                cardActions.handleTributeSummon(pendingTributeCard, tributeSelection, tributeSummonMode, { setPendingTributeCard, setTributeSelection, setPendingPlayCard, setPlayMode }),
            handleActionFromHand: (card: Card, mode: 'activate' | 'set', autoSlotIndex?: number) =>
                cardActions.handleActionFromHand(card, mode, { setPendingPlayCard, setPlayMode, setTriggeredEffect, setPendingTriggerType }, autoSlotIndex),
            handlePlacement: (slotIndex: number) =>
                cardActions.handlePlacement(slotIndex, pendingPlayCard, playMode, {
                    setPendingPlayCard, setPlayMode,
                    setTriggeredEffect, setPendingTriggerType
                }),
            activateOnField: cardActions.activateOnField,
            handleAttack: cardActions.handleAttack,
            addLog,
        }
    };
};
