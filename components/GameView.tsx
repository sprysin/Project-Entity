import React, { useRef } from 'react';
import { CardType, Phase, Position, Player, Card } from '../types';
import { useGameLogic } from '../hooks/useGameLogic';
import { checkActivationConditions } from '../cardEffects';
import { CardDetail } from './Game/CardDetail';
import { Pile, DeckPile } from './Game/Pile';
import { Zone } from './Game/Zone';
import { WinnerModal, HandSelectionModal, DiscardSelectionModal, EffectModal, PileViewModal } from './Game/GameModals';

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
  const actionsDisabled = state.triggeredEffect !== null || state.isPeekingField || state.discardSelectionReq !== null || state.handSelectionReq !== null;

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
                  {opponent.actionZones.map((z, i) => (<Zone key={i} card={z} type="action" owner="opponent" domRef={actions.setRef(`${oppIdx}-action-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'action' && state.selectedFieldSlot?.index === i} isSelectable={state.targetSelectMode === 'effect' && (state.targetSelectType === 'any' || state.targetSelectType === 'action') && state.pendingEffectCard !== null} onClick={() => {
                    if (state.targetSelectMode === 'effect' && state.pendingEffectCard) actions.resolveEffect(state.pendingEffectCard, { playerIndex: oppIdx, type: 'action', index: i });
                    else actions.setSelectedFieldSlot({ playerIndex: oppIdx, type: 'action', index: i })
                  }} />))}
                </div>
                <DeckPile count={opponent.deck.length} label="Deck" />
              </div>
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {opponent.entityZones.map((z, i) => (<Zone key={i} card={z} type="entity" owner="opponent" domRef={actions.setRef(`${oppIdx}-entity-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'entity' && state.selectedFieldSlot?.index === i} isSelectable={state.targetSelectMode === 'attack' || (state.targetSelectMode === 'effect' && (state.targetSelectType === 'any' || state.targetSelectType === 'entity') && state.pendingEffectCard !== null)} onClick={() => {
                    if (state.targetSelectMode === 'attack' && state.selectedFieldSlot) {
                      const hasMonsters = opponent.entityZones.some(mz => mz !== null);
                      if (hasMonsters) {
                        if (opponent.entityZones[i]) actions.handleAttack(state.selectedFieldSlot.index, i);
                      } else {
                        actions.handleAttack(state.selectedFieldSlot.index, 'direct');
                      }
                    }
                    else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                      if (opponent.entityZones[i]) actions.resolveEffect(state.pendingEffectCard, { playerIndex: oppIdx, type: 'entity', index: i });
                    }
                    else actions.setSelectedFieldSlot({ playerIndex: oppIdx, type: 'entity', index: i });
                  }} />))}
                </div>
                <div className="flex space-x-6">
                  <Pile count={opponent.discard.length} label="Discard" color="slate" icon="fa-skull" domRef={actions.setRef(`discard-${oppIdx}`)} isFlashing={state.discardFlash[oppIdx]} onClick={() => actions.setViewingDiscardIdx(oppIdx)} />
                  <Pile count={opponent.void.length} label="Void" color="purple" icon="fa-hurricane" domRef={actions.setRef(`void-${oppIdx}`)} isFlashing={state.voidFlash[oppIdx]} onClick={() => actions.setViewingVoidIdx(oppIdx)} />
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
                  {activePlayer.entityZones.map((z, i) => (<Zone key={i} card={z} type="entity" owner="active" domRef={actions.setRef(`${gameState.activePlayerIndex}-entity-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === gameState.activePlayerIndex && state.selectedFieldSlot?.type === 'entity' && state.selectedFieldSlot?.index === i} isTributeSelected={state.tributeSelection.includes(i)} isSelectable={state.targetSelectMode === 'effect' && (state.targetSelectType === 'any' || state.targetSelectType === 'entity') && state.pendingEffectCard !== null} isDropTarget={selectedCard?.type === CardType.ENTITY && z === null} onClick={() => {
                    if (state.targetSelectMode === 'tribute') { if (z) actions.setTributeSelection(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]); }
                    else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                      if (activePlayer.entityZones[i]) actions.resolveEffect(state.pendingEffectCard, { playerIndex: gameState.activePlayerIndex, type: 'entity', index: i });
                    }
                    else if (selectedCard?.type === CardType.ENTITY && z === null) actions.handleSummon(selectedCard, 'normal');
                    else { actions.setSelectedFieldSlot(z ? { playerIndex: gameState.activePlayerIndex, type: 'entity', index: i } : null); actions.setSelectedHandIndex(null); }
                  }} />))}
                </div>
                <div className="flex space-x-6">
                  <Pile count={activePlayer.discard.length} label="Discard" color="slate" icon="fa-skull" domRef={actions.setRef(`discard-${gameState.activePlayerIndex}`)} isFlashing={state.discardFlash[gameState.activePlayerIndex]} onClick={() => actions.setViewingDiscardIdx(gameState.activePlayerIndex)} />
                  <Pile count={activePlayer.void.length} label="Void" color="purple" icon="fa-hurricane" domRef={actions.setRef(`void-${gameState.activePlayerIndex}`)} isFlashing={state.voidFlash[gameState.activePlayerIndex]} onClick={() => actions.setViewingVoidIdx(gameState.activePlayerIndex)} />
                </div>
              </div>
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {activePlayer.actionZones.map((z, i) => (<Zone key={i} card={z} type="action" owner="active" domRef={actions.setRef(`${gameState.activePlayerIndex}-action-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === gameState.activePlayerIndex && state.selectedFieldSlot?.type === 'action' && state.selectedFieldSlot?.index === i} isDropTarget={(selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null} onClick={() => {
                    if ((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null) actions.handleActionFromHand(selectedCard, selectedCard.type === CardType.CONDITION ? 'set' : 'activate');
                    else { actions.setSelectedFieldSlot(z ? { playerIndex: gameState.activePlayerIndex, type: 'action', index: i } : null); actions.setSelectedHandIndex(null); }
                  }} />))}
                </div>
                <DeckPile count={activePlayer.deck.length} label="Deck" />
              </div>
            </div>
          </div>

          {/* Active Player Hand Display (Bottom) */}
          <div className="absolute bottom-0 w-full flex justify-center space-x-[-10px] z-50 pointer-events-none pb-0" ref={actions.setRef(`${gameState.activePlayerIndex}-hand-container`)}>
            {activePlayer.hand.map((card, i) => {
              const isActivatable = actions.canPlayCard(card);
              return (
                <div key={card.instanceId}
                  ref={actions.setRef(`${gameState.activePlayerIndex}-hand-${i}`)}
                  onClick={() => { actions.setSelectedHandIndex(i); actions.setSelectedFieldSlot(null); }}
                  className={`w-36 aspect-[2/3] rounded transition-all duration-300 cursor-pointer relative overflow-hidden border-2 border-slate-300 shadow-2xl pointer-events-auto 
                     ${state.selectedHandIndex === i ? 'transform translate-y-[-20%] z-20 ring-4 ring-yellow-500' : 'transform translate-y-[30%] hover:translate-y-[0%] z-10 hover:z-20'}
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
          {state.flyingCards.map(fc => (
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
            setHandSelectionReq={actions.setHandSelectionReq}
            handleHandSelection={actions.handleHandSelection}
          />

          <DiscardSelectionModal
            selectionReq={state.discardSelectionReq}
            gameState={gameState}
            selectedDiscardIndex={state.selectedDiscardIndex}
            setSelectedDiscardIndex={actions.setSelectedDiscardIndex}
            setDiscardSelectionReq={actions.setDiscardSelectionReq}
            handleDiscardSelection={actions.handleDiscardSelection}
          />

          <EffectModal
            triggeredEffect={state.triggeredEffect}
            gameState={gameState}
            isPeekingField={state.isPeekingField}
            resolveEffect={actions.resolveEffect}
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
            <button disabled={state.targetSelectMode !== null || state.isPeekingField || state.discardSelectionReq !== null || state.handSelectionReq !== null} onClick={actions.nextPhase} className={`px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-orbitron font-bold shadow-lg uppercase flex flex-col items-center justify-center overflow-hidden ${state.targetSelectMode !== null || state.isPeekingField || state.discardSelectionReq !== null || state.handSelectionReq !== null ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
              <span className="text-xl tracking-tighter whitespace-nowrap leading-none">NEXT PHASE</span>
              <span className="text-[10px] opacity-90 tracking-widest font-bold font-orbitron italic">({gameState.currentPhase})</span>
            </button>
            {state.targetSelectMode === 'effect' && (<div className="px-4 py-2 bg-red-900 border-2 border-red-500 text-white font-orbitron font-black animate-pulse text-[10px] text-center shadow-lg uppercase tracking-widest">{state.pendingEffectCard?.name}: SELECT TARGET</div>)}
            {state.targetSelectMode === 'tribute' && (<button onClick={actions.handleTributeSummon} className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-orbitron font-black shadow-lg animate-pulse uppercase text-lg transition-all active:translate-x-1">SACRIFICE [{state.tributeSelection.length}/{state.pendingTributeCard ? (state.pendingTributeCard.level <= 7 ? 1 : 2) : 0}]</button>)}
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
                  {state.selectedFieldSlot && gameState.players[state.selectedFieldSlot.playerIndex][state.selectedFieldSlot.type === 'entity' ? 'entityZones' : 'actionZones'][state.selectedFieldSlot.index] ? (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      <CardDetail card={gameState.players[state.selectedFieldSlot.playerIndex][state.selectedFieldSlot.type === 'entity' ? 'entityZones' : 'actionZones'][state.selectedFieldSlot.index]!.card} isSet={gameState.players[state.selectedFieldSlot.playerIndex][state.selectedFieldSlot.type === 'entity' ? 'entityZones' : 'actionZones'][state.selectedFieldSlot.index]!.position === Position.HIDDEN && state.selectedFieldSlot.playerIndex !== gameState.activePlayerIndex} />
                      <div className="flex flex-col space-y-3">
                        {/* Contextual Actions for On-Field Cards */}
                        {state.selectedFieldSlot.playerIndex === gameState.activePlayerIndex && (
                          <>
                            {state.selectedFieldSlot.type === 'entity' && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && (
                              <>
                                <button disabled={actionsDisabled || gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]?.summonedTurn === gameState.turnNumber} onClick={() => {
                                  setGameState(prev => {
                                    if (!prev) return null;
                                    const p = { ...prev.players[prev.activePlayerIndex] };
                                    const z = p.entityZones[state.selectedFieldSlot!.index];
                                    if (!z || z.hasChangedPosition || z.summonedTurn === prev.turnNumber) return prev;
                                    z.position = z.position === Position.ATTACK ? Position.DEFENSE : Position.ATTACK;
                                    z.hasChangedPosition = true;
                                    const players = [...prev.players];
                                    players[prev.activePlayerIndex] = p;
                                    return { ...prev, players: players as [Player, Player] };
                                  });
                                  actions.setSelectedFieldSlot(null);
                                }} className={`w-full py-4 border border-white/20 font-orbitron text-xs uppercase font-bold transition-all ${(actionsDisabled || gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]?.summonedTurn === gameState.turnNumber) ? 'opacity-30 bg-slate-900 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700'}`}>
                                  {gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]?.position === Position.HIDDEN ? 'FLIP SUMMON' : 'CHANGE POSITION'}
                                </button>

                                {/* ACTIVATE ENTITY EFFECT BUTTON (For entities with On Field effects like Dragon) */}
                                {gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]?.position === Position.ATTACK &&
                                  ['entity_05'].includes(gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]!.card.id) && (
                                    <button
                                      disabled={actionsDisabled || !checkActivationConditions(gameState, gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]!.card, state.selectedFieldSlot.playerIndex)}
                                      onClick={() => actions.activateOnField(state.selectedFieldSlot!.playerIndex, state.selectedFieldSlot!.type, state.selectedFieldSlot!.index)}
                                      className={`w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-orbitron text-xs font-black tracking-widest uppercase mt-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] ${(actionsDisabled || !checkActivationConditions(gameState, gameState.players[state.selectedFieldSlot.playerIndex].entityZones[state.selectedFieldSlot.index]!.card, state.selectedFieldSlot.playerIndex)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      ACTIVATE EFFECT
                                    </button>
                                  )}
                              </>
                            )}
                            {/* Activation triggers for Action/Condition slots */}
                            {state.selectedFieldSlot.type === 'action' &&
                              (gameState.players[state.selectedFieldSlot.playerIndex].actionZones[state.selectedFieldSlot.index]!.position === Position.HIDDEN || gameState.players[state.selectedFieldSlot.playerIndex].actionZones[state.selectedFieldSlot.index]!.card.type === CardType.CONDITION) && (
                                <button disabled={actionsDisabled || !checkActivationConditions(gameState, gameState.players[state.selectedFieldSlot.playerIndex].actionZones[state.selectedFieldSlot.index]!.card, state.selectedFieldSlot.playerIndex)} onClick={() => actions.activateOnField(state.selectedFieldSlot!.playerIndex, 'action', state.selectedFieldSlot!.index)} className={`w-full py-4 bg-green-600 hover:bg-green-700 text-white font-orbitron text-xs font-black tracking-widest uppercase ${actionsDisabled || !checkActivationConditions(gameState, gameState.players[state.selectedFieldSlot.playerIndex].actionZones[state.selectedFieldSlot.index]!.card, state.selectedFieldSlot.playerIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  ACTIVATE {gameState.players[state.selectedFieldSlot.playerIndex].actionZones[state.selectedFieldSlot.index]!.card.type}
                                </button>
                              )}
                            {/* Battle triggers */}
                            {state.selectedFieldSlot.type === 'entity' && gameState.currentPhase === Phase.BATTLE && !activePlayer.entityZones[state.selectedFieldSlot.index]?.hasAttacked && activePlayer.entityZones[state.selectedFieldSlot.index]?.position === Position.ATTACK && (
                              <button disabled={actionsDisabled} onClick={() => { if (gameState.turnNumber === 1) actions.addLog("INTERCEPT: Combat blocked cycle 1."); else actions.setTargetSelectMode('attack'); }} className={`w-full py-4 border-2 font-orbitron text-xs font-black uppercase transition-all ${actionsDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${gameState.turnNumber === 1 ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-red-900/40 hover:bg-red-800 text-red-200 border-red-500'}`}>ENGAGE TARGET</button>
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
                                <button disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed)} onClick={() => actions.handleSummon(selectedCard, 'normal')} className={`w-full py-4 text-white font-orbitron text-xs font-black tracking-widest border-b-4 uppercase transition-all ${(actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed)) ? 'bg-slate-800 border-slate-900 opacity-50 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800'}`}>
                                  {(selectedCard.level <= 4 && activePlayer.normalSummonUsed) ? 'NORMAL LIMIT REACHED' : (selectedCard.level >= 5 ? 'TRIBUTE SUMMON' : 'NORMAL SUMMON')}
                                </button>
                                <button disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed)} onClick={() => actions.handleSummon(selectedCard, 'hidden')} className={`w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/20 font-orbitron text-xs uppercase font-bold text-slate-300 transition-all ${(actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed)) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  {(selectedCard.level <= 4 && activePlayer.hiddenSummonUsed) ? 'SET LIMIT REACHED' : 'SET HIDDEN'}
                                </button>
                              </>
                            ) : (
                              <>
                                {selectedCard.type !== CardType.CONDITION && (
                                  <button disabled={actionsDisabled || !checkActivationConditions(gameState, selectedCard, gameState.activePlayerIndex)} onClick={() => actions.handleActionFromHand(selectedCard, 'activate')} className={`w-full py-4 bg-green-600 hover:bg-green-700 text-white font-orbitron text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(74,222,128,0.2)] ${actionsDisabled || !checkActivationConditions(gameState, selectedCard, gameState.activePlayerIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}>ACTIVATE ACTION</button>
                                )}
                                <button disabled={actionsDisabled} onClick={() => actions.handleActionFromHand(selectedCard, 'set')} className={`w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/20 font-orbitron text-xs uppercase font-bold text-slate-300 ${actionsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>SET CARD</button>
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
    </div>
  );
};

export default GameView;