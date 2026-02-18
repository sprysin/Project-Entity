import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Card, CardType, Phase, Position, PlacedCard } from '../types';
import { api } from '../api';
import { CardDetail } from './CardDetail';
import { Zone } from './Zone';
import { Pile, DeckPile } from './Pile';
import { Hand } from './Hand';

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
  const [drawStartIndex, setDrawStartIndex] = useState<number | null>(null);
  const [flyingCards, setFlyingCards] = useState<{ id: string, startX: number, startY: number, targetX: number, targetY: number, card?: Card }[]>([]);
  const [voidAnimations, setVoidAnimations] = useState<{ id: string, x: number, y: number }[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<{ id: string, text: string, type: 'damage' | 'heal', x: number, y: number }[]>([]);
  const [shatterEffects, setShatterEffects] = useState<{ id: string, x: number, y: number, shards: { tx: string, ty: string, rot: string }[] }[]>([]);

  // Pile Flash State - Monitors when cards are added to Discard/Void
  const [discardFlash, setDiscardFlash] = useState<[boolean, boolean]>([false, false]);
  const [voidFlash, setVoidFlash] = useState<[boolean, boolean]>([false, false]);
  const prevDiscardLengths = useRef<[number, number]>([0, 0]);
  const prevVoidLengths = useRef<[number, number]>([0, 0]);

  // Hand tracking for Draw Animation
  const prevHandLengths = useRef<[number, number]>([5, 5]); // Start with 5 assuming initial hand

  // Layout State
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Refs for tracking animation targets and handling async logic
  const zoneRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lastLp = useRef<[number, number]>([800, 800]);
  const isTransitioning = useRef(false);
  const processedAutoPhase = useRef<string>("");

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
  const triggerVisual = (sourceKey: string, targetKey: string, type: 'discard' | 'void' | 'retrieve' | 'draw', cardData?: Card) => {
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

    if (type === 'discard' || type === 'void' || type === 'retrieve' || type === 'draw') {
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
    api.startGame().then(setGameState).catch(console.error);
  }, []);

  /**
   * Monitor pile and hand changes to trigger animations.
   */
  useEffect(() => {
    if (!gameState) return;
    gameState.players.forEach((p, idx) => {
      // Discard Flash
      if (p.discard.length > prevDiscardLengths.current[idx]) {
        setDiscardFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = true; return n; });
        setTimeout(() => setDiscardFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = false; return n; }), 800);
      }
      prevDiscardLengths.current[idx] = p.discard.length;

      // Void Flash
      if (p.void.length > prevVoidLengths.current[idx]) {
        setVoidFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = true; return n; });
        setTimeout(() => setVoidFlash(prev => { const n = [...prev] as [boolean, boolean]; n[idx] = false; return n; }), 800);
      }
      prevVoidLengths.current[idx] = p.void.length;

      // Hand Length Tracking for Draw Animation
      if (p.hand.length !== prevHandLengths.current[idx]) {
        // Just update, actual draw animation triggered in Phase Change logic below
        // Or could be here, but phase change logic handles 'turn change' well.
      }
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
  const nextPhase = useCallback(async () => {
    if (!gameState || gameState.winner) return;
    try {
      const result = await api.nextPhase();
      handleEffectResult(result);
      isTransitioning.current = false;
    } catch (e) { console.error(e); }
  }, [gameState]);

  /**
   * Automation Hook for Phase transitions & Draw Animation.
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

      // Reset turn-based limits and attack flags locally for immediate feedback
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

      // Calculate drawn count and trigger animation
      const activePlayer = gameState.players[gameState.activePlayerIndex];
      const prevHandSize = prevHandLengths.current[gameState.activePlayerIndex];
      const currentHandSize = activePlayer.hand.length;
      const drawnCount = currentHandSize - prevHandSize;

      if (drawnCount > 0 && gameState.turnNumber >= 0) {
        setDrawStartIndex(prevHandSize);
        // Reset animation state after max duration (drawnCount * 150ms + buffer)
        setTimeout(() => setDrawStartIndex(null), drawnCount * 150 + 1000);
      }

      // Update prev length
      prevHandLengths.current[gameState.activePlayerIndex] = currentHandSize;

      // Auto-advance after animation
      const delay = Math.max(1500, drawnCount * 200 + 1200);
      setTimeout(() => {
        isTransitioning.current = false;
        nextPhase();
      }, delay);

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

    // Always update last known hand size for other phases to keep sync
    gameState.players.forEach((p, idx) => {
      prevHandLengths.current[idx] = p.hand.length;
    });

  }, [gameState?.currentPhase, gameState?.activePlayerIndex, gameState?.turnNumber, gameState?.winner, nextPhase]);

  /**
   * Helper to check if a card in hand is playable.
   */
  const canPlayCard = useCallback((card: Card) => {
    if (!gameState) return false;
    if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return false;
    // Server-side validation handles complex checks (effects, costs, etc.)
    return true;
  }, [gameState]);

  /**
   * Helper to process effect results from API.
   */
  const handleEffectResult = useCallback((result: any, sourceCard?: Card) => {
    if (!result) return;
    setGameState(result.newState);

    if (result.requireTarget) {
      if (sourceCard) setPendingEffectCard(sourceCard);
      setTargetSelectMode('effect');
      setTargetSelectType(result.requireTarget);
      setIsPeekingField(false);
    } else if (result.requireDiscardSelection) {
      if (sourceCard) setPendingEffectCard(sourceCard);
      setDiscardSelectionReq(result.requireDiscardSelection);
      setSelectedDiscardIndex(null);
    } else if (result.requireHandSelection) {
      if (sourceCard) setPendingEffectCard(sourceCard);
      setHandSelectionReq(result.requireHandSelection);
      setSelectedHandSelectionIndex(null);
    } else {
      // Clear states if resolved
      setPendingEffectCard(null);
      setTargetSelectMode(null);
      setDiscardSelectionReq(null);
      setHandSelectionReq(null);
    }
  }, []);

  /**
   * Helper to submit resolution (Target, Discard Selection, Hand Selection) to API.
   */
  const submitResolution = async (params: { target?: { playerIndex: number, type: 'entity' | 'action', index: number }, discardIndex?: number, handIndex?: number }) => {
    if (!pendingEffectCard || !gameState) return;
    const card = pendingEffectCard;
    const pIdx = gameState.activePlayerIndex;
    const p = gameState.players[pIdx];

    // Hand Context
    const handIdx = p.hand.findIndex(c => c.instanceId === card.instanceId);
    if (handIdx !== -1) {
      api.activateHand(card.instanceId, params.target, params.discardIndex, params.handIndex).then(r => handleEffectResult(r, card));
      return;
    }

    // Field Action Context
    const fieldActionIdx = p.actionZones.findIndex(z => z?.card.instanceId === card.instanceId);
    if (fieldActionIdx !== -1) {
      api.activateField(fieldActionIdx, 'action', params.target, params.discardIndex, params.handIndex).then(r => handleEffectResult(r, card));
      return;
    }

    // Field Entity Context
    const fieldEntityIdx = p.entityZones.findIndex(z => z?.card.instanceId === card.instanceId);
    if (fieldEntityIdx !== -1) {
      api.activateField(fieldEntityIdx, 'entity', params.target, params.discardIndex, params.handIndex).then(r => handleEffectResult(r, card));
      return;
    }
  };

  /**
   * Handles selection from the Discard Pile Modal.
   */
  const handleDiscardSelection = (index: number) => {
    if (!discardSelectionReq || !gameState || !pendingEffectCard) return;

    const pIdx = discardSelectionReq.playerIndex;
    const card = gameState.players[pIdx].discard[index];

    setDiscardSelectionReq(null);
    setSelectedDiscardIndex(null);

    triggerVisual(`discard-${pIdx}`, `${pIdx}-hand-${gameState.players[pIdx].hand.length}`, 'retrieve', card);

    setTimeout(() => {
      submitResolution({ discardIndex: index });
    }, 700);
  };

  /**
   * Handles selection from the Hand Selection Modal (e.g. for Discard costs).
   */
  const handleHandSelection = (index: number) => {
    if (!handSelectionReq || !gameState || !pendingEffectCard) return;

    const pIdx = handSelectionReq.playerIndex;
    const card = gameState.players[pIdx].hand[index];

    setHandSelectionReq(null);
    setSelectedHandSelectionIndex(null);

    triggerVisual(`${pIdx}-hand-${index}`, `discard-${pIdx}`, 'discard', card);

    setTimeout(() => {
      submitResolution({ handIndex: index });
    }, 400);
  };

  /**
   * Core logic for Summoning or Setting an Entity. 
   */
  const handleSummon = async (card: Card, mode: 'normal' | 'hidden' | 'tribute') => {
    if (!gameState || isPeekingField) return;
    if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;

    if (card.level >= 5 && mode !== 'tribute') {
      const p = gameState.players[gameState.activePlayerIndex];
      const entityCount = p.entityZones.filter(z => z !== null).length;
      const required = card.level <= 7 ? 1 : 2;
      if (entityCount < required) {
        // Not enough tributes on field (Client-side pre-check for UX)
        return;
      }
      setPendingTributeCard(card);
      setTributeSummonMode(mode === 'hidden' ? 'hidden' : 'normal');
      setTributeSelection([]);
      setTargetSelectMode('tribute');
      return;
    }

    try {
      const result = await api.summon(card.instanceId, mode);
      handleEffectResult(result, card);
    } catch (e) {
      console.error(e);
    }
    setSelectedHandIndex(null);
  };

  /**
   * Finalizes a tribute summon once the required sacrifices are selected.
   */
  const handleTributeSummon = async () => {
    if (!gameState || !pendingTributeCard || isPeekingField) return;
    const required = pendingTributeCard.level <= 7 ? 1 : 2;
    if (tributeSelection.length !== required) return;

    try {
      const result = await api.summon(pendingTributeCard.instanceId, tributeSummonMode, tributeSelection);
      handleEffectResult(result, pendingTributeCard);
    } catch (e) {
      console.error(e);
    }

    setPendingTributeCard(null);
    setTributeSelection([]);
    setTargetSelectMode(null);
    setSelectedHandIndex(null);
  };

  /**
   * Handles playing Action or Condition cards from hand.
   */
  const handleActionFromHand = async (card: Card, mode: 'activate' | 'set') => {
    if (!gameState || isPeekingField) return;
    if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;

    try {
      if (mode === 'set') {
        const result = await api.setAction(card.instanceId);
        handleEffectResult(result);
      } else {
        const result = await api.activateHand(card.instanceId);
        handleEffectResult(result, card);
      }
    } catch (e) { console.error(e); }
    setSelectedHandIndex(null);
  };

  const activateOnField = async (playerIndex: number, type: 'entity' | 'action', index: number) => {
    if (!gameState || isPeekingField) return;

    try {
      const result = await api.activateField(index, type);
      // Find card for source
      const p = gameState.players[playerIndex];
      const card = type === 'entity' ? p.entityZones[index]?.card : p.actionZones[index]?.card;
      handleEffectResult(result, card);
    } catch (e) { console.error(e); }
    setSelectedFieldSlot(null);
  };

  /**
   * Combat resolution logic. Handles Attack vs Attack, Attack vs Defense, and Direct Attacks.
   */
  const handleAttack = async (attackerIdx: number, targetIdx: number | 'direct') => {
    if (!gameState || gameState.turnNumber === 1 || isPeekingField) return;
    try {
      const result = await api.attack(attackerIdx, targetIdx.toString()); // targetIdx "direct" or number
      handleEffectResult(result);
    } catch (e) { console.error(e); }
    setTargetSelectMode(null);
    setSelectedFieldSlot(null);
  };

  if (!gameState) return <div className="flex-1 flex items-center justify-center font-orbitron text-yellow-500 uppercase text-3xl">System Initialization...</div>;

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const oppIdx = (gameState.activePlayerIndex + 1) % 2;
  const opponent = gameState.players[oppIdx];
  const selectedCard = selectedHandIndex !== null ? activePlayer.hand[selectedHandIndex] : null;
  const isLightTheme = gameState.activePlayerIndex === 1;
  const actionsDisabled = isPeekingField || discardSelectionReq !== null || handSelectionReq !== null;

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
                    if (targetSelectMode === 'effect' && pendingEffectCard) submitResolution({ target: { playerIndex: oppIdx, type: 'action', index: i } });
                    else setSelectedFieldSlot({ playerIndex: oppIdx, type: 'action', index: i })
                  }} />))}
                </div>
                <div ref={setRef(`deck-${oppIdx}`)}>
                  <DeckPile count={opponent.deck.length} label="Deck" />
                </div>
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
                      if (opponent.entityZones[i]) submitResolution({ target: { playerIndex: oppIdx, type: 'entity', index: i } });
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
                      if (activePlayer.entityZones[i]) submitResolution({ target: { playerIndex: gameState.activePlayerIndex, type: 'entity', index: i } });
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
                <div ref={setRef(`deck-${gameState.activePlayerIndex}`)}>
                  <DeckPile count={activePlayer.deck.length} label="Deck" />
                </div>
              </div>
            </div>
          </div>

          {/* Active Player Hand Display (Bottom) */}
          <Hand
            cards={activePlayer.hand}
            activePlayerIndex={gameState.activePlayerIndex}
            selectedHandIndex={selectedHandIndex}
            onCardClick={(i) => { setSelectedHandIndex(i); setSelectedFieldSlot(null); }}
            canPlayCard={canPlayCard}
            domRef={(i) => setRef(`${gameState.activePlayerIndex}-hand-${i}`)}
            containerRef={setRef(`${gameState.activePlayerIndex}-hand-container`)}
            drawStartIndex={drawStartIndex}
          />

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
                                      disabled={actionsDisabled}
                                      onClick={() => activateOnField(selectedFieldSlot.playerIndex, selectedFieldSlot.type, selectedFieldSlot.index)}
                                      className={`w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-orbitron text-xs font-black tracking-widest uppercase mt-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] ${(actionsDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      ACTIVATE EFFECT
                                    </button>
                                  )}
                              </>
                            )}
                            {/* Activation triggers for Action/Condition slots */}
                            {selectedFieldSlot.type === 'action' &&
                              (gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.position === Position.HIDDEN || gameState.players[selectedFieldSlot.playerIndex].actionZones[selectedFieldSlot.index]!.card.type === CardType.CONDITION) && (
                                <button disabled={actionsDisabled} onClick={() => activateOnField(selectedFieldSlot.playerIndex, 'action', selectedFieldSlot.index)} className={`w-full py-4 bg-green-600 hover:bg-green-700 text-white font-orbitron text-xs font-black tracking-widest uppercase ${actionsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                                  <button disabled={actionsDisabled} onClick={() => handleActionFromHand(selectedCard, 'activate')} className={`w-full py-4 bg-green-600 hover:bg-green-700 text-white font-orbitron text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(74,222,128,0.2)] ${actionsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>ACTIVATE ACTION</button>
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

export default GameView;