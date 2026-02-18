import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, CardType, Phase, Position, PlacedCard } from '../types';
import { createDeck } from '../constants';
import { applyCardEffect, checkActivationConditions } from '../cardEffects';

interface GameViewProps {
  onQuit: () => void;
}

/**
 * GameView Component
 * The core battle interface. Manages game state, turn logic, animations, and user interactions.
 */
const GameView: React.FC<GameViewProps> = ({ onQuit }) => {
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

  if (!gameState) return <div className="flex-1 flex items-center justify-center font-orbitron text-yellow-500 uppercase text-3xl">System Initialization...</div>;

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const oppIdx = (gameState.activePlayerIndex + 1) % 2;
  const opponent = gameState.players[oppIdx];
  const selectedCard = selectedHandIndex !== null ? activePlayer.hand[selectedHandIndex] : null;
  const isLightTheme = gameState.activePlayerIndex === 1;
  const actionsDisabled = triggeredEffect !== null || isPeekingField || discardSelectionReq !== null || handSelectionReq !== null;

  return (
    <div className={`flex-1 flex flex-col relative overflow-hidden font-roboto select-none transition-colors duration-1000 ${isLightTheme ? 'bg-slate-200 text-slate-900 retro-hash-light' : 'bg-[#050505] text-slate-100 retro-hash'}`}>
      {/* HUD: Exit Control */}
      <div className="absolute top-4 left-4 z-40">
        <button onClick={onQuit} className="px-4 py-2 bg-slate-900/80 border border-white/10 hover:bg-red-950/80 text-slate-400 font-orbitron font-bold backdrop-blur-md text-xs uppercase tracking-widest">
          <i className="fa-solid fa-power-off mr-2"></i> EXIT GAME
        </button>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Main Play Area */}
        <div className="flex-1 flex flex-col items-center justify-between p-4 relative overflow-hidden">
          {/* Opponent Hand (Semi-Visible) */}
          <div className="absolute top-0 w-full flex justify-center space-x-[-10px] z-20 pointer-events-none">
            {opponent.hand.map((_, i) => (
              <div key={i} className="w-28 aspect-[2/3] card-back rounded shadow-2xl border-2 border-slate-300 transform -translate-y-[60%] hover:translate-y-[-10%] transition-transform duration-300 cursor-pointer pointer-events-auto"></div>
            ))}
          </div>

          <div className="relative z-10 flex flex-col space-y-4 transform scale-100 transition-transform duration-500 items-center justify-center flex-1 w-full h-full mt-12 mb-20">
            {/* Opponent Field View */}
            <div className="flex flex-col items-center space-y-4 opacity-90">
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {opponent.actionZones.map((z, i) => (<Zone key={i} card={z} type="action" owner="opponent" domRef={setRef(`${oppIdx}-action-${i}`)} isSelected={selectedFieldSlot?.playerIndex === oppIdx && selectedFieldSlot?.type === 'action' && selectedFieldSlot?.index === i} isSelectable={targetSelectMode === 'effect' && (targetSelectType === 'any' || targetSelectType === 'action') && pendingEffectCard !== null} onClick={() => {
                    if (targetSelectMode === 'effect' && pendingEffectCard) resolveEffect(pendingEffectCard, { playerIndex: oppIdx, type: 'action', index: i });
                    else setSelectedFieldSlot({ playerIndex: oppIdx, type: 'action', index: i })
                  }} />))}
                </div>
                <DeckPile count={opponent.deck.length} label="Deck" />
              </div>
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {opponent.entityZones.map((z, i) => (<Zone key={i} card={z} type="entity" owner="opponent" domRef={setRef(`${oppIdx}-entity-${i}`)} isSelected={selectedFieldSlot?.playerIndex === oppIdx && selectedFieldSlot?.type === 'entity' && selectedFieldSlot?.index === i} isSelectable={targetSelectMode === 'attack' || (targetSelectMode === 'effect' && (targetSelectType === 'any' || targetSelectType === 'entity') && pendingEffectCard !== null)} onClick={() => {
                    if (targetSelectMode === 'attack' && selectedFieldSlot) {
                      const hasMonsters = opponent.entityZones.some(mz => mz !== null);
                      if (hasMonsters) {
                        if (opponent.entityZones[i]) handleAttack(selectedFieldSlot.index, i);
                      } else {
                        handleAttack(selectedFieldSlot.index, 'direct');
                      }
                    }
                    else if (targetSelectMode === 'effect' && pendingEffectCard) {
                      if (opponent.entityZones[i]) resolveEffect(pendingEffectCard, { playerIndex: oppIdx, type: 'entity', index: i });
                    }
                    else setSelectedFieldSlot({ playerIndex: oppIdx, type: 'entity', index: i });
                  }} />))}
                </div>
                <div className="flex space-x-6">
                  <Pile count={opponent.discard.length} label="Discard" color="slate" icon="fa-skull" domRef={setRef(`discard-${oppIdx}`)} isFlashing={discardFlash[oppIdx]} onClick={() => setViewingDiscardIdx(oppIdx)} />
                  <Pile count={opponent.void.length} label="Void" color="purple" icon="fa-hurricane" domRef={setRef(`void-${oppIdx}`)} isFlashing={voidFlash[oppIdx]} onClick={() => setViewingVoidIdx(oppIdx)} />
                </div>
              </div>
            </div>

            {/* Central Information Bar: LP and Player Names */}
            <div className="w-full max-w-4xl h-8 bg-black/60 border-y border-white/10 backdrop-blur-md flex items-center justify-between px-16 my-2 relative z-0">
              <div className="flex items-center space-x-4">
                <span className="text-[10px] font-orbitron font-bold text-slate-400 uppercase tracking-widest">{opponent.name}</span>
                <span className={`text-xl font-orbitron font-black transition-colors duration-300 ${lpFlash[oppIdx] === 'damage' ? 'text-red-500' : lpFlash[oppIdx] === 'heal' ? 'text-green-500' : 'text-white'}`}>
                  {Math.floor(displayedLp[oppIdx])} LP
                </span>
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-8"></div>
              <div className="flex items-center space-x-4">
                <span className={`text-xl font-orbitron font-black transition-colors duration-300 ${lpFlash[gameState.activePlayerIndex] === 'damage' ? 'text-red-500' : lpFlash[gameState.activePlayerIndex] === 'heal' ? 'text-green-500' : 'text-white'}`}>
                  {Math.floor(displayedLp[gameState.activePlayerIndex])} LP
                </span>
                <span className="text-[10px] font-orbitron font-bold text-slate-400 uppercase tracking-widest">{activePlayer.name}</span>
              </div>
            </div>

            {/* Active Player Field View */}
            <div className="flex flex-col items-center space-y-4">
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {activePlayer.entityZones.map((z, i) => (<Zone key={i} card={z} type="entity" owner="active" domRef={setRef(`${gameState.activePlayerIndex}-entity-${i}`)} isSelected={selectedFieldSlot?.playerIndex === gameState.activePlayerIndex && selectedFieldSlot?.type === 'entity' && selectedFieldSlot?.index === i} isTributeSelected={tributeSelection.includes(i)} isSelectable={targetSelectMode === 'effect' && (targetSelectType === 'any' || targetSelectType === 'entity') && pendingEffectCard !== null} isDropTarget={selectedCard?.type === CardType.ENTITY && z === null} onClick={() => {
                    if (targetSelectMode === 'tribute') { if (z) setTributeSelection(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]); }
                    else if (targetSelectMode === 'effect' && pendingEffectCard) {
                      if (activePlayer.entityZones[i]) resolveEffect(pendingEffectCard, { playerIndex: gameState.activePlayerIndex, type: 'entity', index: i });
                    }
                    else if (selectedCard?.type === CardType.ENTITY && z === null) handleSummon(selectedCard, 'normal');
                    else { setSelectedFieldSlot(z ? { playerIndex: gameState.activePlayerIndex, type: 'entity', index: i } : null); setSelectedHandIndex(null); }
                  }} />))}
                </div>
                <div className="flex space-x-6">
                  <Pile count={activePlayer.discard.length} label="Discard" color="slate" icon="fa-skull" domRef={setRef(`discard-${gameState.activePlayerIndex}`)} isFlashing={discardFlash[gameState.activePlayerIndex]} onClick={() => setViewingDiscardIdx(gameState.activePlayerIndex)} />
                  <Pile count={activePlayer.void.length} label="Void" color="purple" icon="fa-hurricane" domRef={setRef(`void-${gameState.activePlayerIndex}`)} isFlashing={voidFlash[gameState.activePlayerIndex]} onClick={() => setViewingVoidIdx(gameState.activePlayerIndex)} />
                </div>
              </div>
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {activePlayer.actionZones.map((z, i) => (<Zone key={i} card={z} type="action" owner="active" domRef={setRef(`${gameState.activePlayerIndex}-action-${i}`)} isSelected={selectedFieldSlot?.playerIndex === gameState.activePlayerIndex && selectedFieldSlot?.type === 'action' && selectedFieldSlot?.index === i} isDropTarget={(selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null} onClick={() => {
                    if ((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null) handleActionFromHand(selectedCard, selectedCard.type === CardType.CONDITION ? 'set' : 'activate');
                    else { setSelectedFieldSlot(z ? { playerIndex: gameState.activePlayerIndex, type: 'action', index: i } : null); setSelectedHandIndex(null); }
                  }} />))}
                </div>
                <DeckPile count={activePlayer.deck.length} label="Deck" />
              </div>
            </div>
          </div>

          {/* Active Player Hand Display (Bottom) */}
          <div className="absolute bottom-0 w-full flex justify-center space-x-[-10px] z-50 pointer-events-none pb-0" ref={setRef(`${gameState.activePlayerIndex}-hand-container`)}>
            {activePlayer.hand.map((card, i) => {
              const isActivatable = canPlayCard(card);
              return (
                <div key={card.instanceId}
                  ref={setRef(`${gameState.activePlayerIndex}-hand-${i}`)}
                  onClick={() => { setSelectedHandIndex(i); setSelectedFieldSlot(null); }}
                  className={`w-36 aspect-[2/3] rounded transition-all duration-300 cursor-pointer relative overflow-hidden border-2 border-slate-300 shadow-2xl pointer-events-auto 
                     ${selectedHandIndex === i ? 'transform translate-y-[-20%] z-20 ring-4 ring-yellow-500' : 'transform translate-y-[30%] hover:translate-y-[0%] z-10 hover:z-20'}
                     ${card.type === CardType.ENTITY ? 'card-entity' : card.type === CardType.ACTION ? 'card-action' : card.type === CardType.CONDITION ? 'card-condition' : ''}
                     ${isActivatable ? 'glow-activatable' : (card.type === CardType.ENTITY ? 'glow-gold' : card.type === CardType.ACTION ? 'glow-green' : 'glow-pink')}
                   `}
                >
                  <div className="card-inner-border"></div>
                  <div className="p-2 flex flex-col h-full text-white relative z-10 text-[9px]">
                    <div className="font-orbitron font-bold uppercase tracking-tight py-1 mb-1 border-b border-white/10 text-center truncate">{card.name}</div>
                    <div className="flex-1 opacity-80 font-bold leading-tight font-mono p-1 bg-black/20 rounded-sm">{card.effectText}</div>
                    {card.type === CardType.ENTITY && (<div className="flex justify-between font-orbitron font-black mt-auto text-[10px] pt-1 border-t border-white/10"><span className="text-yellow-500">A:{card.atk}</span><span className="text-blue-400">D:{card.def}</span></div>)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Render Active Animations (Flying Cards, Vortices, Floating Texts, Shatters) */}
          {flyingCards.map(fc => (
            <div
              key={fc.id}
              className={`fixed w-16 h-24 ${fc.card ? 'border-2' : 'bg-slate-200 border-2 border-yellow-500'} flying-card z-[150] shadow-[0_0_20px_rgba(234,179,8,0.8)]`}
              style={{
                left: `${fc.startX}%`,
                top: `${fc.startY}%`,
                '--tx': `${fc.targetX - fc.startX}vw`,
                '--ty': `${fc.targetY - fc.startY}vh`,
                background: fc.card ? 'transparent' : undefined
              } as React.CSSProperties}
            >
              {fc.card && (
                <div className="w-full h-full relative overflow-hidden rounded bg-black">
                  {/* Mini Card Representation */}
                  <div className={`absolute inset-0 border-2 ${fc.card.type === CardType.ENTITY ? 'border-yellow-500 bg-yellow-900/50' : fc.card.type === CardType.ACTION ? 'border-green-500 bg-green-900/50' : 'border-pink-500 bg-pink-900/50'}`}></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-[6px] font-orbitron text-white text-center font-bold p-1 leading-tight">{fc.card.name}</div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {voidAnimations.map(v => (
            <div key={v.id} className="vortex" style={{ left: `${v.x}%`, top: `${v.y}%` }}></div>
          ))}

          {shatterEffects.map(se => (
            <div key={se.id} className="shatter-container" style={{ left: `${se.x}%`, top: `${se.y}%` }}>
              {se.shards.map((s, idx) => (
                <div key={idx} className="shard" style={{ '--tx': s.tx, '--ty': s.ty, '--rot': s.rot } as React.CSSProperties}></div>
              ))}
            </div>
          ))}

          {floatingTexts.map(ft => (
            <div
              key={ft.id}
              className={`floating-text text-6xl ${ft.type === 'damage' ? 'text-red-600' : 'text-green-500'}`}
              style={{ left: `${ft.x}%`, top: `${ft.y}%` }}
            >
              {ft.text}
            </div>
          ))}

          {/* Victory / Defeat Modal */}
          {gameState.winner && (
            <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center animate-in fade-in zoom-in text-white">
              <h2 className="text-7xl font-orbitron font-black text-yellow-500 mb-2 uppercase tracking-tighter drop-shadow-[0_0_50px_rgba(234,179,8,0.5)]">Battle Concluded</h2>
              <div className="h-1 w-96 bg-yellow-600/50 mb-12"></div>
              <p className="text-4xl font-orbitron font-bold text-white mb-16 uppercase tracking-widest">{gameState.winner} is Victorious</p>
              <button
                onClick={onQuit}
                className="px-16 py-6 bg-yellow-600 hover:bg-yellow-500 text-white font-orbitron font-black text-xl border-b-8 border-yellow-800 active:translate-y-2 active:border-b-0 transition-all uppercase tracking-[0.2em]"
              >
                Return to Hub
              </button>
            </div>
          )}

          {/* Hand Selection Modal (For Discard Costs) */}
          {handSelectionReq && (
            <div className="fixed inset-0 bg-black/80 z-[120] flex flex-col items-center justify-center p-8 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border-2 border-red-600 rounded-lg p-8 w-full max-w-5xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                  <h2 className="text-2xl font-orbitron font-black text-red-500 uppercase tracking-widest">{handSelectionReq.title}</h2>
                  <button onClick={() => setHandSelectionReq(null)} className="px-6 py-2 bg-red-900/40 hover:bg-red-800 text-white font-orbitron text-xs border border-red-500/50 uppercase font-bold tracking-widest">CANCEL</button>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2 scrollbar-hide mb-6">
                  {gameState.players[handSelectionReq.playerIndex].hand
                    .map((card, idx) => ({ card, idx }))
                    .map(({ card, idx }) => (
                      <div key={idx} onClick={() => setSelectedHandSelectionIndex(idx)} className={`relative transition-all duration-300 cursor-pointer hover:scale-105 ${selectedHandSelectionIndex === idx ? 'ring-4 ring-red-500 scale-105 z-10' : ''}`}>
                        <CardDetail card={card} />
                        {selectedHandSelectionIndex !== idx && <div className="absolute inset-0 bg-red-500/10 hover:bg-red-500/0 transition-colors"></div>}
                        {selectedHandSelectionIndex === idx && <div className="absolute inset-0 bg-red-500/20 pointer-events-none"></div>}
                      </div>
                    ))
                  }
                  {gameState.players[handSelectionReq.playerIndex].hand.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 font-orbitron uppercase tracking-widest">No Cards in Hand</div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <button
                    onClick={() => selectedHandSelectionIndex !== null && handleHandSelection(selectedHandSelectionIndex)}
                    disabled={selectedHandSelectionIndex === null}
                    className={`px-12 py-4 font-orbitron font-black text-xl uppercase tracking-widest transition-all ${selectedHandSelectionIndex !== null ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                  >
                    CONFIRM DISCARD
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Discard Selection Modal */}
          {discardSelectionReq && (
            <div className="fixed inset-0 bg-black/80 z-[120] flex flex-col items-center justify-center p-8 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border-2 border-yellow-600 rounded-lg p-8 w-full max-w-5xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                  <h2 className="text-2xl font-orbitron font-black text-yellow-500 uppercase tracking-widest">{discardSelectionReq.title}</h2>
                  <button onClick={() => setDiscardSelectionReq(null)} className="px-6 py-2 bg-red-900/40 hover:bg-red-800 text-white font-orbitron text-xs border border-red-500/50 uppercase font-bold tracking-widest">CANCEL</button>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2 scrollbar-hide mb-6">
                  {gameState.players[discardSelectionReq.playerIndex].discard
                    .map((card, idx) => ({ card, idx, valid: discardSelectionReq.filter(card) }))
                    .sort((a, b) => (b.valid ? 1 : 0) - (a.valid ? 1 : 0)) // Sort valid first
                    .map(({ card, idx, valid }) => (
                      <div key={idx} onClick={() => valid && setSelectedDiscardIndex(idx)} className={`relative transition-all duration-300 ${valid ? 'cursor-pointer hover:scale-105' : 'opacity-40 grayscale pointer-events-none'} ${selectedDiscardIndex === idx ? 'ring-4 ring-green-500 scale-105 z-10' : ''}`}>
                        <CardDetail card={card} />
                        {valid && selectedDiscardIndex !== idx && <div className="absolute inset-0 bg-yellow-500/10 hover:bg-yellow-500/0 transition-colors"></div>}
                        {selectedDiscardIndex === idx && <div className="absolute inset-0 bg-green-500/20 pointer-events-none"></div>}
                      </div>
                    ))
                  }
                  {gameState.players[discardSelectionReq.playerIndex].discard.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 font-orbitron uppercase tracking-widest">No Cards in Discard Pile</div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <button
                    onClick={() => selectedDiscardIndex !== null && handleDiscardSelection(selectedDiscardIndex)}
                    disabled={selectedDiscardIndex === null}
                    className={`px-12 py-4 font-orbitron font-black text-xl uppercase tracking-widest transition-all ${selectedDiscardIndex !== null ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                  >
                    CONFIRM SELECTION
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Effect Activation Confirmation Modal */}
          {triggeredEffect && !discardSelectionReq && !handSelectionReq && (
            <div className={`fixed inset-0 z-[70] flex flex-col items-center justify-center transition-opacity duration-300 ${isPeekingField ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="bg-slate-900 border-2 border-yellow-600 p-6 flex flex-col items-center space-y-4 shadow-[0_0_40px_rgba(234,179,8,0.5)]">
                <h3 className="text-2xl font-orbitron font-black text-yellow-500 uppercase tracking-tighter">{triggeredEffect.name}</h3>
                <p className="text-white/90 font-mono text-center max-w-sm font-bold text-sm">{triggeredEffect.effectText}</p>
                <div className="flex flex-col w-full space-y-3">
                  <button onClick={() => resolveEffect(triggeredEffect)} disabled={!checkActivationConditions(gameState, triggeredEffect, gameState.activePlayerIndex)} className={`px-8 py-3 text-white font-orbitron font-black uppercase tracking-widest border-b-4 ${!checkActivationConditions(gameState, triggeredEffect, gameState.activePlayerIndex) ? 'bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800'}`}>ACTIVATE ABILITY</button>
                  <div className="flex space-x-3 w-full">
                    <button onClick={() => setIsPeekingField(true)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron text-[10px] font-bold uppercase tracking-widest border border-white/10">Peek Field</button>
                    <button onClick={() => { setTriggeredEffect(null); setPendingEffectCard(null); setIsPeekingField(false); }} className="flex-1 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 font-orbitron text-[10px] font-bold uppercase tracking-widest border border-red-500/30">Decline</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isPeekingField && (
            <button onClick={() => setIsPeekingField(false)} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] px-10 py-5 bg-yellow-600 text-white font-orbitron font-black shadow-2xl border-4 border-yellow-400 uppercase tracking-widest animate-pulse">Return to Activation</button>
          )}

          {/* Phase and Turn Overlay Flashes */}
          {phaseFlash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60] overflow-hidden">
              <div key={gameState.turnNumber + gameState.currentPhase} className="phase-slide bg-black/80 backdrop-blur-sm border-y border-yellow-500/30 w-full py-3 flex items-center justify-center">
                <div className="text-2xl md:text-4xl font-orbitron font-bold text-white text-center tracking-[0.8em] uppercase pl-[0.8em]">{phaseFlash}</div>
              </div>
            </div>
          )}

          {turnFlash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[65] overflow-hidden">
              <div key={turnFlash} className="turn-slide bg-yellow-600/90 backdrop-blur-md w-full py-12 flex items-center justify-center border-y-8 border-yellow-400">
                <div className="text-6xl md:text-8xl font-orbitron font-black text-white text-center tracking-[0.1em] uppercase drop-shadow-xl">{turnFlash}</div>
              </div>
            </div>
          )}

          {/* On-Field Interaction Controls (Phase Advance, Target Selection Prompts) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end z-30 space-y-2">
            <div className="bg-black/80 border border-white/10 px-4 py-2 rounded-sm backdrop-blur-md shadow-lg text-right">
              <div className="flex items-center justify-end space-x-2">
                <span className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest">TURN</span>
                <span className="text-xl font-orbitron font-bold text-white leading-none">{gameState.turnNumber}</span>
              </div>
              <div className="text-[10px] font-orbitron font-bold text-yellow-500 uppercase tracking-widest mt-1">
                {activePlayer.name}'s TURN
              </div>
            </div>
            <button disabled={targetSelectMode !== null || isPeekingField || discardSelectionReq !== null || handSelectionReq !== null} onClick={nextPhase} className={`px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-orbitron font-bold shadow-lg uppercase flex flex-col items-center justify-center overflow-hidden ${targetSelectMode !== null || isPeekingField || discardSelectionReq !== null || handSelectionReq !== null ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
              <span className="text-xl tracking-tighter whitespace-nowrap leading-none">NEXT PHASE</span>
              <span className="text-[10px] opacity-90 tracking-widest font-bold font-orbitron italic">({gameState.currentPhase})</span>
            </button>
            {targetSelectMode === 'effect' && (<div className="px-4 py-2 bg-red-900 border-2 border-red-500 text-white font-orbitron font-black animate-pulse text-[10px] text-center shadow-lg uppercase tracking-widest">{pendingEffectCard?.name}: SELECT TARGET</div>)}
            {targetSelectMode === 'tribute' && (<button onClick={handleTributeSummon} className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-orbitron font-black shadow-lg animate-pulse uppercase text-lg transition-all active:translate-x-1">SACRIFICE [{tributeSelection.length}/{pendingTributeCard ? (pendingTributeCard.level <= 7 ? 1 : 2) : 0}]</button>)}
          </div>
        </div>

        {/* Sidebar Panel: Includes Card Details and Integrated System Log */}
        <div className={`transition-all duration-300 ease-in-out border-l border-white/10 bg-black/80 backdrop-blur-2xl z-40 flex flex-col relative ${isRightPanelOpen ? 'w-80' : 'w-10'}`}>
          {/* Panel Toggle Tab */}
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="absolute top-1/2 -left-3 w-6 h-12 bg-yellow-600 rounded-l-md flex items-center justify-center text-black border-l border-y border-yellow-400 hover:bg-yellow-500 transition-colors z-50 shadow-lg"
          >
            <i className={`fa-solid ${isRightPanelOpen ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>

          <div className="flex-1 overflow-hidden flex flex-col relative">
            {isRightPanelOpen ? (
              <div className="flex-1 flex flex-col overflow-hidden h-full">
                {/* Dynamic Context Panel: Shows details for selected cards or hand cards */}
                <div className="flex-none p-6 pb-2">
                  {selectedFieldSlot && gameState.players[selectedFieldSlot.playerIndex][selectedFieldSlot.type === 'entity' ? 'entityZones' : 'actionZones'][selectedFieldSlot.index] ? (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <CardDetail card={gameState.players[selectedFieldSlot.playerIndex][selectedFieldSlot.type === 'entity' ? 'entityZones' : 'actionZones'][selectedFieldSlot.index]!.card} isSet={gameState.players[selectedFieldSlot.playerIndex][selectedFieldSlot.type === 'entity' ? 'entityZones' : 'actionZones'][selectedFieldSlot.index]!.position === Position.HIDDEN && selectedFieldSlot.playerIndex !== gameState.activePlayerIndex} />
                      <div className="flex flex-col space-y-3">
                        {/* Contextual Actions for On-Field Cards */}
                        {selectedFieldSlot.playerIndex === gameState.activePlayerIndex && (
                          <>
                            {selectedFieldSlot.type === 'entity' && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && (
                              <>
                                <button disabled={actionsDisabled || gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]?.summonedTurn === gameState.turnNumber} onClick={() => {
                                  setGameState(prev => {
                                    if (!prev) return null;
                                    const p = { ...prev.players[prev.activePlayerIndex] };
                                    const z = p.entityZones[selectedFieldSlot.index];
                                    if (!z || z.hasChangedPosition || z.summonedTurn === prev.turnNumber) return prev;
                                    z.position = z.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
                                    z.hasChangedPosition = true;
                                    const players = [...prev.players];
                                    players[prev.activePlayerIndex] = p;
                                    return { ...prev, players: players as [Player, Player] };
                                  });
                                  setSelectedFieldSlot(null);
                                }} className={`w-full py-4 border border-white/20 font-orbitron text-xs uppercase font-bold transition-all ${(actionsDisabled || gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]?.summonedTurn === gameState.turnNumber) ? 'opacity-30 bg-slate-900 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700'}`}>
                                  {gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]?.position === Position.HIDDEN ? 'FLIP SUMMON' : 'CHANGE POSITION'}
                                </button>

                                {/* ACTIVATE ENTITY EFFECT BUTTON (For entities with On Field effects like Dragon) */}
                                {gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]?.position === Position.ATTACK &&
                                  ['entity_05'].includes(gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]!.card.id) && (
                                    <button
                                      disabled={actionsDisabled || !checkActivationConditions(gameState, gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]!.card, selectedFieldSlot.playerIndex)}
                                      onClick={() => activateOnField(selectedFieldSlot.playerIndex, selectedFieldSlot.type, selectedFieldSlot.index)}
                                      className={`w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-orbitron text-xs font-black tracking-widest uppercase mt-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] ${(actionsDisabled || !checkActivationConditions(gameState, gameState.players[selectedFieldSlot.playerIndex].entityZones[selectedFieldSlot.index]!.card, selectedFieldSlot.playerIndex)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      ACTIVATE EFFECT
                                    </button>
                                  )}
                              </>
                            )}
                            {/* Activation triggers for Action/Condition slots */}
                            {selectedFieldSlot.type === 'action' &&
                              (gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.position === Position.HIDDEN || gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.card.type === CardType.CONDITION) && (
                                <button disabled={actionsDisabled || !checkActivationConditions(gameState, gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.card, selectedFieldSlot.playerIndex)} onClick={() => activateOnField(selectedFieldSlot.playerIndex, 'action', selectedFieldSlot.index)} className={`w-full py-4 bg-green-600 hover:bg-green-700 text-white font-orbitron text-xs font-black tracking-widest uppercase ${actionsDisabled || !checkActivationConditions(gameState, gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.card, selectedFieldSlot.playerIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  ACTIVATE {gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.card.type}
                                </button>
                              )}
                            {/* Battle triggers */}
                            {selectedFieldSlot.type === 'entity' && gameState.currentPhase === Phase.BATTLE && !activePlayer.entityZones[selectedFieldSlot.index]?.hasAttacked && activePlayer.entityZones[selectedFieldSlot.index]?.position === Position.ATTACK && (
                              <button disabled={actionsDisabled} onClick={() => { if (gameState.turnNumber === 1) addLog("INTERCEPT: Combat blocked cycle 1."); else setTargetSelectMode('attack'); }} className={`w-full py-4 border-2 font-orbitron text-xs font-black uppercase transition-all ${actionsDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${gameState.turnNumber === 1 ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-red-900/40 hover:bg-red-800 text-red-200 border-red-500'}`}>ENGAGE TARGET</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : selectedCard ? (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <CardDetail card={selectedCard} />
                      <div className="flex flex-col space-y-3">
                        {/* Contextual Actions for Hand Cards (Summon/Set/Execute) */}
                        {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && (
                          <>
                            {selectedCard.type === CardType.ENTITY ? (
                              <>
                                <button disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed)} onClick={() => handleSummon(selectedCard, 'normal')} className={`w-full py-4 text-white font-orbitron text-xs font-black tracking-widest border-b-4 uppercase transition-all ${(actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed)) ? 'bg-slate-800 border-slate-900 opacity-50 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800'}`}>
                                  {(selectedCard.level <= 4 && activePlayer.normalSummonUsed) ? 'NORMAL LIMIT REACHED' : (selectedCard.level >= 5 ? 'TRIBUTE SUMMON' : 'NORMAL SUMMON')}
                                </button>
                                <button disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed)} onClick={() => handleSummon(selectedCard, 'hidden')} className={`w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/20 font-orbitron text-xs uppercase font-bold text-slate-300 transition-all ${(actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed)) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  {(selectedCard.level <= 4 && activePlayer.hiddenSummonUsed) ? 'SET LIMIT REACHED' : 'SET HIDDEN'}
                                </button>
                              </>
                            ) : (
                              <>
                                {selectedCard.type !== CardType.CONDITION && (
                                  <button disabled={actionsDisabled || !checkActivationConditions(gameState, selectedCard, gameState.activePlayerIndex)} onClick={() => handleActionFromHand(selectedCard, 'activate')} className={`w-full py-4 bg-green-600 hover:bg-green-700 text-white font-orbitron text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(74,222,128,0.2)] ${actionsDisabled || !checkActivationConditions(gameState, selectedCard, gameState.activePlayerIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}>ACTIVATE ACTION</button>
                                )}
                                <button disabled={actionsDisabled} onClick={() => handleActionFromHand(selectedCard, 'set')} className={`w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/20 font-orbitron text-xs uppercase font-bold text-slate-300 ${actionsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>SET CARD</button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Empty State for Detail Panel */
                    <div className="h-64 flex flex-col items-center justify-center opacity-30 space-y-6 grayscale">
                      <div className="w-24 h-24 border-2 border-white/10 rounded-full flex items-center justify-center"><i className="fa-solid fa-crosshairs text-4xl text-slate-600"></i></div>
                      <span className="text-[10px] font-orbitron tracking-widest text-center uppercase font-bold text-slate-500 tracking-[0.2em]">Select Card to View...</span>
                    </div>
                  )}
                </div>

                {/* Integrated Scrollable Log: Tracks all game actions chronologically */}
                <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden mt-4">
                  <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                    <span className="font-orbitron text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-code-branch"></i> SYSTEM LOG
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 pr-2 scrollbar-thin scrollbar-thumb-yellow-600 scrollbar-track-transparent">
                    {gameState.log.map((l, i) => (
                      <div key={i} className={`pl-2 border-l-2 py-1 transition-all duration-300 ${i === 0 ? 'border-yellow-500 text-white bg-white/5 animate-pulse' : 'border-slate-800 text-slate-500'}`}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Minimalist Collapsed Sidebar View */
              <div className="flex-1 flex flex-col items-center justify-center pt-4 space-y-8 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsRightPanelOpen(true)}>
                <div className="rotate-90 whitespace-nowrap text-slate-500 font-orbitron font-bold tracking-widest text-[10px] uppercase opacity-60">
                  System Data
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Modals for viewing pile contents (Discard/Void) */}
      {viewingDiscardIdx !== null && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex flex-col p-12 backdrop-blur-md animate-in fade-in text-white">
          <div className="flex justify-between items-center mb-8 border-b border-white/20 pb-4">
            <h2 className="text-4xl font-orbitron font-black text-yellow-500 tracking-[0.2em] uppercase">
              {gameState.players[viewingDiscardIdx].name} Discard Pile
            </h2>
            <button onClick={() => setViewingDiscardIdx(null)} className="px-10 py-4 bg-red-900/40 hover:bg-red-800 text-white font-orbitron text-md border border-red-500/50 uppercase font-bold tracking-widest transition-all">CLOSE VIEW</button>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-4 scrollbar-hide">
            {gameState.players[viewingDiscardIdx].discard.map((card, i) => (
              <CardDetail key={i} card={card} />
            ))}
          </div>
        </div>
      )}

      {viewingVoidIdx !== null && (
        <div className="fixed inset-0 bg-purple-900/50 z-[110] flex flex-col p-12 backdrop-blur-md animate-in fade-in text-white">
          <div className="flex justify-between items-center mb-8 border-b border-white/20 pb-4">
            <h2 className="text-4xl font-orbitron font-black text-purple-400 tracking-[0.2em] uppercase drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]">
              {gameState.players[viewingVoidIdx].name} Void
            </h2>
            <button onClick={() => setViewingVoidIdx(null)} className="px-10 py-4 bg-purple-900/40 hover:bg-purple-800 text-white font-orbitron text-md border border-purple-500/50 uppercase font-bold tracking-widest transition-all">CLOSE VIEW</button>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-4 scrollbar-hide">
            {gameState.players[viewingVoidIdx].void.map((card, i) => (
              <CardDetail key={i} card={card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * DeckPile Sub-component: Visualizes the deck with a card count.
 */
const DeckPile: React.FC<{ count: number, label: string }> = ({ count, label }) => (
  <div className="flex flex-col items-center group relative">
    <div className={`w-32 aspect-[2/3] card-back rounded border-2 border-slate-400 flex items-center justify-center shadow-xl transition-transform group-hover:scale-105 relative`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black text-white text-3xl font-orbitron drop-shadow-md z-20 pointer-events-none">{count}</span>
      </div>
    </div>
    <span className="text-[11px] font-orbitron mt-2 text-white font-black drop-shadow-md tracking-widest">{label.toUpperCase()}</span>
  </div>
);

/**
 * Pile Sub-component: Represents Discard and Void piles. Supports glow animations.
 */
const Pile: React.FC<{ count: number, label: string, color: string, icon: string, isFlashing?: boolean, onClick?: () => void, domRef?: (el: HTMLElement | null) => void }> = ({ count, label, color, icon, isFlashing, onClick, domRef }) => (
  <div ref={domRef} className="flex flex-col items-center group cursor-pointer" onClick={onClick}>
    <div className={`w-32 aspect-[2/3] bg-${color}-900/40 border border-white/10 rounded flex flex-col items-center justify-center shadow-xl transition-all group-hover:scale-105 text-white font-orbitron ${isFlashing ? (color === 'slate' ? 'flash-gold' : 'flash-purple') : ''}`}>
      <i className={`fa-solid ${icon} text-2xl mb-1 opacity-60`}></i>
      <span className="text-xl font-black">{count}</span>
    </div>
    <span className="text-[11px] font-orbitron mt-2 text-white font-black drop-shadow-md tracking-widest">{label.toUpperCase()}</span>
  </div>
);

/**
 * Zone Sub-component: A single slot on the field. Handles display of cards in Attack/Defense/Hidden positions.
 */
const Zone: React.FC<{
  card: PlacedCard | null;
  type: 'entity' | 'action';
  owner: 'active' | 'opponent';
  onClick?: () => void;
  isSelected?: boolean;
  isSelectable?: boolean;
  isTributeSelected?: boolean;
  isDropTarget?: boolean;
  domRef?: (el: HTMLElement | null) => void;
}> = ({ card, type, owner, onClick, isSelected, isSelectable, isTributeSelected, isDropTarget, domRef }) => {
  // Track previous stats to trigger pop animations
  const prevStats = useRef<{ id: string, atk: number, def: number } | null>(null);
  const [popStats, setPopStats] = useState<{ atk: boolean, def: boolean }>({ atk: false, def: false });

  useEffect(() => {
    if (!card) {
      prevStats.current = null;
      return;
    }

    if (prevStats.current && prevStats.current.id === card.card.instanceId) {
      if (card.card.atk !== prevStats.current.atk) {
        setPopStats(prev => ({ ...prev, atk: true }));
        setTimeout(() => setPopStats(prev => ({ ...prev, atk: false })), 800);
      }
      if (card.card.def !== prevStats.current.def) {
        setPopStats(prev => ({ ...prev, def: true }));
        setTimeout(() => setPopStats(prev => ({ ...prev, def: false })), 800);
      }
    }
    prevStats.current = { id: card.card.instanceId, atk: card.card.atk, def: card.card.def };
  }, [card]);

  return (
    <div ref={domRef} onClick={onClick} className={`w-32 aspect-[2/3] rounded border-2 transition-all cursor-pointer flex flex-col overflow-hidden relative ${isSelected ? 'border-yellow-400 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.5)] z-10' : isTributeSelected ? 'border-green-400 scale-105 animate-pulse z-10' : isSelectable ? 'border-red-500 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)] z-10' : isDropTarget ? 'zone-drop-target z-10' : 'border-white/5 bg-black/40 hover:border-white/20'}`}>
      {card ? (
        <div className={`w-full h-full p-1 flex flex-col transition-all duration-700 relative ${card.position === Position.HIDDEN ? 'card-back' : card.card.type === CardType.ENTITY ? 'card-entity' : card.card.type === CardType.ACTION ? 'card-action' : 'card-condition'} ${(card.position === Position.DEFENSE || (card.position === Position.HIDDEN && card.card.type === CardType.ENTITY)) ? 'rotate-90 scale-90' : ''}`}>
          <div className="card-inner-border"></div>
          {card.position === Position.HIDDEN ? (<div className="flex-1 flex items-center justify-center opacity-40"><i className="fa-solid fa-lock text-2xl text-slate-800"></i></div>) : (
            <div className="flex flex-col h-full text-white relative z-10">
              <div className="card-title-box px-0.5 mb-0.5 border-b border-white/20"><div className="text-[6px] font-orbitron font-bold leading-tight truncate">{card.card.name}</div></div>
              <div className="flex-1 text-[5px] font-black leading-[1.2] opacity-80 overflow-hidden bg-black/20 p-0.5 mb-0.5 font-mono">{card.card.effectText}</div>
              {card.card.type === CardType.ENTITY && (<div className="flex justify-between text-[7px] font-black p-0.5 bg-black/40 border border-white/10 font-orbitron"><span className={`text-yellow-500 ${popStats.atk ? 'stat-changed' : ''}`}>A:{card.card.atk}</span><span className={`text-blue-400 ${popStats.def ? 'stat-changed' : ''}`}>D:{card.card.def}</span></div>)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center space-y-2 opacity-20"><i className={`${type === 'entity' ? 'fa-solid fa-chess-pawn text-3xl' : 'fa-solid fa-wand-sparkles text-2xl'} text-white`}></i><span className="text-[10px] font-orbitron tracking-widest text-white font-black drop-shadow-sm">{type.toUpperCase()}</span></div>
      )}
    </div>
  );
};

/**
 * CardDetail Sub-component: A high-fidelity representation of a card.
 * Used in the Hand, the Sidebar, and the Database Gallery.
 */
export const CardDetail: React.FC<{ card: Card, isSet?: boolean }> = ({ card, isSet }) => {
  // Handle hidden state for opponent's Set cards
  if (isSet) return (<div className="p-8 rounded-sm bg-slate-100 border-4 border-slate-400 flex flex-col items-center space-y-8 shadow-inner"><div className="w-24 h-24 rounded-sm border-2 border-slate-300 flex items-center justify-center bg-white/50 rotate-45 shadow-lg"><i className="fa-solid fa-eye-slash text-5xl opacity-40 -rotate-45 text-slate-600"></i></div><div className="text-center space-y-2"><h3 className="text-3xl font-orbitron font-black text-slate-600 uppercase tracking-widest">MASKED DATA</h3><p className="font-bold text-xs text-slate-500 uppercase tracking-[0.3em]">Signature Hidden</p></div></div>);

  return (
    <div className={`p-4 rounded border-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col space-y-4 relative overflow-hidden transition-all aspect-[2/3] ${card.type === CardType.ENTITY ? 'card-entity glow-gold' : card.type === CardType.ACTION ? 'card-action glow-green' : card.type === CardType.CONDITION ? 'card-condition glow-pink' : ''}`}>
      <div className="card-inner-border"></div>
      <div className="card-title-box p-3 relative z-10 border-b-2 border-white/10 flex justify-between items-center">
        <h3 className="text-xs font-orbitron font-bold leading-tight tracking-tight text-white truncate mr-2">{card.name}</h3>
        {card.type === CardType.ENTITY && <span className="text-xs font-orbitron font-black text-yellow-500 whitespace-nowrap">Lv.{card.level}</span>}
      </div>
      <div className="flex-1 text-[11px] font-bold leading-relaxed text-white/90 p-3 bg-black/40 border border-white/10 relative z-10 font-mono shadow-inner overflow-y-auto scrollbar-hide">
        {card.effectText}
      </div>
      {card.type === CardType.ENTITY && (
        <div className="flex justify-center items-center py-2 bg-black/50 border border-white/10 rounded-sm relative z-10">
          <span className="font-orbitron font-black text-white text-md">ATK: {card.atk} / DEF: {card.def}</span>
        </div>
      )}
    </div>
  );
};

export default GameView;