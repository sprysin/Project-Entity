import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, CardType, Phase, Position, PlacedCard } from '../types';
import { createDeck } from '../constants';
import { applyCardEffect, checkActivationConditions } from '../cardEffects';

export const useGameLogic = () => {
    // Core Game State
    const [gameState, setGameState] = useState<GameState | null>(null);

    // Selection States
    const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
    const [selectedFieldSlot, setSelectedFieldSlot] = useState<{ playerIndex: number, type: 'entity' | 'action', index: number } | null>(null);

    // Targeted Interaction States (Attack, Effect, Tribute)
    const [targetSelectMode, setTargetSelectMode] = useState<'attack' | 'tribute' | 'effect' | null>(null);
    const [targetSelectType, setTargetSelectType] = useState<'entity' | 'action' | 'any'>('entity');

    // Tribute Summon Specific States
    const [tributeSelection, setTributeSelection] = useState<number[]>([]);
    const [pendingTributeCard, setPendingTributeCard] = useState<Card | null>(null);
    const [tributeSummonMode, setTributeSummonMode] = useState<'normal' | 'hidden'>('normal');

    // Effect Resolution States
    const [triggeredEffect, setTriggeredEffect] = useState<Card | null>(null);
    const [pendingEffectCard, setPendingEffectCard] = useState<Card | null>(null);
    const [isPeekingField, setIsPeekingField] = useState(false);

    // Discard Selection State
    const [discardSelectionReq, setDiscardSelectionReq] = useState<{ playerIndex: number, filter: (c: Card) => boolean, title: string } | null>(null);
    const [selectedDiscardIndex, setSelectedDiscardIndex] = useState<number | null>(null);

    // Hand Selection State (New)
    const [handSelectionReq, setHandSelectionReq] = useState<{ playerIndex: number, title: string } | null>(null);
    const [selectedHandSelectionIndex, setSelectedHandSelectionIndex] = useState<number | null>(null);

    // UI / Animation States
    const [phaseFlash, setPhaseFlash] = useState<string | null>(null);
    const [turnFlash, setTurnFlash] = useState<string | null>(null);
    const [displayedLp, setDisplayedLp] = useState<[number, number]>([800, 800]);
    const [lpScale, setLpScale] = useState<[boolean, boolean]>([false, false]);
    const [lpFlash, setLpFlash] = useState<[string | null, string | null]>([null, null]);
    const [viewingDiscardIdx, setViewingDiscardIdx] = useState<number | null>(null);
    const [viewingVoidIdx, setViewingVoidIdx] = useState<number | null>(null);

    // Dynamic Animation Elements
    const [flyingCards, setFlyingCards] = useState<{ id: string, startX: number, startY: number, targetX: number, targetY: number, card?: Card }[]>([]);
    const [voidAnimations, setVoidAnimations] = useState<{ id: string, x: number, y: number }[]>([]);
    const [floatingTexts, setFloatingTexts] = useState<{ id: string, text: string, type: 'damage' | 'heal', x: number, y: number }[]>([]);
    const [shatterEffects, setShatterEffects] = useState<{ id: string, x: number, y: number, shards: { tx: string, ty: string, rot: string }[] }[]>([]);

    // Pile Flash State - Monitors when cards are added to Discard/Void
    const [discardFlash, setDiscardFlash] = useState<[boolean, boolean]>([false, false]);
    const [voidFlash, setVoidFlash] = useState<[boolean, boolean]>([false, false]);
    const prevDiscardLengths = useRef<[number, number]>([0, 0]);
    const prevVoidLengths = useRef<[number, number]>([0, 0]);

    // Layout State
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    // Refs for tracking animation targets and handling async logic
    const zoneRefs = useRef<Map<string, HTMLElement>>(new Map());
    const lastLp = useRef<[number, number]>([800, 800]);
    const isTransitioning = useRef(false);
    const processedAutoPhase = useRef<string>("");
    const drawIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /**
     * Registers a DOM element's position for animation targeting.
     */
    const setRef = (key: string) => (el: HTMLElement | null) => {
        if (el) zoneRefs.current.set(key, el);
        else zoneRefs.current.delete(key);
    };

    /**
     * Triggers visual animations for card movement.
     */
    const triggerVisual = (sourceKey: string, targetKey: string, type: 'discard' | 'void' | 'retrieve', cardData?: Card) => {
        const startEl = zoneRefs.current.get(sourceKey);
        // Fallback: If target slot doesn't exist (e.g. hand slot before render), target the container
        let endEl = zoneRefs.current.get(targetKey);
        if (!endEl && targetKey.includes('hand')) {
            const playerIndex = targetKey.split('-')[0];
            endEl = zoneRefs.current.get(`${playerIndex}-hand-container`);
        }

        if (!startEl) return;

        const sRect = startEl.getBoundingClientRect();
        const startX = (sRect.left + sRect.width / 2) / window.innerWidth * 100;
        const startY = (sRect.top + sRect.height / 2) / window.innerHeight * 100;

        const id = Math.random().toString();

        if (type === 'discard' || type === 'void' || type === 'retrieve') {
            if (!endEl) return;
            const eRect = endEl.getBoundingClientRect();
            const targetX = (eRect.left + eRect.width / 2) / window.innerWidth * 100;
            const targetY = (eRect.top + eRect.height / 2) / window.innerHeight * 100;

            setFlyingCards(prev => [...prev, { id, startX, startY, targetX, targetY, card: cardData }]);
            setTimeout(() => setFlyingCards(prev => prev.filter(c => c.id !== id)), 800);
        } else {
            setVoidAnimations(prev => [...prev, { id, x: startX, y: startY }]);
            setTimeout(() => setVoidAnimations(prev => prev.filter(c => c.id !== id)), 1500);
        }
    };

    /**
     * Triggers a glass shatter effect at the location of the specified zone.
     */
    const triggerShatter = (zoneKey: string) => {
        const el = zoneRefs.current.get(zoneKey);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth * 100;
        const y = (rect.top + rect.height / 2) / window.innerHeight * 100;

        const shards = Array.from({ length: 8 }).map(() => ({
            tx: (Math.random() - 0.5) * 200 + 'px',
            ty: (Math.random() - 0.5) * 200 + 'px',
            rot: Math.random() * 360 + 'deg'
        }));

        const id = Math.random().toString();
        setShatterEffects(prev => [...prev, { id, x, y, shards }]);
        setTimeout(() => setShatterEffects(prev => prev.filter(e => e.id !== id)), 1000);
    };

    /**
     * Initialization: Set up players, decks, and starting game state.
     */
    useEffect(() => {
        const p1Id = 'player1';
        const p2Id = 'player2';
        const p1Deck = createDeck(p1Id);
        const p2Deck = createDeck(p2Id);

        const initialPlayer = (id: string, name: string, deck: Card[]): Player => ({
            id,
            name,
            lp: 800,
            deck: deck.slice(5),
            hand: deck.slice(0, 5),
            discard: [],
            void: [],
            entityZones: Array(5).fill(null),
            actionZones: Array(5).fill(null),
            normalSummonUsed: false,
            hiddenSummonUsed: false,
        });

        lastLp.current = [800, 800];

        setGameState({
            players: [initialPlayer(p1Id, 'Player 1', p1Deck), initialPlayer(p2Id, 'Player 2', p2Deck)],
            activePlayerIndex: 0,
            currentPhase: Phase.DRAW,
            turnNumber: 1,
            log: ['Duel initialized.'],
            winner: null,
            pendingEffects: []
        });
    }, []);

    /**
     * Monitor pile changes to trigger the glow flash animations.
     */
    useEffect(() => {
        if (!gameState) return;
        gameState.players.forEach((p, idx) => {
            // Handle Discard pile glow trigger
            if (p.discard.length > prevDiscardLengths.current[idx]) {
                setDiscardFlash(prev => {
                    const next = [...prev] as [boolean, boolean];
                    next[idx] = true;
                    return next;
                });
                setTimeout(() => setDiscardFlash(prev => {
                    const next = [...prev] as [boolean, boolean];
                    next[idx] = false;
                    return next;
                }), 800);
            }
            prevDiscardLengths.current[idx] = p.discard.length;

            // Handle Void pile glow trigger
            if (p.void.length > prevVoidLengths.current[idx]) {
                setVoidFlash(prev => {
                    const next = [...prev] as [boolean, boolean];
                    next[idx] = true;
                    return next;
                });
                setTimeout(() => setVoidFlash(prev => {
                    const next = [...prev] as [boolean, boolean];
                    next[idx] = false;
                    return next;
                }), 800);
            }
            prevVoidLengths.current[idx] = p.void.length;
        });
    }, [gameState?.players]);

    /**
     * Handle Life Point (LP) animations and floating damage/heal text.
     */
    useEffect(() => {
        if (!gameState) return;

        gameState.players.forEach((player, idx) => {
            const oldLp = lastLp.current[idx];
            if (player.lp !== oldLp) {
                const diff = player.lp - oldLp;
                const id = Math.random().toString();
                setFloatingTexts(prev => [...prev, {
                    id,
                    text: diff > 0 ? `+${diff}` : `${diff}`,
                    type: diff > 0 ? 'heal' : 'damage',
                    x: 50,
                    y: 50
                }]);

                setTimeout(() => {
                    setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
                }, 2500);

                lastLp.current[idx] = player.lp;
            }
        });

        gameState.players.forEach((player, idx) => {
            if (player.lp !== displayedLp[idx]) {
                const diff = player.lp - displayedLp[idx];
                const type = diff > 0 ? 'heal' : 'damage';
                const newFlashes = [...lpFlash] as [string | null, string | null];
                newFlashes[idx] = type;
                setLpFlash(newFlashes);
                const newScales = [...lpScale] as [boolean, boolean];
                newScales[idx] = true;
                setLpScale(newScales);

                setTimeout(() => {
                    setLpFlash(prev => {
                        const f = [...prev] as [string | null, string | null];
                        f[idx] = null;
                        return f;
                    });
                    setLpScale(prev => {
                        const s = [...prev] as [boolean, boolean];
                        s[idx] = false;
                        return s;
                    });
                }, 800);

                const step = Math.ceil(Math.abs(diff) / 10);
                const timer = setInterval(() => {
                    setDisplayedLp(prev => {
                        const newLp = [...prev] as [number, number];
                        if (newLp[idx] < player.lp) {
                            const nextVal = newLp[idx] + step;
                            newLp[idx] = nextVal > player.lp ? player.lp : nextVal;
                        } else if (newLp[idx] > player.lp) {
                            const nextVal = newLp[idx] - step;
                            newLp[idx] = nextVal < player.lp ? player.lp : nextVal;
                        }
                        if (newLp[idx] === player.lp) clearInterval(timer);
                        return newLp;
                    });
                }, 20);
                return () => clearInterval(timer);
            }
        });
    }, [gameState?.players[0].lp, gameState?.players[1].lp, displayedLp, lpFlash]);

    /**
     * Helper to append messages to the system log.
     */
    const addLog = (msg: string) => {
        setGameState(prev => prev ? { ...prev, log: [msg, ...prev.log].slice(0, 50) } : null);
    };

    /**
     * Advances the game to the next phase. Handles turn wrapping and skipping Battle on Turn 1.
     */
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

            // Handle End Phase Effects
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
                            const effect = effectsToResolve.find(e => e.targetInstanceId === z.card.instanceId);
                            if (effect) {
                                return { ...z, card: { ...z.card, atk: effect.value } };
                            }
                            return z;
                        })
                    })) as [Player, Player];
                    currentPendingEffects = remainingEffects;
                }
            }

            return {
                ...prev,
                currentPhase: nextPhase,
                activePlayerIndex: activeIndex,
                turnNumber,
                players: updatedPlayers as [Player, Player],
                pendingEffects: currentPendingEffects
            };
        });
    }, []);

    /**
     * Automation Hook for Phase transitions (Draw/Standby logic).
     */
    useEffect(() => {
        if (!gameState || gameState.winner) return;
        const phaseKey = `${gameState.turnNumber}-${gameState.activePlayerIndex}-${gameState.currentPhase}`;
        if (processedAutoPhase.current === phaseKey) return;

        if (gameState.currentPhase === Phase.DRAW) {
            processedAutoPhase.current = phaseKey;
            isTransitioning.current = true;
            if (gameState.turnNumber > 0) {
                setTurnFlash("TURN CHANGE");
                setTimeout(() => setTurnFlash(null), 1500);
            }
            setTimeout(() => setPhaseFlash(Phase.DRAW), 1200);

            // Reset turn-based limits and attack flags
            setGameState(prev => {
                if (!prev) return null;
                const players = [...prev.players];
                const pIdx = prev.activePlayerIndex;
                const p = { ...players[pIdx] };
                p.normalSummonUsed = false;
                p.hiddenSummonUsed = false;
                p.entityZones = p.entityZones.map(z => z ? { ...z, hasAttacked: false, hasChangedPosition: false } : null);
                players[pIdx] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            // Animated Draw Mechanic
            let drawCount = 0;
            const targetHandSize = 5;
            const minDraw = 1;
            drawIntervalRef.current = setInterval(() => {
                setGameState(current => {
                    if (!current) return null;
                    const p = current.players[current.activePlayerIndex];
                    const shouldStop = (p.hand.length >= targetHandSize && drawCount >= minDraw) || p.deck.length === 0;
                    if (shouldStop) {
                        if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
                        setTimeout(() => {
                            isTransitioning.current = false;
                            nextPhase();
                        }, 500);
                        return current;
                    }
                    drawCount++;
                    const players = [...current.players];
                    const ply = { ...players[current.activePlayerIndex] };
                    const card = ply.deck[0];
                    ply.deck = ply.deck.slice(1);
                    ply.hand = [...ply.hand, card];
                    players[current.activePlayerIndex] = ply;
                    return { ...current, players: players as [Player, Player] };
                });
            }, 300);

        } else if (gameState.currentPhase === Phase.STANDBY) {
            processedAutoPhase.current = phaseKey;
            isTransitioning.current = true;
            setPhaseFlash(Phase.STANDBY);
            setTimeout(() => {
                isTransitioning.current = false;
                nextPhase();
            }, 1200);
        } else {
            setPhaseFlash(gameState.currentPhase);
        }
    }, [gameState?.currentPhase, gameState?.activePlayerIndex, gameState?.turnNumber, gameState?.winner, nextPhase]);

    /**
     * Helper to check if a card in hand is playable.
     */
    const canPlayCard = useCallback((card: Card) => {
        if (!gameState) return false;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return false;
        const activeIndex = gameState.activePlayerIndex;
        const player = gameState.players[activeIndex];

        if (card.type === CardType.ENTITY) {
            if (card.level <= 4) {
                return !player.normalSummonUsed || !player.hiddenSummonUsed;
            } else {
                const entityCount = player.entityZones.filter(z => z !== null).length;
                return entityCount >= (card.level <= 7 ? 1 : 2);
            }
        } else {
            return checkActivationConditions(gameState, card, activeIndex);
        }
    }, [gameState]);

    /**
     * Executes a card's unique ability. Handles targeting logic.
     */
    const resolveEffect = useCallback((card: Card, target?: { playerIndex: number, type: 'entity' | 'action', index: number }, discardIndex?: number, handIndex?: number) => {
        const activeIndex = gameState?.activePlayerIndex ?? 0;

        // DELAYED ANIMATION HANDLING for Void Caster (entity_04)
        if (card.id === 'entity_04') {
            const cardInDiscard = gameState?.players[activeIndex].discard.find(c => c.id === 'action_01');
            if (cardInDiscard) {
                // Close modal immediately so we can see animation
                setTriggeredEffect(null);
                setPendingEffectCard(null);
                setIsPeekingField(false);

                triggerVisual(`discard-${activeIndex}`, `${activeIndex}-hand-${gameState?.players[activeIndex].hand.length ?? 0}`, 'retrieve', cardInDiscard);

                // Wait for animation, then apply state change
                setTimeout(() => {
                    setGameState(prev => {
                        if (!prev) return null;
                        const { newState, log } = applyCardEffect(prev, card, target, discardIndex, handIndex);
                        return { ...newState, log: [log, ...newState.log].slice(0, 50) };
                    });
                }, 800); // 800ms Matches flight duration
                return; // Exit here, state update is handled in timeout
            }
        }

        if (card.id === 'condition_02' && target) {
            // Void Call visual
            if (gameState?.players[target.playerIndex].actionZones[target.index]) {
                const targetCard = gameState.players[target.playerIndex].actionZones[target.index]!.card;
                triggerVisual(`${target.playerIndex}-action-${target.index}`, `void-${target.playerIndex}`, 'void', targetCard);
            }
        }

        setGameState(prev => {
            if (!prev) return null;
            const { newState, log, requireTarget, requireDiscardSelection, requireHandSelection } = applyCardEffect(prev, card, target, discardIndex, handIndex);

            // If the effect requires a manual target on field
            if (requireTarget && !target) {
                setTriggeredEffect(null);
                setPendingEffectCard(card);
                setTargetSelectMode('effect');
                setTargetSelectType(requireTarget);
                setIsPeekingField(false);
                return prev; // Do not update state yet
            }

            // If the effect requires selection from discard
            if (requireDiscardSelection && discardIndex === undefined) {
                setPendingEffectCard(card);
                setDiscardSelectionReq(requireDiscardSelection);
                setSelectedDiscardIndex(null); // Reset selection
                return prev;
            }

            // If the effect requires selection from hand (e.g. Discard Cost)
            if (requireHandSelection && handIndex === undefined) {
                setPendingEffectCard(card);
                setHandSelectionReq(requireHandSelection);
                setSelectedHandSelectionIndex(null);
                return prev;
            }

            // If simple log or finished
            return { ...newState, log: [log, ...newState.log].slice(0, 50) };
        });

        // Cleanup Logic
        // If we provided a target or discard/hand selection, we are finishing a complex step.
        const isFinishingStep = target !== undefined || discardIndex !== undefined || handIndex !== undefined;

        // Check if the card itself initiates a complex mode (target/discard).
        // This list must match cards in cardEffects.ts that return requireTarget/requireDiscardSelection
        const initiatesComplex = ['entity_02', 'condition_01', 'condition_02', 'action_02', 'entity_05'].includes(card.id);

        if (isFinishingStep || !initiatesComplex) {
            // Cleanup if we just finished a step OR if it was a simple card that didn't need a step.
            setTriggeredEffect(null);
            setPendingEffectCard(null);
            setTargetSelectMode(null);
            setTargetSelectType('entity');
            setIsPeekingField(false);

            if (discardIndex !== undefined) {
                setDiscardSelectionReq(null);
                setSelectedDiscardIndex(null);
            }
            if (handIndex !== undefined) {
                setHandSelectionReq(null);
                setSelectedHandSelectionIndex(null);
            }
        }
    }, [gameState]);

    /**
     * Handles selection from the Discard Pile Modal.
     */
    const handleDiscardSelection = (index: number) => {
        if (!discardSelectionReq || !gameState || !pendingEffectCard) return;

        const pIdx = discardSelectionReq.playerIndex;
        const card = gameState.players[pIdx].discard[index];

        // Close modal immediately so animation is visible
        setDiscardSelectionReq(null);
        setSelectedDiscardIndex(null);

        // Trigger retrieval animation
        triggerVisual(`discard-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

        // Resolve effect with selection after a short delay to sync with animation arrival
        setTimeout(() => {
            resolveEffect(pendingEffectCard, undefined, index);
            setPendingEffectCard(null); // Clear pending after resolution
        }, 700);
    };

    /**
     * Handles selection from the Hand Selection Modal (e.g. for Discard costs).
     */
    const handleHandSelection = (index: number) => {
        if (!handSelectionReq || !gameState || !pendingEffectCard) return;

        const pIdx = handSelectionReq.playerIndex;
        const card = gameState.players[pIdx].hand[index];

        // Close modal
        setHandSelectionReq(null);
        setSelectedHandSelectionIndex(null);

        // Visual: Hand to Discard
        triggerVisual(`${pIdx}-hand-${index}`, `discard-${pIdx}`, 'discard', card);

        // Resolve effect immediately (no long delay needed for discard costs usually, but short delay helps visual sync)
        setTimeout(() => {
            resolveEffect(pendingEffectCard, undefined, undefined, index);
            setPendingEffectCard(null);
        }, 400);
    };

    /**
     * Core logic for Summoning or Setting an Entity. 
     */
    const handleSummon = (card: Card, mode: 'normal' | 'hidden' | 'tribute') => {
        if (!gameState || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;

        const pIdx = gameState.activePlayerIndex;
        const p = gameState.players[pIdx];

        // Check Tribute requirements for high-level cards
        if (card.level >= 5 && mode !== 'tribute') {
            const entityCount = p.entityZones.filter(z => z !== null).length;
            const required = card.level <= 7 ? 1 : 2;
            if (entityCount < required) {
                addLog(`ACCESS DENIED: Level ${card.level} requires ${required} sacrifices.`);
                return;
            }
            setPendingTributeCard(card);
            setTributeSummonMode(mode === 'hidden' ? 'hidden' : 'normal');
            setTributeSelection([]);
            setTargetSelectMode('tribute');
            addLog(`TRIBUTE MODE (${mode === 'hidden' ? 'SET' : 'SUMMON'}): Select ${required} entities for sacrifice.`);
            return;
        }

        // Per-turn limits for Level 4 or lower: 1 Normal AND 1 Set
        if (card.level <= 4) {
            if (mode === 'normal' && p.normalSummonUsed) {
                addLog("Normal Summon limit reached for this turn.");
                return;
            }
            if (mode === 'hidden' && p.hiddenSummonUsed) {
                addLog("Set limit reached for this turn.");
                return;
            }
        }

        const emptySlot = p.entityZones.findIndex(z => z === null);
        if (emptySlot === -1) {
            addLog("SECTOR FULL: No field space available.");
            return;
        }

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const ply = players[pIdx];
            ply.entityZones[emptySlot] = {
                card: { ...card },
                position: mode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                hasAttacked: false,
                hasChangedPosition: false,
                summonedTurn: prev.turnNumber,
                isSetTurn: mode === 'hidden'
            };
            ply.hand = ply.hand.filter(h => h.instanceId !== card.instanceId);

            if (card.level <= 4) {
                if (mode === 'normal') ply.normalSummonUsed = true;
                if (mode === 'hidden') ply.hiddenSummonUsed = true;
            }

            players[pIdx] = ply;
            return { ...prev, players: players as [Player, Player] };
        });

        if (mode !== 'hidden') {
            // Trigger effect prompts for High King (target required) and Void Caster (optional trigger)
            if (card.id === 'entity_02' || card.id === 'entity_04') setTriggeredEffect(card);
            else resolveEffect(card);
        }
        setSelectedHandIndex(null);
    };

    /**
     * Finalizes a tribute summon once the required sacrifices are selected.
     */
    const handleTributeSummon = () => {
        if (!gameState || !pendingTributeCard || isPeekingField) return;
        const activeIndex = gameState.activePlayerIndex;
        const required = pendingTributeCard.level <= 7 ? 1 : 2;
        if (tributeSelection.length !== required) return;

        tributeSelection.forEach(idx => {
            const sacrifice = gameState.players[activeIndex].entityZones[idx];
            if (sacrifice) {
                triggerVisual(`${activeIndex}-entity-${idx}`, `discard-${activeIndex}`, 'discard', sacrifice.card);
            }
        });

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const p = players[activeIndex];
            tributeSelection.forEach(idx => {
                const tribute = p.entityZones[idx];
                if (tribute) {
                    p.discard = [...p.discard, tribute.card];
                    p.entityZones[idx] = null;
                }
            });
            const emptySlot = p.entityZones.findIndex(z => z === null);
            if (emptySlot !== -1) {
                p.entityZones[emptySlot] = {
                    card: { ...pendingTributeCard },
                    position: tributeSummonMode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                    hasAttacked: false,
                    hasChangedPosition: false,
                    summonedTurn: prev.turnNumber,
                    isSetTurn: tributeSummonMode === 'hidden'
                };
                p.hand = p.hand.filter(h => h.instanceId !== pendingTributeCard.instanceId);
            }
            players[activeIndex] = p;
            return { ...prev, players: players as [Player, Player] };
        });

        if (tributeSummonMode !== 'hidden') {
            // Trigger effect prompts for High King and Void Caster
            if (pendingTributeCard.id === 'entity_02' || pendingTributeCard.id === 'entity_04') setTriggeredEffect(pendingTributeCard);
            else resolveEffect(pendingTributeCard);
        }

        setPendingTributeCard(null);
        setTributeSelection([]);
        setTargetSelectMode(null);
        setSelectedHandIndex(null);
    };

    /**
     * Handles playing Action or Condition cards from hand.
     */
    const handleActionFromHand = (card: Card, mode: 'activate' | 'set') => {
        if (!gameState || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;

        const activeIndex = gameState.activePlayerIndex;

        if (mode === 'set') {
            triggerVisual(`${activeIndex}-hand-${selectedHandIndex}`, `${activeIndex}-action-0`, 'discard', card); // Representative target
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[prev.activePlayerIndex];
                const slot = p.actionZones.findIndex(z => z === null);
                if (slot === -1) return prev;
                p.actionZones[slot] = { card: { ...card }, position: Position.HIDDEN, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: true };
                p.hand = p.hand.filter(h => h.instanceId !== card.instanceId);
                players[prev.activePlayerIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });
        } else {
            if (card.type === CardType.CONDITION) return;

            // OVERSIGHT FIX: Validate conditions before activating from hand (e.g. via direct field click)
            if (!checkActivationConditions(gameState, card, gameState.activePlayerIndex)) {
                addLog(`RESTRICTION: Activation conditions for ${card.name} not met.`);
                return;
            }

            if (selectedHandIndex !== null) {
                triggerVisual(`${gameState.activePlayerIndex}-hand-${selectedHandIndex}`, `discard-${gameState.activePlayerIndex}`, 'discard', card);
            }
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[prev.activePlayerIndex];
                p.hand = p.hand.filter(h => h.instanceId !== card.instanceId);
                p.discard = [...p.discard, { ...card }];
                players[prev.activePlayerIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });
            resolveEffect(card);
        }
        setSelectedHandIndex(null);
    };

    /**
     * Activates a card that is already on the field (Flipping or activating a Condition).
     */
    const activateOnField = (playerIndex: number, type: 'entity' | 'action', index: number) => {
        if (!gameState || isPeekingField) return;
        const p = gameState.players[playerIndex];
        const zone = type === 'entity' ? p.entityZones : p.actionZones;
        const placed = zone[index];
        if (!placed) return;

        // OVERSIGHT FIX: Validate conditions before field activation
        if (!checkActivationConditions(gameState, placed.card, playerIndex)) {
            addLog(`RESTRICTION: Activation conditions for ${placed.card.name} not met.`);
            return;
        }

        if (placed.card.type === CardType.CONDITION && gameState.turnNumber <= placed.summonedTurn) return;

        // Entities usually trigger their effects without changing state directly here (unless flipping)
        // Actions/Conditions flip to face-up
        if (placed.position === Position.HIDDEN) {
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const ply = players[playerIndex];
                const zn = type === 'entity' ? ply.entityZones : ply.actionZones;
                zn[index] = { ...zn[index]!, position: Position.ATTACK };
                players[playerIndex] = ply;
                return { ...prev, players: players as [Player, Player] };
            });
        }

        resolveEffect(placed.card);

        // Auto-discard logic for consumed Action/Condition cards (Entities stay on field)
        if (type !== 'entity') {
            setTimeout(() => {
                if (placed) triggerVisual(`${playerIndex}-${type}-${index}`, `discard-${playerIndex}`, 'discard', placed.card);
                setGameState(prev => {
                    if (!prev) return null;
                    const players = JSON.parse(JSON.stringify(prev.players));
                    const ply = players[playerIndex];
                    const zn = ply.actionZones;
                    if (zn[index]) {
                        ply.discard = [...ply.discard, { ...zn[index]!.card }];
                        zn[index] = null;
                    }
                    players[playerIndex] = ply;
                    return { ...prev, players: players as [Player, Player] };
                });
            }, 3000);
        }
        setSelectedFieldSlot(null);
    };

    /**
     * Combat resolution logic. Handles Attack vs Attack, Attack vs Defense, and Direct Attacks.
     */
    const handleAttack = (attackerIdx: number, targetIdx: number | 'direct') => {
        if (!gameState || gameState.turnNumber === 1 || isPeekingField) return;
        const activeIndex = gameState.activePlayerIndex;
        const oppIndex = (activeIndex + 1) % 2;
        const attacker = gameState.players[activeIndex].entityZones[attackerIdx];
        if (!attacker) return;

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const p = players[activeIndex];
            const opp = players[oppIndex];
            const atkEntity = { ...p.entityZones[attackerIdx]! };

            if (targetIdx === 'direct') {
                opp.lp -= atkEntity.card.atk;
                addLog(`DIRECT IMPACT: -${atkEntity.card.atk} LP.`);
            } else {
                let defEntity = { ...opp.entityZones[targetIdx]! };
                if (!defEntity) return prev;

                // Auto-flip hidden entities when attacked
                if (defEntity.position === Position.HIDDEN) {
                    defEntity.position = Position.DEFENSE;
                    opp.entityZones[targetIdx] = defEntity;
                    addLog(`${defEntity.card.name} was flipped!`);
                }

                if (defEntity.position === Position.ATTACK) {
                    const diff = atkEntity.card.atk - defEntity.card.atk;
                    if (diff > 0) {
                        triggerShatter(`${oppIndex}-entity-${targetIdx}`);
                        opp.lp -= diff;
                        triggerVisual(`${oppIndex}-entity-${targetIdx}`, `discard-${oppIndex}`, 'discard', defEntity.card);
                        opp.discard = [...opp.discard, defEntity.card];
                        opp.entityZones[targetIdx] = null;
                        addLog(`ATTACK SUCCESS: ${defEntity.card.name} destroyed. -${diff} LP.`);
                    } else if (diff < 0) {
                        triggerShatter(`${activeIndex}-entity-${attackerIdx}`);
                        p.lp += diff;
                        triggerVisual(`${activeIndex}-entity-${attackerIdx}`, `discard-${activeIndex}`, 'discard', atkEntity.card);
                        p.discard = [...p.discard, atkEntity.card];
                        p.entityZones[attackerIdx] = null;
                        addLog(`ATTACK FAILED: ${atkEntity.card.name} destroyed. Recoil ${diff}.`);
                    } else {
                        triggerShatter(`${activeIndex}-entity-${attackerIdx}`);
                        triggerShatter(`${oppIndex}-entity-${targetIdx}`);
                        triggerVisual(`${activeIndex}-entity-${attackerIdx}`, `discard-${activeIndex}`, 'discard', atkEntity.card);
                        triggerVisual(`${oppIndex}-entity-${targetIdx}`, `discard-${oppIndex}`, 'discard', defEntity.card);
                        p.discard = [...p.discard, atkEntity.card];
                        opp.discard = [...opp.discard, defEntity.card];
                        p.entityZones[attackerIdx] = null;
                        opp.entityZones[targetIdx] = null;
                        addLog("MUTUAL DESTRUCTION.");
                    }
                } else {
                    // Resolve against Defense points
                    if (atkEntity.card.atk > defEntity.card.def) {
                        triggerShatter(`${oppIndex}-entity-${targetIdx}`);
                        triggerVisual(`${oppIndex}-entity-${targetIdx}`, `discard-${oppIndex}`, 'discard', defEntity.card);
                        opp.discard = [...opp.discard, defEntity.card];
                        opp.entityZones[targetIdx] = null;
                        addLog(`DEFENSE CRUSHED: ${defEntity.card.name} destroyed. 0 Damage.`);
                    } else if (atkEntity.card.atk < defEntity.card.def) {
                        const recoil = defEntity.card.def - atkEntity.card.atk;
                        p.lp -= recoil;
                        addLog(`DEFENSE HELD: Recoil -${recoil} LP.`);
                    } else {
                        addLog("STALEMATE: Defense equals Attack.");
                    }
                }
            }
            if (p.entityZones[attackerIdx]) p.entityZones[attackerIdx]!.hasAttacked = true;
            players[activeIndex] = p;
            players[oppIndex] = opp;

            // Check Win/Loss conditions
            let winner = null;
            if (opp.lp <= 0) winner = p.name;
            else if (p.lp <= 0) winner = opp.name;
            return { ...prev, players: players as [Player, Player], winner };
        });
        setTargetSelectMode(null);
        setSelectedFieldSlot(null);
    };

    return {
        gameState,
        setGameState, // Exporting setGameState for direct manipulation if needed
        state: {
            selectedHandIndex,
            selectedFieldSlot,
            targetSelectMode,
            targetSelectType,
            tributeSelection,
            pendingTributeCard,
            tributeSummonMode,
            triggeredEffect,
            pendingEffectCard,
            isPeekingField,
            discardSelectionReq,
            selectedDiscardIndex,
            handSelectionReq,
            selectedHandSelectionIndex,
            phaseFlash,
            turnFlash,
            displayedLp,
            lpScale,
            lpFlash,
            viewingDiscardIdx,
            viewingVoidIdx,
            flyingCards,
            voidAnimations,
            floatingTexts,
            shatterEffects,
            discardFlash,
            voidFlash,
            isRightPanelOpen
        },
        actions: {
            setSelectedHandIndex,
            setSelectedFieldSlot,
            setTargetSelectMode,
            setTargetSelectType,
            setTributeSelection,
            setIsPeekingField,
            setDiscardSelectionReq,
            setSelectedDiscardIndex,
            setHandSelectionReq,
            setSelectedHandSelectionIndex,
            setTriggeredEffect,
            setPendingEffectCard,
            setViewingDiscardIdx,
            setViewingVoidIdx,
            setIsRightPanelOpen,
            setRef,
            nextPhase,
            canPlayCard,
            resolveEffect,
            handleDiscardSelection,
            handleHandSelection,
            handleSummon,
            handleTributeSummon,
            handleActionFromHand,
            activateOnField,
            handleAttack,
            addLog
        }
    };
};
