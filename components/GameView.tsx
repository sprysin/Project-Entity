import React from 'react';
import { CardType, Phase, Position } from '../types';
import { useGameLogic } from '../hooks/useGameLogic';
import { checkActivationConditions, hasOnActivateEffect } from '../hooks/cardHelpers';
import { CardDetail } from './Game/CardDetail';
import { Pile, DeckPile } from './Game/Pile';
import { Zone } from './Game/Zone';
import { PileViewModal, DeckViewModal } from './Game/GameModals';
import { ContextMenu, ContextMenuButton } from './Game/ContextMenu';
import { GameOverlays } from './Game/GameOverlays';
import { GameSidebar } from './Game/GameSidebar';
import { HealthHud } from './Game/HealthHud';
import { SavedDeck } from '../src/decks';

interface GameViewProps {
  onQuit: () => void;
  initialDecks?: [SavedDeck | null, SavedDeck | null];
}

/**
 * GameView Component
 * The core battle interface. Manages game state, turn logic, animations, and user interactions.
 */
const GameView: React.FC<GameViewProps> = ({ onQuit, initialDecks }) => {
  const { gameState, setGameState, state, actions } = useGameLogic(initialDecks);

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
          <HealthHud
            player={opponent}
            displayedLp={state.displayedLp[oppIdx]}
            flash={state.lpFlash[oppIdx]}
            position="opponent"
          />
          <HealthHud
            player={activePlayer}
            displayedLp={state.displayedLp[gameState.activePlayerIndex]}
            flash={state.lpFlash[gameState.activePlayerIndex]}
            position="active"
          />

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
                  {opponent.actionZones.map((z, i) => (<Zone key={i} card={z} type="action" domRef={actions.setRef(`${oppIdx}-action-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'action' && state.selectedFieldSlot?.index === i} isSelectable={checkIsSelectable(z, 'action', false)} onClick={() => {
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
                  {opponent.pawnZones.map((z, i) => (<Zone key={i} card={z} type="pawn" domRef={actions.setRef(`${oppIdx}-pawn-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'pawn' && state.selectedFieldSlot?.index === i} isSelectable={checkIsSelectable(z, 'pawn', true)} onClick={() => {
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

            {/* Decorative divider between the two fields */}
            <div aria-hidden="true" className="h-5 w-full max-w-5xl shrink-0 border-y border-white/10 bg-black/60 shadow-[0_0_18px_rgba(0,0,0,0.65)] backdrop-blur-md" />

            {/* Active Player Field View */}
            <div className="flex flex-col items-center space-y-4">
              <div className="flex space-x-6 items-center">
                <div className="flex space-x-6">
                  {activePlayer.pawnZones.map((z, i) => {
                    const selected = isSelectedZone('pawn', i);
                    const canChangePosition = !!z && !z.hasChangedPosition && z.summonedTurn !== gameState.turnNumber;
                    const canActivateEffect = !!z && z.position === Position.ATTACK && hasOnActivateEffect(z.card) && checkActivationConditions(gameState, z.card, gameState.activePlayerIndex) && !(z.hasActivatedEffect && z.card.effectText?.includes('Once per turn'));
                    const attackReady = canPawnAttack(i);
                    const selectedCardCanTributeSummon = selectedCard?.type === CardType.PAWN && selectedCard.level >= 5;
                    const canChooseSummonMethod = selectedCard?.type === CardType.PAWN && (!z || selectedCardCanTributeSummon);
                    const showHandMenu = selected && canChooseSummonMethod && !state.targetSelectMode && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2);
                    const showFieldMenu = selected && !!z && !state.targetSelectMode && !selectedCard && (
                      ((gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && (canChangePosition || hasOnActivateEffect(z.card))) ||
                      gameState.currentPhase === Phase.BATTLE
                    );
                    return <Zone key={i} card={z} type="pawn" domRef={actions.setRef(`${gameState.activePlayerIndex}-pawn-${i}`)}
                    isSelected={selected}
                    isTributeSelected={state.tributeSelection.includes(i)}
                    isSelectable={checkIsSelectable(z, 'pawn', false)}
                    isDropTarget={(selectedCard?.type === CardType.PAWN && (z === null || selectedCardCanTributeSummon)) || (state.targetSelectMode === 'place_pawn' && z === null)}
                    isActivatable={attackReady}
                    contextualActions={showHandMenu ? <ContextMenu title="Choose summon method">
                      <ContextMenuButton label={selectedCard.level >= 5 ? 'Tribute Summon' : 'Normal Summon'} onClick={() => actions.handleSummon(selectedCard, 'normal', i)} disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed)} tone="gold" />
                      <ContextMenuButton label={selectedCard.level >= 5 ? 'Tribute Set' : 'Set Hidden'} onClick={() => actions.handleSummon(selectedCard, 'hidden', i)} disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed)} />
                    </ContextMenu> : showFieldMenu ? <ContextMenu title={z!.card.name}>
                      {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && <ContextMenuButton label={z!.position === Position.HIDDEN ? 'Flip Summon' : 'Change Position'} onClick={() => changePawnPosition(i)} disabled={actionsDisabled || !canChangePosition} />}
                      {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && hasOnActivateEffect(z!.card) && <ContextMenuButton label="Activate Effect" onClick={() => actions.activateOnField(gameState.activePlayerIndex, 'pawn', i)} disabled={actionsDisabled || !canActivateEffect} tone="purple" />}
                      {gameState.currentPhase === Phase.BATTLE && <ContextMenuButton label={attackReady ? 'Attack' : 'Cannot Attack'} onClick={() => actions.setTargetSelectMode('attack')} disabled={actionsDisabled || !attackReady} tone="red" />}
                    </ContextMenu> : null}
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
                      } else if (canChooseSummonMethod && !state.targetSelectMode) {
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
                    return <Zone key={i} card={z} type="action" domRef={actions.setRef(`${gameState.activePlayerIndex}-action-${i}`)}
                    isSelected={selected}
                    isSelectable={checkIsSelectable(z, 'action', false)}
                    isDropTarget={((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null) || (state.targetSelectMode === 'place_action' && z === null)}
                    isActivatable={canActivateFieldCard}
                    contextualActions={showHandMenu ? <ContextMenu title="Choose card action">
                      {selectedCard.type !== CardType.CONDITION && <ContextMenuButton label="Activate" onClick={() => actions.handleActionFromHand(selectedCard, 'activate', i)} disabled={actionsDisabled || !checkActivationConditions(gameState, selectedCard, gameState.activePlayerIndex)} tone="green" />}
                      <ContextMenuButton label="Set Hidden" onClick={() => actions.handleActionFromHand(selectedCard, 'set', i)} disabled={actionsDisabled} />
                    </ContextMenu> : showFieldMenu ? <ContextMenu title={z!.card.name}>
                      <ContextMenuButton label={`Activate ${z!.card.type}`} onClick={() => actions.activateOnField(gameState.activePlayerIndex, 'action', i)} disabled={actionsDisabled || !canActivateFieldCard} tone="green" />
                    </ContextMenu> : null}
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
          <div className="health-hud-safe-hand absolute bottom-0 w-full flex justify-center space-x-[-10px] z-50 pointer-events-none pb-0" ref={actions.setRef(`${gameState.activePlayerIndex}-hand-container`)}>
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

          {state.shatterEffects.map(se => (
            <div key={se.id} className="shatter-container" style={{ left: `${se.x}%`, top: `${se.y}%` }}>
              {se.shards.map((s, idx) => (
                <div key={idx} className="shard" style={{ '--tx': s.tx, '--ty': s.ty, '--rot': s.rot } as React.CSSProperties}></div>
              ))}
            </div>
          ))}

          <GameOverlays gameState={gameState} activePlayer={activePlayer} state={state} actions={actions} actionsDisabled={actionsDisabled} onQuit={onQuit} />
        </div>

        <GameSidebar gameState={gameState} selectedCard={selectedCard} selectedFieldSlot={state.selectedFieldSlot} isOpen={state.isRightPanelOpen} setIsOpen={actions.setIsRightPanelOpen} />
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
