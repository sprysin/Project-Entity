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
    const [selectedFieldSlot, setSelectedFieldSlot] = useState<{ playerIndex: number, type: 'pawn' | 'action', index: number } | null>(null);
    const [targetSelectMode, setTargetSelectMode] = useState<'attack' | 'tribute' | 'effect' | 'place_pawn' | 'place_action' | null>(null);
    const [targetSelectType, setTargetSelectType] = useState<'pawn' | 'action' | 'any'>('pawn');
    const [targetSelectPosition, setTargetSelectPosition] = useState<'hidden' | 'faceup' | 'both'>('both');

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
    const [pendingTriggerType, setPendingTriggerType] = useState<'summon' | 'activate' | 'phase' | 'field_activate' | null>(null);
    const [isPeekingField, setIsPeekingField] = useState(false);

    // Discard/Hand Selection
    const [discardSelectionReq, setDiscardSelectionReq] = useState<{ playerIndex: number, filter: (c: Card) => boolean, title: string } | null>(null);
    const [selectedDiscardIndex, setSelectedDiscardIndex] = useState<number | null>(null);
    const [handSelectionReq, setHandSelectionReq] = useState<{ playerIndex: number, title: string } | null>(null);
    const [selectedHandSelectionIndex, setSelectedHandSelectionIndex] = useState<number | null>(null);
    const [deckSelectionReq, setDeckSelectionReq] = useState<{ playerIndex: number, filter: (c: Card) => boolean, title: string } | null>(null);
    const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null);
    const [effectTributeReq, setEffectTributeReq] = useState<{ playerIndex: number, count: number, filter?: (c: Card) => boolean, title: string } | null>(null);

    // Pile viewing
    const [viewingDiscardIdx, setViewingDiscardIdx] = useState<number | null>(null);
    const [viewingVoidIdx, setViewingVoidIdx] = useState<number | null>(null);

    // Layout
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isDeckViewerOpen, setIsDeckViewerOpen] = useState(false);

    // Compose sub-hooks
    const animations = useAnimations();

    const { resolveEffect, handleDiscardSelection, handleHandSelection, handleDeckSelection, cancelEffect } = useEffectResolution(
        gameState, setGameState, animations.triggerVisual,
        {
            setTriggeredEffect, setPendingEffectCard, setTargetSelectMode, setTargetSelectType, setTargetSelectPosition,
            setIsPeekingField, setDiscardSelectionReq, setSelectedDiscardIndex,
            setHandSelectionReq, setSelectedHandSelectionIndex,
            setDeckSelectionReq, setSelectedDeckIndex,
            pendingEffectCard, discardSelectionReq, deckSelectionReq,
            setPendingTriggerType, pendingTriggerType,
            setEffectTributeReq
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
        selectedHandIndex, setSelectedHandIndex, setSelectedFieldSlot, setTargetSelectMode,
        isPeekingField || pendingEffectCard !== null || triggeredEffect !== null, targetSelectMode
    );

    /** Helper to append messages to the game log. */
    function addLog(msg: string) {
        setGameState(prev => prev ? { ...prev, log: [msg, ...prev.log].slice(0, 50) } : null);
    }

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

            return { ...prev, currentPhase: nextPhase, activePlayerIndex: activeIndex, turnNumber, players: updatedPlayers as [Player, Player], pendingEffects: currentPendingEffects };
        });
    }, [pendingEffectCard, triggeredEffect, targetSelectMode]);

    // === EFFECTS ===

    /** Initialization */
    useEffect(() => {
        const p1Deck = createDeck('player1');
        const p2Deck = createDeck('player2');
        const mkPlayer = (id: string, name: string, deck: Card[]): Player => ({
            id, name, lp: 800, deck: deck.slice(5), initialDeck: [...deck], hand: deck.slice(0, 5), discard: [], void: [],
            pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null),
            normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [],
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
        const timers: ReturnType<typeof setInterval>[] = [];
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
                timers.push(timer);
            }
        });
        return () => timers.forEach(clearInterval);
    }, [gameState?.players[0]?.lp, gameState?.players[1]?.lp]);

    /** Timers animate phase transitions; state updater functions stay pure. */
    useEffect(() => {
        if (!gameState || gameState.winner) return;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
        const phase = gameState.currentPhase;
        const active = gameState.activePlayerIndex;
        const turn = gameState.turnNumber;
        if (phase === Phase.DRAW) {
            animations.setTurnFlash("TURN CHANGE");
            later(() => animations.setTurnFlash(null), 1500);
            later(() => animations.setPhaseFlash(Phase.DRAW), 1200);
            setGameState(prev => {
                if (!prev || prev.winner) return prev;
                const players = [...prev.players] as [Player, Player];
                const p = players[active];
                players[active] = { ...p, normalSummonUsed: false, hiddenSummonUsed: false,
                    pawnZones: p.pawnZones.map(z => z ? { ...z, hasAttacked: false, hasChangedPosition: false } : null) };
                return { ...prev, players };
            });
            const player = gameState.players[active];
            const count = turn === 1 ? 0 : Math.min(player.deck.length, Math.max(1, 5 - player.hand.length));
            for (let i = 0; i < count; i++) {
                later(() => setGameState(prev => {
                    if (!prev || prev.winner || prev.turnNumber !== turn || prev.currentPhase !== Phase.DRAW) return prev;
                    const p = prev.players[active];
                    if (!p.deck.length) return prev;
                    const players = [...prev.players] as [Player, Player];
                    players[active] = { ...p, hand: [...p.hand, p.deck[0]], deck: p.deck.slice(1) };
                    return { ...prev, players };
                }), (i + 1) * 300);
            }
            later(nextPhase, Math.max(1700, count * 300 + 500));
        } else if (phase === Phase.STANDBY || phase === Phase.END) {
            animations.setPhaseFlash(phase);
            later(nextPhase, 1200);
        } else {
            animations.setPhaseFlash(phase);
        }
        return () => timers.forEach(clearTimeout);
    }, [gameState?.currentPhase, gameState?.activePlayerIndex, gameState?.turnNumber, gameState?.winner, nextPhase]);

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
            flyingCards: animations.flyingCards, voidAnimations: animations.voidAnimations,
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
                copiedSelection.forEach(idx => animations.triggerVisual(`${activeIndex}-pawn-${idx}`, `discard-${activeIndex}`, 'discard', gameState.players[activeIndex].pawnZones[idx]!.card));
                setGameState(prev => {
                    if (!prev) return null;
                    const players = JSON.parse(JSON.stringify(prev.players));
                    const p = players[activeIndex];
                    copiedSelection.forEach(idx => {
                        const tribute = p.pawnZones[idx];
                        if (tribute) { 
                            p.discard = [...p.discard, tribute.card]; 
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
            addLog,
        }
    };
};
