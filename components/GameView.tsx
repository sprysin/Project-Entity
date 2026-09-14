import React from 'react';
import { CardType, Phase, Position } from '../types';
import { useGameLogic } from '../hooks/useGameLogic';
import { checkActivationConditions, hasOnActivateEffect } from '../hooks/cardHelpers';
import { CardDetail } from './Game/CardDetail';
import { Pile, DeckPile } from './Game/Pile';
import { Zone } from './Game/Zone';
import { WinnerModal, HandSelectionModal, DiscardSelectionModal, DeckSelectionModal, EffectModal, PileViewModal, DeckViewModal } from './Game/GameModals';

interface GameViewProps {
  onQuit: () => void;
}

/**
 * GameView Component
 * The core battle interface. Manages game state, turn logic, animations, and user interactions.
 */
const GameView: React.FC<GameViewProps> = ({ onQuit }) => {
  const { gameState, setGameState, state, actions } = useGameLogic();

  if (!gameState) return <div className="flex-1 flex items-center justify-center font-orbitron text-yellow-500 uppercase text-3xl">System Initialization...</div>;

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const oppIdx = (gameState.activePlayerIndex + 1) % 2;
  const opponent = gameState.players[oppIdx];
  const selectedCard = state.selectedHandIndex !== null ? activePlayer.hand[state.selectedHandIndex] : null;
  const isLightTheme = gameState.activePlayerIndex === 1;
  const actionsDisabled = !!gameState.winner || state.pendingEffectCard !== null || state.triggeredEffect !== null || state.isPeekingField || state.discardSelectionReq !== null || state.handSelectionReq !== null || state.deckSelectionReq !== null || state.effectTributeReq !== null;

  const isSelectedZone = (type: 'pawn' | 'action', index: number) =>
    state.selectedFieldSlot?.playerIndex === gameState.activePlayerIndex &&
    state.selectedFieldSlot.type === type &&
    state.selectedFieldSlot.index === index;

  const canPawnAttack = (index: number) => {
    const pawn = activePlayer.pawnZones[index];
    return gameState.currentPhase === Phase.BATTLE && gameState.turnNumber > 1 && !!pawn &&
      pawn.position === Position.ATTACK &&
      (pawn.attacksRemaining !== undefined ? pawn.attacksRemaining > 0 : !pawn.hasAttacked);
  };

  const changePawnPosition = (index: number) => {
    setGameState(prev => {
      if (!prev) return null;
      const original = prev.players[prev.activePlayerIndex];
      const pawnZones = original.pawnZones.map(zone => zone ? { ...zone } : null);
      const zone = pawnZones[index];
      if (!zone || zone.hasChangedPosition || zone.summonedTurn === prev.turnNumber) return prev;
      zone.position = zone.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
      zone.hasChangedPosition = true;
      const players = [...prev.players];
      players[prev.activePlayerIndex] = { ...original, pawnZones };
      return { ...prev, players: players as typeof prev.players };
    });
    actions.setSelectedFieldSlot(null);
  };

  const contextualMenu = (title: string, children: React.ReactNode) => (
    <div className="w-64 max-w-[calc(100vw-1rem)] rounded border border-yellow-400/60 bg-slate-950/95 p-2 text-white shadow-[0_0_28px_rgba(0,0,0,0.85)] backdrop-blur-md">
      <div className="overflow-hidden px-2 pb-2 text-center font-orbitron text-[9px] font-black uppercase tracking-[0.18em] text-yellow-400 whitespace-nowrap">
        <span
          className="inline-block whitespace-nowrap"
          style={{ transform: `scaleX(${Math.max(0.58, Math.min(1, 22 / title.length))})` }}
        >
          {title}
        </span>
      </div>
      <div className="flex gap-2">{children}</div>
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-yellow-400/60" />
    </div>
  );

  const menuButton = (label: string, onClick: () => void, disabled = false, tone: 'gold' | 'slate' | 'green' | 'purple' | 'red' = 'slate') => {
    const tones = {
      gold: 'border-yellow-500 bg-yellow-600 hover:bg-yellow-500',
      slate: 'border-slate-500 bg-slate-800 hover:bg-slate-700',
      green: 'border-green-500 bg-green-700 hover:bg-green-600',
      purple: 'border-purple-500 bg-purple-700 hover:bg-purple-600',
      red: 'border-red-500 bg-red-900 hover:bg-red-800',
    };
    return (
      <button disabled={disabled} onClick={onClick} className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap border px-2 py-2 font-orbitron text-[9px] font-black uppercase tracking-wider transition-colors ${tones[tone]} ${disabled ? 'cursor-not-allowed opacity-35 grayscale' : ''}`}>
        <span
          className="inline-block whitespace-nowrap"
          style={{ transform: `scaleX(${Math.max(0.72, Math.min(1, 14 / label.length))})` }}
        >
          {label}
        </span>
      </button>
    );
  };

  const checkIsSelectable = (z: typeof activePlayer.pawnZones[0], zoneType: 'pawn' | 'action', isOpponentPawn: boolean) => {
    if (isOpponentPawn && state.targetSelectMode === 'attack') return true;
    if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
      if (state.targetSelectType !== 'any' && state.targetSelectType !== zoneType) return false;
      if (!z) return false;
      if (state.targetSelectPosition === 'both') return true;
      if (state.targetSelectPosition === 'hidden' && z.position === Position.HIDDEN) return true;
      if (state.targetSelectPosition === 'faceup' && z.position !== Position.HIDDEN) return true;
    }
    return false;
  };

  return (
    <div className={`flex-1 flex flex-col relative overflow-hidden font-roboto select-none transition-colors duration-1000 ${isLightTheme ? 'bg-slate-200 text-slate-900 retro-hash-light' : 'bg-[#050505] text-slate-100 retro-hash'}`}>
      {/* HUD: Exit Control */}
      <div className="absolute top-4 left-4 z-40 flex flex-col space-y-2">
        <button onClick={onQuit} className="px-4 py-2 bg-slate-900/80 border border-white/10 hover:bg-red-950/80 text-slate-400 font-orbitron font-bold backdrop-blur-md text-xs uppercase tracking-widest">
          <i className="fa-solid fa-power-off mr-2"></i> EXIT GAME
        </button>
        <button onClick={() => actions.setIsDeckViewerOpen(true)} className="px-4 py-2 bg-slate-900/80 border border-yellow-500/50 hover:bg-yellow-900/80 text-yellow-400 font-orbitron font-bold backdrop-blur-md text-xs uppercase tracking-widest">
          <i className="fa-solid fa-layer-group mr-2"></i> VIEW DECK
        </button>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Main Play Area */}
        <div className="flex-1 flex flex-col items-center justify-between p-4 relative overflow-hidden">
          {/* Opponent Hand (Semi-Visible) */}
          <div className="absolute top-0 w-full flex justify-center space-x-[-10px] z-20 pointer-events-none">
            {opponent.hand.map((card, i) => (
              <div ref={actions.setRef(`${oppIdx}-hand-${i}`)} key={card.instanceId} className="w-28 aspect-[2/3] card-back rounded shadow-2xl border-2 border-slate-300 transform -translate-y-[60%] hover:translate-y-[-10%] transition-transform duration-300 cursor-pointer pointer-events-auto"></div>
            ))}
          </div>

          <div className="relative z-10 flex flex-col space-y-4 transform scale-100 transition-transform duration-500 items-center justify-center flex-1 w-full h-full mt-12 mb-20">
            {/* Opponent Field View */}
            <div className="flex flex-col items-center space-y-4 opacity-90">
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {opponent.actionZones.map((z, i) => (<Zone key={i} card={z} type="action" owner="opponent" domRef={actions.setRef(`${oppIdx}-action-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'action' && state.selectedFieldSlot?.index === i} isSelectable={checkIsSelectable(z, 'action', false)} onClick={() => {
                    if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                      if (checkIsSelectable(z, 'action', false)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: oppIdx, type: 'action', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                    }
                    else actions.setSelectedFieldSlot({ playerIndex: oppIdx, type: 'action', index: i })
                  }} />))}
                </div>
                <DeckPile count={opponent.deck.length} label="Deck" domRef={actions.setRef(`deck-${oppIdx}`)} />
              </div>
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {opponent.pawnZones.map((z, i) => (<Zone key={i} card={z} type="pawn" owner="opponent" domRef={actions.setRef(`${oppIdx}-pawn-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'pawn' && state.selectedFieldSlot?.index === i} isSelectable={checkIsSelectable(z, 'pawn', true)} onClick={() => {
                    if (state.targetSelectMode === 'attack' && state.selectedFieldSlot) {
                      const hasMonsters = opponent.pawnZones.some(mz => mz !== null);
                      if (hasMonsters) {
                        if (opponent.pawnZones[i]) actions.handleAttack(state.selectedFieldSlot.index, i);
                      } else {
                        actions.handleAttack(state.selectedFieldSlot.index, 'direct');
                      }
                    }
                    else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                      if (checkIsSelectable(z, 'pawn', true)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: oppIdx, type: 'pawn', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                    }
                    else actions.setSelectedFieldSlot({ playerIndex: oppIdx, type: 'pawn', index: i });
                  }} />))}
                </div>
                <div className="flex space-x-6">
                  <Pile count={opponent.discard.length} topCard={opponent.discard[opponent.discard.length - 1]} label="Discard" color="slate" icon="fa-skull" domRef={actions.setRef(`discard-${oppIdx}`)} isFlashing={state.discardFlash[oppIdx]} onClick={() => actions.setViewingDiscardIdx(oppIdx)} />
                  <Pile count={opponent.void.length} topCard={opponent.void[opponent.void.length - 1]} label="Void" color="purple" icon="fa-hurricane" domRef={actions.setRef(`void-${oppIdx}`)} isFlashing={state.voidFlash[oppIdx]} onClick={() => actions.setViewingVoidIdx(oppIdx)} />
                </div>
              </div>
            </div>

            {/* Central Information Bar: LP and Player Names */}
            <div className="w-full max-w-4xl h-8 bg-black/60 border-y border-white/10 backdrop-blur-md flex items-center justify-between px-16 my-2 relative z-0">
              <div className="flex items-center space-x-4">
                <span className="text-[10px] font-orbitron font-bold text-slate-400 uppercase tracking-widest">{opponent.name}</span>
                <span className={`text-xl font-orbitron font-black transition-colors duration-300 ${state.lpFlash[oppIdx] === 'damage' ? 'text-red-500' : state.lpFlash[oppIdx] === 'heal' ? 'text-green-500' : 'text-white'}`}>
                  {Math.floor(state.displayedLp[oppIdx])} LP
                </span>
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-8"></div>
              <div className="flex items-center space-x-4">
                <span className={`text-xl font-orbitron font-black transition-colors duration-300 ${state.lpFlash[gameState.activePlayerIndex] === 'damage' ? 'text-red-500' : state.lpFlash[gameState.activePlayerIndex] === 'heal' ? 'text-green-500' : 'text-white'}`}>
                  {Math.floor(state.displayedLp[gameState.activePlayerIndex])} LP
                </span>
                <span className="text-[10px] font-orbitron font-bold text-slate-400 uppercase tracking-widest">{activePlayer.name}</span>
              </div>
            </div>

            {/* Active Player Field View */}
            <div className="flex flex-col items-center space-y-4">
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {activePlayer.pawnZones.map((z, i) => {
                    const selected = isSelectedZone('pawn', i);
                    const canChangePosition = !!z && !z.hasChangedPosition && z.summonedTurn !== gameState.turnNumber;
                    const canActivateEffect = !!z && z.position === Position.ATTACK && hasOnActivateEffect(z.card) && checkActivationConditions(gameState, z.card, gameState.activePlayerIndex) && !(z.hasActivatedEffect && z.card.effectText?.includes('Once per turn'));
                    const attackReady = canPawnAttack(i);
                    const showHandMenu = selected && !z && selectedCard?.type === CardType.PAWN && !state.targetSelectMode && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2);
                    const showFieldMenu = selected && !!z && !state.targetSelectMode && !selectedCard && (
                      ((gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && (canChangePosition || hasOnActivateEffect(z.card))) ||
                      gameState.currentPhase === Phase.BATTLE
                    );
                    return <Zone key={i} card={z} type="pawn" owner="active" domRef={actions.setRef(`${gameState.activePlayerIndex}-pawn-${i}`)}
                    isSelected={selected}
                    isTributeSelected={state.tributeSelection.includes(i)}
                    isSelectable={checkIsSelectable(z, 'pawn', false)}
                    isDropTarget={(selectedCard?.type === CardType.PAWN && z === null) || (state.targetSelectMode === 'place_pawn' && z === null)}
                    isActivatable={attackReady}
                    contextualActions={showHandMenu ? contextualMenu('Choose summon method', <>
                      {menuButton(selectedCard.level >= 5 ? 'Tribute Summon' : 'Normal Summon', () => actions.handleSummon(selectedCard, 'normal', i), actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed), 'gold')}
                      {menuButton(selectedCard.level >= 5 ? 'Tribute Set' : 'Set Hidden', () => actions.handleSummon(selectedCard, 'hidden', i), actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed), 'slate')}
                    </>) : showFieldMenu ? contextualMenu(z!.card.name, <>
                      {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && menuButton(z!.position === Position.HIDDEN ? 'Flip Summon' : 'Change Position', () => changePawnPosition(i), actionsDisabled || !canChangePosition, 'slate')}
                      {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && hasOnActivateEffect(z!.card) && menuButton('Activate Effect', () => actions.activateOnField(gameState.activePlayerIndex, 'pawn', i), actionsDisabled || !canActivateEffect, 'purple')}
                      {gameState.currentPhase === Phase.BATTLE && menuButton(attackReady ? 'Attack' : 'Cannot Attack', () => actions.setTargetSelectMode('attack'), actionsDisabled || !attackReady, 'red')}
                    </>) : null}
                    onClick={() => {
                      if (state.targetSelectMode === 'place_pawn' && z === null) {
                        actions.handlePlacement(i);
                      } else if (state.targetSelectMode === 'tribute') {
                        if (z) {
                            if (state.effectTributeReq?.filter && !state.effectTributeReq.filter(z.card)) return; // Prevent invalid sacrifice
                            actions.setTributeSelection(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
                        }
                      } else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                        if (checkIsSelectable(z, 'pawn', false)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: gameState.activePlayerIndex, type: 'pawn', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                      } else if (selectedCard?.type === CardType.PAWN && z === null && !state.targetSelectMode) {
                        actions.setSelectedFieldSlot({ playerIndex: gameState.activePlayerIndex, type: 'pawn', index: i });
                      } else {
                        actions.setSelectedFieldSlot(z ? { playerIndex: gameState.activePlayerIndex, type: 'pawn', index: i } : null);
                        actions.setSelectedHandIndex(null);
                      }
                    }} />;
                  })}
                </div>
                <div className="flex space-x-6">
                  <Pile count={activePlayer.discard.length} topCard={activePlayer.discard[activePlayer.discard.length - 1]} label="Discard" color="slate" icon="fa-skull" domRef={actions.setRef(`discard-${gameState.activePlayerIndex}`)} isFlashing={state.discardFlash[gameState.activePlayerIndex]} onClick={() => actions.setViewingDiscardIdx(gameState.activePlayerIndex)} />
                  <Pile count={activePlayer.void.length} topCard={activePlayer.void[activePlayer.void.length - 1]} label="Void" color="purple" icon="fa-hurricane" domRef={actions.setRef(`void-${gameState.activePlayerIndex}`)} isFlashing={state.voidFlash[gameState.activePlayerIndex]} onClick={() => actions.setViewingVoidIdx(gameState.activePlayerIndex)} />
                </div>
              </div>
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {activePlayer.actionZones.map((z, i) => {
                    const selected = isSelectedZone('action', i);
                    const fieldActivationAvailable = !!z && (z.position === Position.HIDDEN || z.card.type === CardType.CONDITION || (z.card.type === CardType.ACTION && z.card.isLingering));
                    const canActivateFieldCard = fieldActivationAvailable && !!z && checkActivationConditions(gameState, z.card, gameState.activePlayerIndex) && !(z.card.type === CardType.CONDITION && gameState.turnNumber <= z.summonedTurn) && !z.hasActivatedEffect;
                    const showHandMenu = selected && !z && !!selectedCard && selectedCard.type !== CardType.PAWN && !state.targetSelectMode && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2);
                    const showFieldMenu = selected && !!z && !selectedCard && !state.targetSelectMode && fieldActivationAvailable;
                    return <Zone key={i} card={z} type="action" owner="active" domRef={actions.setRef(`${gameState.activePlayerIndex}-action-${i}`)}
                    isSelected={selected}
                    isSelectable={checkIsSelectable(z, 'action', false)}
                    isDropTarget={((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null) || (state.targetSelectMode === 'place_action' && z === null)}
                    isActivatable={canActivateFieldCard}
                    contextualActions={showHandMenu ? contextualMenu('Choose card action', <>
                      {selectedCard.type !== CardType.CONDITION && menuButton('Activate', () => actions.handleActionFromHand(selectedCard, 'activate', i), actionsDisabled || !checkActivationConditions(gameState, selectedCard, gameState.activePlayerIndex), 'green')}
                      {menuButton('Set Hidden', () => actions.handleActionFromHand(selectedCard, 'set', i), actionsDisabled, 'slate')}
                    </>) : showFieldMenu ? contextualMenu(z!.card.name, <>
                      {menuButton(`Activate ${z!.card.type}`, () => actions.activateOnField(gameState.activePlayerIndex, 'action', i), actionsDisabled || !canActivateFieldCard, 'green')}
                    </>) : null}
                    onClick={() => {
                      if (state.targetSelectMode === 'place_action' && z === null) {
                        actions.handlePlacement(i);
                      } else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                        if (checkIsSelectable(z, 'action', false)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: gameState.activePlayerIndex, type: 'action', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                      } else if ((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null && !state.targetSelectMode) {
                        actions.setSelectedFieldSlot({ playerIndex: gameState.activePlayerIndex, type: 'action', index: i });
                      } else {
                        actions.setSelectedFieldSlot(z ? { playerIndex: gameState.activePlayerIndex, type: 'action', index: i } : null);
                        actions.setSelectedHandIndex(null);
                      }
                    }} />;
                  })}
                </div>
                <div className="flex space-x-6 items-center">
                  <DeckPile count={activePlayer.deck.length} label="Deck" domRef={actions.setRef(`deck-${gameState.activePlayerIndex}`)} />
                </div>
              </div>
            </div>
          </div>

          {/* Active Player Hand Display (Bottom) */}
          <div className="absolute bottom-0 w-full flex justify-center space-x-[-10px] z-50 pointer-events-none pb-0" ref={actions.setRef(`${gameState.activePlayerIndex}-hand-container`)}>
            {activePlayer.hand.map((card, i) => {
              const isActivatable = actions.canPlayCard(card);
              return (
                <CardDetail
                  key={card.instanceId}
                  card={card}
                  domRef={actions.setRef(`${gameState.activePlayerIndex}-hand-${i}`)}
                  onClick={() => { actions.setSelectedHandIndex(i); actions.setSelectedFieldSlot(null); }}
                  compact={true}
                  className={`w-36 rounded transition-all duration-300 cursor-pointer border-2 border-slate-300 shadow-2xl pointer-events-auto 
                     ${state.selectedHandIndex === i ? 'transform translate-y-[-20%] z-20 ring-4 ring-yellow-500' : 'transform translate-y-[30%] hover:translate-y-[0%] z-10 hover:z-20'}
                     ${isActivatable ? 'glow-activatable' : ''}
                   `}
                />
              )
            })}
          </div>

          {/* Render Active Animations (Flying Cards, Vortices, Floating Texts, Shatters) */}
          {state.cardMotions.map(motion => (
            <div key={motion.id} className={`card-travel ${motion.activation ? 'card-travel-activation' : ''}`} onAnimationEnd={event => { if (event.target === event.currentTarget) state.finishMotion(motion.id); }}
              style={{
                left: motion.from.left, top: motion.from.top, width: motion.from.width, height: motion.from.height,
                animationDelay: `${motion.delay ?? 0}ms`, animationDuration: `${motion.duration ?? 490}ms`,
                '--travel-x': `${motion.to.left - motion.from.left}px`,
                '--travel-y': `${motion.to.top - motion.from.top}px`,
                '--travel-scale-x': motion.to.width / motion.from.width,
                '--travel-scale-y': motion.to.height / motion.from.height,
                '--from-rotation': `${motion.fromRotation}deg`,
                '--to-rotation': `${motion.rotation}deg`,
              } as React.CSSProperties}>
              <div className="card-travel-face w-full h-full">
                {motion.hidden ? <div className="card-back w-full h-full rounded border-2 border-slate-400" /> : <CardDetail card={motion.card} compact className="w-full h-full" />}
              </div>
            </div>
          ))}

          {state.voidAnimations.map(v => (
            <div key={v.id} className="vortex" style={{ left: `${v.x}%`, top: `${v.y}%` }}></div>
          ))}

          {state.shatterEffects.map(se => (
            <div key={se.id} className="shatter-container" style={{ left: `${se.x}%`, top: `${se.y}%` }}>
              {se.shards.map((s, idx) => (
                <div key={idx} className="shard" style={{ '--tx': s.tx, '--ty': s.ty, '--rot': s.rot } as React.CSSProperties}></div>
              ))}
            </div>
          ))}

          {state.floatingTexts.map(ft => (
            <div
              key={ft.id}
              className={`floating-text text-6xl ${ft.type === 'damage' ? 'text-red-600' : 'text-green-500'}`}
              style={{ left: `${ft.x}%`, top: `${ft.y}%` }}
            >
              {ft.text}
            </div>
          ))}

          <WinnerModal winner={gameState.winner} onQuit={onQuit} />

          <HandSelectionModal
            selectionReq={state.handSelectionReq}
            gameState={gameState}
            selectedHandSelectionIndex={state.selectedHandSelectionIndex}
            setSelectedHandSelectionIndex={actions.setSelectedHandSelectionIndex}
            setHandSelectionReq={actions.cancelEffect}
            handleHandSelection={actions.handleHandSelection}
          />

          <DiscardSelectionModal
            selectionReq={state.discardSelectionReq}
            gameState={gameState}
            selectedDiscardIndex={state.selectedDiscardIndex}
            setSelectedDiscardIndex={actions.setSelectedDiscardIndex}
            setDiscardSelectionReq={actions.cancelEffect}
            handleDiscardSelection={actions.handleDiscardSelection}
          />

          <DeckSelectionModal
            selectionReq={state.deckSelectionReq}
            gameState={gameState}
            selectedDeckIndex={state.selectedDeckIndex}
            setSelectedDeckIndex={actions.setSelectedDeckIndex}
            setDeckSelectionReq={actions.cancelEffect}
            handleDeckSelection={actions.handleDeckSelection}
          />

          <EffectModal
            triggeredEffect={state.triggeredEffect}
            gameState={gameState}
            isPeekingField={state.isPeekingField}
            resolveEffect={(c) => actions.resolveEffect(c, undefined, undefined, undefined, undefined, state.pendingTriggerType || 'activate')}
            checkActivationConditions={checkActivationConditions}
            setIsPeekingField={actions.setIsPeekingField}
            setTriggeredEffect={actions.setTriggeredEffect}
            setPendingEffectCard={actions.setPendingEffectCard}
          />

          {/* Phase and Turn Overlay Flashes */}
          {state.phaseFlash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60] overflow-hidden">
              <div key={gameState.turnNumber + gameState.currentPhase} className="phase-slide bg-black/80 backdrop-blur-sm border-y border-yellow-500/30 w-full py-3 flex items-center justify-center">
                <div className="text-2xl md:text-4xl font-orbitron font-bold text-white text-center tracking-[0.8em] uppercase pl-[0.8em]">{state.phaseFlash}</div>
              </div>
            </div>
          )}

          {state.turnFlash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[65] overflow-hidden">
              <div key={state.turnFlash} className="turn-slide bg-yellow-600/90 backdrop-blur-md w-full py-12 flex items-center justify-center border-y-8 border-yellow-400">
                <div className="text-6xl md:text-8xl font-orbitron font-black text-white text-center tracking-[0.1em] uppercase drop-shadow-xl">{state.turnFlash}</div>
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
            <button disabled={actionsDisabled || state.targetSelectMode !== null} onClick={actions.nextPhase} className={`px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-orbitron font-bold shadow-lg uppercase flex flex-col items-center justify-center overflow-hidden ${actionsDisabled || state.targetSelectMode !== null ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
              <span className="text-xl tracking-tighter whitespace-nowrap leading-none">NEXT PHASE</span>
              <span className="text-[10px] opacity-90 tracking-widest font-bold font-orbitron italic">({gameState.currentPhase})</span>
            </button>
            {state.pendingEffectCard && <button onClick={actions.cancelEffect} className="px-4 py-2 bg-red-900 text-white">Cancel effect</button>}
            {state.targetSelectMode === 'effect' && (<div className="px-4 py-2 bg-red-900 border-2 border-red-500 text-white font-orbitron font-black animate-pulse text-[10px] text-center shadow-lg uppercase tracking-widest">{state.pendingEffectCard?.name}: SELECT TARGET</div>)}
            {state.targetSelectMode === 'tribute' && (
              <div className="flex flex-col space-y-2">
                {state.effectTributeReq && (
                  <div className="px-4 py-2 bg-red-900 border-2 border-red-500 text-white font-orbitron font-black animate-pulse text-[10px] text-center shadow-lg uppercase tracking-widest">
                    {state.effectTributeReq.title}
                  </div>
                )}
                <button 
                  onClick={state.effectTributeReq ? actions.handleEffectTribute : actions.handleTributeSummon} 
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-orbitron font-black shadow-lg animate-pulse uppercase text-lg transition-all active:translate-x-1"
                >
                  SACRIFICE [{state.tributeSelection.length}/{state.effectTributeReq ? state.effectTributeReq.count : (state.pendingTributeCard ? (state.pendingTributeCard.level <= 7 ? 1 : 2) : 0)}]
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Panel: Includes Card Details and Integrated System Log */}
        <div className={`transition-all duration-300 ease-in-out border-l border-white/10 bg-black/80 backdrop-blur-2xl z-40 flex flex-col relative ${state.isRightPanelOpen ? 'w-80' : 'w-10'}`}>
          {/* Panel Toggle Tab */}
          <button
            onClick={() => actions.setIsRightPanelOpen(!state.isRightPanelOpen)}
            className="absolute top-1/2 -left-3 w-6 h-12 bg-yellow-600 rounded-l-md flex items-center justify-center text-black border-l border-y border-yellow-400 hover:bg-yellow-500 transition-colors z-50 shadow-lg"
          >
            <i className={`fa-solid ${state.isRightPanelOpen ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>

          <div className="flex-1 overflow-hidden flex flex-col relative">
            {state.isRightPanelOpen ? (
              <div className="flex-1 flex flex-col overflow-hidden h-full">
                {/* Dynamic Context Panel: Shows details for selected cards or hand cards */}
                <div className="flex-none p-6 pb-2">
                  {state.selectedFieldSlot && gameState.players[state.selectedFieldSlot.playerIndex][state.selectedFieldSlot.type === 'pawn' ? 'pawnZones' : 'actionZones'][state.selectedFieldSlot.index] ? (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <CardDetail card={gameState.players[state.selectedFieldSlot.playerIndex][state.selectedFieldSlot.type === 'pawn' ? 'pawnZones' : 'actionZones'][state.selectedFieldSlot.index]!.card} isSet={gameState.players[state.selectedFieldSlot.playerIndex][state.selectedFieldSlot.type === 'pawn' ? 'pawnZones' : 'actionZones'][state.selectedFieldSlot.index]!.position === Position.HIDDEN && state.selectedFieldSlot.playerIndex !== gameState.activePlayerIndex} />
                    </div>
                  ) : selectedCard ? (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <CardDetail card={selectedCard} />
                      <p className="text-center font-orbitron text-[9px] font-bold uppercase tracking-widest text-slate-500">Select an open zone to choose how to play this card.</p>
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
              <div className="flex-1 flex flex-col items-center justify-center pt-4 space-y-8 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => actions.setIsRightPanelOpen(true)}>
                <div className="rotate-90 whitespace-nowrap text-slate-500 font-orbitron font-bold tracking-widest text-[10px] uppercase opacity-60">
                  System Data
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <PileViewModal
        viewingDiscardIdx={state.viewingDiscardIdx}
        viewingVoidIdx={state.viewingVoidIdx}
        gameState={gameState}
        setViewingDiscardIdx={actions.setViewingDiscardIdx}
        setViewingVoidIdx={actions.setViewingVoidIdx}
      />

      <DeckViewModal
        isOpen={state.isDeckViewerOpen}
        onClose={() => actions.setIsDeckViewerOpen(false)}
        deck={activePlayer.initialDeck}
        playerName={activePlayer.name}
      />
    </div>
  );
};

export default GameView;
