import { canTribute } from '../../game/cardHelpers';
import React from 'react';
import { createPortal } from 'react-dom';
import { CardType, Phase, Position, OpponentMode, PlaytestDebugSettings } from '../../types';
import { useGameLogic } from '../../hooks/useGameLogic';
import { checkActivationConditions, hasOnActivateEffect } from '../../game/cardHelpers';
import { CardDetail } from '../cards/CardDetail';
import { Pile, DeckPile } from './Pile';
import { Zone } from './Zone';
import { AttachmentOverlay } from './AttachmentOverlay';
import { AttackOverlay } from './AttackOverlay';
import { PileViewModal, DeckViewModal } from './GameModals';
import { ContextMenu, ContextMenuButton } from './ContextMenu';
import { GameOverlays } from './GameOverlays';
import { GameSidebar } from './GameSidebar';
import { HealthHud } from './HealthHud';
import { SavedDeck } from '../../decks';
import { fieldActivations } from '../../game/chains';
import { canAttack, canChangePosition as canChangePawnPosition } from '../../game/engine';
import { QuitDuelDialog } from './MatchModals';
import { getSettings } from '../../desktop/storage';
import { OpeningCoin } from './OpeningCoin';
import { CardSelectionModal } from './SelectionModals';
import { XrayOverlay } from './XrayOverlay';
import { fieldStats } from '../../game/cardHelpers';
import { SummonReverb, useSummonReverb } from './SummonReverb';
import './GameView.css';

interface GameViewProps {
  onQuit: () => void;
  opponentMode?: OpponentMode;
  initialDecks?: [SavedDeck | null, SavedDeck | null];
  debugSettings?: PlaytestDebugSettings;
}

/**
 * GameView Component
 * The core battle interface. Manages game state, turn logic, animations, and user interactions.
 */
const GameView: React.FC<GameViewProps> = ({ onQuit, initialDecks, opponentMode = 'self' as OpponentMode, debugSettings = {} as PlaytestDebugSettings }) => {
  const { gameState, state, actions } = useGameLogic(initialDecks, opponentMode, debugSettings);
  const summonReverbs = useSummonReverb(gameState);
  const [isQuitConfirmationOpen, setIsQuitConfirmationOpen] = React.useState(false);
  const [startingHandIndices, setStartingHandIndices] = React.useState<number[]>([]);
  const xray = opponentMode === 'ai' && !!debugSettings.xray;

  if (state.startingHandCards) return <CardSelectionModal
    title={`Choose starting hand (${startingHandIndices.length}/5)`}
    prompt="Select five card copies from your deck. The remaining deck stays shuffled."
    cards={state.startingHandCards} selectedIndex={null} selectedIndices={startingHandIndices} requiredCount={5}
    onSelect={index => { if (index !== null) setStartingHandIndices(current => current.includes(index)
      ? current.filter(value => value !== index) : current.length < 5 ? [...current, index] : current); }}
    onCancel={onQuit} onConfirmMulti={actions.chooseStartingHand}
    emptyLabel="No cards in deck" confirmLabel="Begin duel" theme="yellow" />;

  if (!gameState) return <div className="flex-1 flex items-center justify-center font-orbitron text-yellow-500 uppercase text-3xl">System Initialization...</div>;

  const effectCard = state.pendingEffectCard ?? state.triggeredEffect;
  const pendingConditionId = state.pendingTriggerType === 'activate' && state.pendingEffectCard?.type === CardType.CONDITION
    ? state.pendingEffectCard.instanceId : null;
  const displayActionCard = (zone: (typeof gameState.players)[number]['actionZones'][number]) =>
    zone && zone.card.instanceId === pendingConditionId && zone.position === Position.HIDDEN
      ? { ...zone, position: Position.FACE_UP }
      : zone;
  const selectingPlayer = effectCard ? gameState.pendingReactions?.find(entry => entry.card.instanceId === effectCard.instanceId)?.playerIndex
    ?? gameState.players.findIndex((p, index) =>
      p.pawnZones.some(z => z?.card.instanceId === effectCard.instanceId)
      || p.actionZones.some(z => z?.card.instanceId === effectCard.instanceId)
      || gameState.pendingReactions?.some(entry => entry.card.instanceId === effectCard.instanceId && entry.playerIndex === index)) : undefined;
  const privatePeek = gameState.peekEvents?.[0];
  const handSummonViewer = gameState.pendingHandSummons?.[0] && !gameState.response && !gameState.resolvingChain
    && !state.triggeredEffect && !state.pendingEffectCard ? gameState.pendingHandSummons[0].playerIndex : undefined;
  const viewIndex = opponentMode === 'ai' ? 0 : gameState.pendingVoidReturns?.[0]?.playerIndex ?? gameState.pendingVoidSelections?.[0]?.playerIndex ?? state.peekSelectionReq?.playerIndex ?? privatePeek?.viewerPlayerIndex ?? selectingPlayer ?? handSummonViewer ?? gameState.response?.priority ?? gameState.activePlayerIndex;
  const turnIsMine = !gameState.openingCoin && viewIndex === gameState.activePlayerIndex;
  const availableFieldEffects = fieldActivations(gameState, viewIndex);
  const activePlayer = gameState.players[viewIndex];
  const oppIdx = (viewIndex + 1) % 2;
  const opponent = gameState.players[oppIdx];
  const { fannedOutPiles, profileImage } = getSettings();
  const revealedOpponentCardId = gameState.peekEvents?.find(event => event.viewerPlayerIndex === viewIndex && event.ownerPlayerIndex === oppIdx)?.card.instanceId;
  const selectedCard = state.selectedHandIndex !== null ? activePlayer.hand[state.selectedHandIndex] : null;
  const isLightTheme = viewIndex === 1;
  const actionsDisabled = !turnIsMine || !!gameState.attackReplay || !!gameState.response || !!gameState.winner || !!gameState.pendingVoidReturns?.length || !!gameState.pendingVoidSelections?.length || !!gameState.pendingHandSummons?.length || state.pendingEffectCard !== null || state.triggeredEffect !== null || state.isPeekingField || state.discardSelectionReq !== null || state.handSelectionReq !== null || state.peekSelectionReq !== null || state.deckSelectionReq !== null || state.effectTributeReq !== null || !!gameState.peekEvents?.some(event => event.viewerPlayerIndex === viewIndex);
  const selectedPawnCanSummon = selectedCard?.type === CardType.PAWN && !actionsDisabled && actions.canPlayCard(selectedCard);
  const handSummonCard = gameState.pendingHandSummons?.[0]?.playerIndex === viewIndex
    ? activePlayer.hand.find(card => card.instanceId === state.handSummonCardId) : undefined;

  const isSelectedZone = (type: 'pawn' | 'action', index: number) =>
    state.selectedFieldSlot?.playerIndex === viewIndex &&
    state.selectedFieldSlot.type === type &&
    state.selectedFieldSlot.index === index;

  const canPawnAttack = (index: number) => canAttack(gameState, viewIndex, index);

  const pilePair = (player: typeof activePlayer, playerIndex: number) => (
    <div className={`game-field-side game-field-side--piles ${fannedOutPiles ? '' : 'game-field-side--compact-piles'}`}>
      {(playerIndex === oppIdx ? ['discard', 'void'] : ['void', 'discard']).map(pile => pile === 'void'
        ? <Pile key="void" cards={player.void} label="Void" color="purple" icon="fa-hurricane" fannedOut={fannedOutPiles} domRef={actions.setRef(`void-${playerIndex}`)} isFlashing={state.voidFlash[playerIndex]} onClick={() => actions.setViewingVoidIdx(playerIndex)} />
        : <Pile key="discard" cards={player.discard} label="Discard" color="slate" icon="fa-skull" fannedOut={fannedOutPiles} domRef={actions.setRef(`discard-${playerIndex}`)} isFlashing={state.discardFlash[playerIndex]} onClick={() => actions.setViewingDiscardIdx(playerIndex)} />)}
    </div>
  );

  const changePawnPosition = (index: number) => {
    if (!actionsDisabled) actions.changePosition(index);
    actions.setSelectedFieldSlot(null);
  };

  const checkIsSelectable = (z: typeof activePlayer.pawnZones[0], zoneType: 'pawn' | 'action', playerIndex: number) => {
    const isOpponent = playerIndex !== viewIndex;
    if (isOpponent && zoneType === 'pawn' && state.targetSelectMode === 'attack') return true;
    if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
      if (state.targetSelectType !== 'any' && state.targetSelectType !== zoneType) return false;
      if (state.targetSelectScope === 'active' && isOpponent) return false;
      if (state.targetSelectScope === 'opponent' && !isOpponent) return false;
      if (!z) return false;
      if (state.targetSelectFilter && !state.targetSelectFilter(z.card)) return false;
      if (state.targetSelectPosition === 'both') return true;
      if (state.targetSelectPosition === 'hidden' && z.position === Position.HIDDEN) return true;
      if (state.targetSelectPosition === 'faceup' && z.position !== Position.HIDDEN) return true;
    }
    return false;
  };

  return (
    <div className={`duel-screen ${isLightTheme ? 'duel-screen--light' : 'duel-screen--dark'} flex-1 flex flex-col relative overflow-hidden font-roboto select-none transition-colors duration-1000`}>
      {/* HUD: Exit Control */}
      <OpeningCoin gameState={gameState} opponentMode={opponentMode} onChoose={actions.chooseTurnOrder} />
      <AttachmentOverlay />
      <AttackOverlay
        attack={gameState.deferredAction?.kind === 'attack' ? gameState.deferredAction : undefined}
        defendingPlayerId={gameState.players[1 - gameState.activePlayerIndex].id}
      />
      <div className="game-corner-controls absolute left-4 top-4 z-40">
        <button data-sound="select-small" type="button" onClick={() => setIsQuitConfirmationOpen(true)} className="game-corner-button game-corner-button--primary">
          <span className="game-corner-button__icon" aria-hidden="true"><i className="fa-solid fa-power-off" /></span>
          <span>QUIT DUEL</span>
        </button>
        <button data-sound="select-small" type="button" onClick={() => actions.setIsDeckViewerOpen(true)} className="game-corner-button game-corner-button--secondary">
          <span className="game-corner-button__icon" aria-hidden="true"><i className="fa-solid fa-layer-group" /></span>
          <span>DECK LIST</span>
          <i className="fa-solid fa-chevron-right game-corner-button__detail" aria-hidden="true" />
        </button>
        <button
          data-sound="toggle"
          type="button"
          aria-label="Toggle activation pop-ups"
          aria-pressed={state.activationPopupsEnabled}
          onClick={() => actions.setActivationPopupsEnabled(!state.activationPopupsEnabled)}
          className={`game-corner-button game-corner-button--secondary ${state.activationPopupsEnabled ? 'is-active' : ''}`}
        >
          <span className="game-corner-button__icon" aria-hidden="true"><i className={`fa-solid ${state.activationPopupsEnabled ? 'fa-bell' : 'fa-bell-slash'}`} /></span>
          <span>POP-UPS {state.activationPopupsEnabled ? 'ON' : 'OFF'}</span>
          <span className="game-corner-button__status" aria-hidden="true" />
        </button>
      </div>

      {isQuitConfirmationOpen && (
        <QuitDuelDialog
          onCancel={() => setIsQuitConfirmationOpen(false)}
          onConfirm={onQuit}
        />
      )}

      <div className="flex-1 flex relative overflow-hidden">
        {/* Main Play Area */}
        <div className="duel-arena flex-1 flex flex-col items-center justify-between p-4 relative overflow-hidden">
          <HealthHud
            player={opponent}
            profileImage={opponent.id === 'player1' ? profileImage : null}
            displayedLp={state.displayedLp[oppIdx]}
            flash={state.lpFlash[oppIdx]}
            position="opponent"
          />
          <HealthHud
            player={activePlayer}
            profileImage={activePlayer.id === 'player1' ? profileImage : null}
            displayedLp={state.displayedLp[viewIndex]}
            flash={state.lpFlash[viewIndex]}
            position="active"
          />

          {/* Opponent Hand (Semi-Visible) */}
          <div data-player-hand-target={opponent.id} className="duel-opponent-hand absolute top-0 w-full flex justify-center space-x-[-10px] z-20 pointer-events-none">
            {opponent.hand.map((card, i) => (
              <div ref={actions.setRef(`${oppIdx}-hand-${i}`)} key={card.instanceId} role={xray ? 'button' : undefined} tabIndex={xray ? 0 : undefined} aria-label={xray ? `Inspect AI hand card ${i + 1}` : undefined} onClick={() => { if (xray) actions.inspectPileCard(card); }} onKeyDown={event => { if (xray && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); actions.inspectPileCard(card); } }} className="opponent-hand-slot w-28 aspect-[2/3] transform -translate-y-[60%] hover:translate-y-[-10%] transition-transform duration-300 cursor-pointer pointer-events-auto">
                <div className={`opponent-hand-card ${revealedOpponentCardId === card.instanceId ? 'is-revealing' : ''}`}>
                  <div className="opponent-hand-face opponent-hand-back card-back rounded shadow-2xl border-2 border-slate-300">{xray && <XrayOverlay card={card} />}</div>
                  <div className="opponent-hand-face opponent-hand-front rounded shadow-2xl"><CardDetail card={card} compact className="h-full w-full" /></div>
                </div>
              </div>
            ))}
          </div>

          <div inert={state.cardMovementPending} className={`game-board duel-stage ${fannedOutPiles ? '' : 'game-board--compact'} relative z-10 flex flex-col ${fannedOutPiles ? 'space-y-4' : 'space-y-7'} transform scale-100 transition-transform duration-500 items-center justify-center flex-1 w-full h-full mt-12 mb-20`}>
            {/* Opponent Field View */}
            <div className={`game-player-field duel-player-field--opponent flex flex-col items-center ${fannedOutPiles ? 'space-y-4' : 'space-y-7'} opacity-90`}>
              <div className="game-field-row">
                <div className="game-field-zones game-field-zones--actions">
                  {opponent.actionZones.map((z, i) => (<Zone key={i} card={displayActionCard(z)} xray={xray} type="action" domRef={actions.setRef(`${oppIdx}-action-${i}`)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'action' && state.selectedFieldSlot?.index === i} isSelectable={checkIsSelectable(z, 'action', oppIdx)} onClick={() => {
                    if (xray && z?.position === Position.HIDDEN && !state.targetSelectMode) actions.setIsRightPanelOpen(true);
                    if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                      if (checkIsSelectable(z, 'action', oppIdx)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: oppIdx, type: 'action', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                    }
                    else actions.setSelectedFieldSlot({ playerIndex: oppIdx, type: 'action', index: i })
                  }} />))}
                </div>
                <div className={`game-field-side ${fannedOutPiles ? '' : 'game-field-side--compact-deck'}`}>
                  <DeckPile count={opponent.deck.length} label="AI deck" domRef={actions.setRef(`deck-${oppIdx}`)} xrayCard={xray ? opponent.deck[0] : undefined} onInspect={() => actions.inspectPileCard(opponent.deck[0])} />
                </div>
              </div>
              <div className="game-field-row game-field-row--pawns">
                <div className="game-field-zones game-field-zones--pawns">
                  <SummonReverb reverbs={summonReverbs.filter(event => event.playerIndex === oppIdx)} />
                  {opponent.pawnZones.map((z, i) => (<Zone key={i} card={z} fieldStats={z ? fieldStats(gameState, z) : undefined} xray={xray} type="pawn" domRef={actions.setRef(`${oppIdx}-pawn-${i}`)} isVisuallyHidden={!!z && state.visuallyDestroyedCardIds.includes(z.card.instanceId)} isSelected={state.selectedFieldSlot?.playerIndex === oppIdx && state.selectedFieldSlot?.type === 'pawn' && state.selectedFieldSlot?.index === i} isSelectable={checkIsSelectable(z, 'pawn', oppIdx)} onClick={() => {
                    if (xray && z?.position === Position.HIDDEN && !state.targetSelectMode) actions.setIsRightPanelOpen(true);
                    if (state.targetSelectMode === 'attack' && state.selectedFieldSlot) {
                      const hasMonsters = opponent.pawnZones.some(mz => mz !== null);
                      if (hasMonsters) {
                        if (opponent.pawnZones[i]) actions.handleAttack(state.selectedFieldSlot.index, i);
                      } else {
                        actions.handleAttack(state.selectedFieldSlot.index, 'direct');
                      }
                    }
                    else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                      if (checkIsSelectable(z, 'pawn', oppIdx)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: oppIdx, type: 'pawn', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                    }
                    else actions.setSelectedFieldSlot({ playerIndex: oppIdx, type: 'pawn', index: i });
                  }} />))}
                </div>
                {pilePair(opponent, oppIdx)}
              </div>
            </div>

            <div className="phase-track" role="group" aria-label="Turn phases">
              {[
                [Phase.DRAW, 'Draw'],
                [Phase.STANDBY, 'Standby'],
                [Phase.MAIN1, 'Main 1'],
                [Phase.BATTLE, 'Battle'],
                [Phase.MAIN2, 'Main 2'],
                [Phase.END, 'End'],
              ].map(([phase, label]) => (
                <span key={phase} className={`phase-track__step ${gameState.currentPhase === phase ? 'is-current' : ''}`} aria-current={gameState.currentPhase === phase ? 'step' : undefined}>
                  {label}
                </span>
              ))}
            </div>

            {/* Active Player Field View */}
            <div className={`game-player-field duel-player-field--active flex flex-col items-center ${fannedOutPiles ? 'space-y-4' : 'space-y-7'}`}>
              <div className="game-field-row game-field-row--pawns">
                <div className="game-field-zones game-field-zones--pawns">
                  <SummonReverb reverbs={summonReverbs.filter(event => event.playerIndex === viewIndex)} />
                  {activePlayer.pawnZones.map((z, i) => {
                    const selected = isSelectedZone('pawn', i);
                    const canChangePosition = canChangePawnPosition(gameState, viewIndex, i);
                    const canActivateEffect = availableFieldEffects.some(a => a.slot.type === 'pawn' && a.slot.index === i);
                    const attackReady = canPawnAttack(i);
                    const selectedCardCanTributeSummon = selectedCard?.type === CardType.PAWN && selectedCard.level >= 5;
                    const canChooseSummonMethod = selectedPawnCanSummon && (!z || selectedCardCanTributeSummon);
                    const choosingEffectPlacement = state.pawnPlacementReq?.playerIndex === viewIndex;
                    const showEffectPlacementMenu = choosingEffectPlacement && selected && !z;
                    const showHandSummonMenu = selected && !z && !!handSummonCard;
                    const showHandMenu = !gameState.pendingHandSummons?.length && selected && canChooseSummonMethod && !state.targetSelectMode && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2);
                    const showFieldMenu = !gameState.pendingHandSummons?.length && !state.responseFieldMode && selected && !!z && !state.targetSelectMode && !selectedCard && (
                      ((gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && (canChangePosition || hasOnActivateEffect(z.card))) ||
                      gameState.currentPhase === Phase.BATTLE
                    );
                    return <Zone key={i} card={z} fieldStats={z ? fieldStats(gameState, z) : undefined} type="pawn" domRef={actions.setRef(`${viewIndex}-pawn-${i}`)}
                      isVisuallyHidden={!!z && state.visuallyDestroyedCardIds.includes(z.card.instanceId)}
                      isSelected={selected}
                      isTributeSelected={state.tributeSelection.includes(i)}
                      isSelectable={checkIsSelectable(z, 'pawn', viewIndex)}
                      isDropTarget={(choosingEffectPlacement && !z) || (!!handSummonCard && !z) || (selectedPawnCanSummon && (z === null || selectedCardCanTributeSummon)) || (state.targetSelectMode === 'place_pawn' && actions.canPlacePawn(i))}
                      isActivatable={attackReady}
                      contextualActions={showEffectPlacementMenu ? <ContextMenu title="Pawn position">
                        {(state.pawnPlacementReq?.position ? [state.pawnPlacementReq.position] : [Position.ATTACK, Position.DEFENSE]).map(position => <ContextMenuButton key={position} label={position} onClick={() => { actions.handlePawnPlacement(i, position); actions.setSelectedFieldSlot(null); }} tone={position === Position.ATTACK ? 'gold' : undefined} />)}
                      </ContextMenu> : showHandSummonMenu ? <ContextMenu title="Special summon position">
                        <ContextMenuButton label="Attack" onClick={() => actions.confirmHandSummon(i, Position.ATTACK)} tone="gold" />
                        <ContextMenuButton label="Defense" onClick={() => actions.confirmHandSummon(i, Position.DEFENSE)} />
                      </ContextMenu> : showHandMenu ? <ContextMenu title="Choose summon method">
                        <ContextMenuButton label={selectedCard.level >= 5 ? 'Tribute Summon' : 'Normal Summon'} onClick={() => actions.handleSummon(selectedCard, 'normal', i)} disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.normalSummonUsed)} tone="gold" />
                        <ContextMenuButton label={selectedCard.level >= 5 ? 'Tribute Set' : 'Set Hidden'} onClick={() => actions.handleSummon(selectedCard, 'hidden', i)} disabled={actionsDisabled || (selectedCard.level <= 4 && activePlayer.hiddenSummonUsed)} />
                      </ContextMenu> : showFieldMenu ? <ContextMenu title={z!.card.name}>
                        {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && <ContextMenuButton label={z!.position === Position.HIDDEN ? 'Switch Summon' : 'Change Position'} onClick={() => changePawnPosition(i)} disabled={actionsDisabled || !canChangePosition} />}
                        {(gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2) && hasOnActivateEffect(z!.card) && <ContextMenuButton label="Activate Effect" onClick={() => actions.activateOnField(viewIndex, 'pawn', i)} disabled={actionsDisabled || !canActivateEffect} tone="purple" />}
                        {gameState.currentPhase === Phase.BATTLE && <ContextMenuButton label={attackReady ? 'Attack' : 'Cannot Attack'} onClick={() => actions.setTargetSelectMode('attack')} disabled={actionsDisabled || !attackReady} tone="red" />}
                      </ContextMenu> : null}
                      onClick={() => {
                        if (choosingEffectPlacement || handSummonCard) {
                          actions.setSelectedFieldSlot(!z ? { playerIndex: viewIndex, type: 'pawn', index: i } : null);
                        } else if (state.targetSelectMode === 'place_pawn' && actions.canPlacePawn(i)) {
                          actions.handlePlacement(i);
                        } else if (state.targetSelectMode === 'tribute') {
                          if (z && canTribute(z.card)) {
                            if (state.effectTributeReq?.filter && !state.effectTributeReq.filter(z.card)) return; // Prevent invalid sacrifice
                            actions.setTributeSelection(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
                          }
                        } else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                          if (checkIsSelectable(z, 'pawn', viewIndex)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: viewIndex, type: 'pawn', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                        } else if (canChooseSummonMethod && !state.targetSelectMode) {
                          actions.setSelectedFieldSlot({ playerIndex: viewIndex, type: 'pawn', index: i });
                        } else {
                          actions.setSelectedFieldSlot(z ? { playerIndex: viewIndex, type: 'pawn', index: i } : null);
                          actions.setSelectedHandIndex(null);
                        }
                      }} />;
                  })}
                </div>
                {pilePair(activePlayer, viewIndex)}
              </div>
              <div className="game-field-row">
                <div className="game-field-zones game-field-zones--actions">
                  {activePlayer.actionZones.map((z, i) => {
                    const selected = isSelectedZone('action', i);
                    const canActivateFieldCard = availableFieldEffects.some(a => a.slot.type === 'action' && a.slot.index === i);
                    const showHandMenu = selected && !z && !!selectedCard && selectedCard.type !== CardType.PAWN && !state.targetSelectMode && (gameState.currentPhase === Phase.MAIN1 || gameState.currentPhase === Phase.MAIN2);
                    const showFieldMenu = !state.responseFieldMode && selected && !!z && !selectedCard && !state.targetSelectMode && canActivateFieldCard;
                    return <Zone key={i} card={displayActionCard(z)} type="action" domRef={actions.setRef(`${viewIndex}-action-${i}`)}
                      isSelected={selected}
                      isSelectable={checkIsSelectable(z, 'action', viewIndex)}
                      isDropTarget={((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null) || (state.targetSelectMode === 'place_action' && z === null)}
                      isActivatable={canActivateFieldCard}
                      contextualActions={showHandMenu ? <ContextMenu title="Choose card action">
                        {selectedCard.type !== CardType.CONDITION && <ContextMenuButton label="Activate" onClick={() => actions.handleActionFromHand(selectedCard, 'activate', i)} disabled={actionsDisabled || !checkActivationConditions(gameState, selectedCard, viewIndex)} tone="green" />}
                        <ContextMenuButton label="Set Hidden" onClick={() => actions.handleActionFromHand(selectedCard, 'set', i)} disabled={actionsDisabled} />
                      </ContextMenu> : showFieldMenu ? <ContextMenu title={z!.card.name}>
                        <ContextMenuButton label={`Activate ${z!.card.type}`} onClick={() => actions.activateOnField(viewIndex, 'action', i)} disabled={actionsDisabled || !canActivateFieldCard} tone="green" />
                      </ContextMenu> : null}
                      onClick={() => {
                        if (state.targetSelectMode === 'place_action' && z === null) {
                          actions.handlePlacement(i);
                        } else if (state.targetSelectMode === 'effect' && state.pendingEffectCard) {
                          if (checkIsSelectable(z, 'action', viewIndex)) actions.resolveEffect(state.pendingEffectCard, { playerIndex: viewIndex, type: 'action', index: i }, undefined, undefined, undefined, state.pendingTriggerType || 'activate');
                        } else if ((selectedCard?.type === CardType.ACTION || selectedCard?.type === CardType.CONDITION) && z === null && !state.targetSelectMode) {
                          actions.setSelectedFieldSlot({ playerIndex: viewIndex, type: 'action', index: i });
                        } else {
                          actions.setSelectedFieldSlot(z ? { playerIndex: viewIndex, type: 'action', index: i } : null);
                          actions.setSelectedHandIndex(null);
                        }
                      }} />;
                  })}
                </div>
                <div className={`game-field-side ${fannedOutPiles ? '' : 'game-field-side--compact-deck'}`}>
                  <DeckPile count={activePlayer.deck.length} label="Your deck" domRef={actions.setRef(`deck-${viewIndex}`)} xrayCard={xray ? activePlayer.deck[0] : undefined} onInspect={() => actions.inspectPileCard(activePlayer.deck[0])} />
                </div>
              </div>
            </div>
          </div>

          {/* Active Player Hand Display (Bottom) */}
          <div data-player-hand-target={activePlayer.id} className="health-hud-safe-hand duel-active-hand absolute bottom-0 w-full flex justify-center space-x-[-10px] z-50 pointer-events-none pb-0" ref={actions.setRef(`${viewIndex}-hand-container`)}>
            {activePlayer.hand.map((card, i) => {
              const isActivatable = !actionsDisabled && actions.canPlayCard(card);
              return (
                <div key={card.instanceId} className={`relative w-36 pointer-events-none transition-transform duration-300 ${state.selectedHandIndex === i ? 'translate-y-[-20%] z-20' : 'translate-y-[30%] hover:translate-y-[0%] z-10 hover:z-20'}`}>
                  {state.selectedHandIndex === i && card.type === CardType.PAWN && card.level >= 5 && (
                    <div className="tribute-indicators" aria-label={`${card.level <= 7 ? 1 : 2} tribute pawns required`}>
                      {Array.from({ length: card.level <= 7 ? 1 : 2 }, (_, tribute) => (
                        <div key={tribute} className="tribute-indicator" aria-hidden="true"><i className="fa-solid fa-chess-pawn" /></div>
                      ))}
                    </div>
                  )}
                  <CardDetail
                    card={card}
                    domRef={actions.setRef(`${viewIndex}-hand-${i}`)}
                    onClick={() => { if (actionsDisabled) return; actions.setSelectedHandIndex(i); actions.setSelectedFieldSlot(null); }}
                    compact={true}
                    className={`w-full rounded cursor-pointer border-2 border-slate-300 shadow-2xl pointer-events-auto ${state.selectedHandIndex === i ? 'ring-4 ring-yellow-500' : ''} ${isActivatable ? 'glow-activatable' : ''}`}
                  />
                </div>
              )
            })}
          </div>

          {/* Render Active Animations (Flying Cards, Vortices, Floating Texts, Shatters) */}
          {createPortal(<>
          {state.cardMotions.map(motion => (
            <div key={motion.id} className={`card-travel ${motion.activation ? 'card-travel-activation' : ''}`}
              onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'card-zone-travel') state.finishMotion(motion.id); }}
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
            <div key={se.id} className="shatter-container" style={{
              left: se.left,
              top: se.top,
              width: se.width,
              height: se.height,
              '--card-width': `${se.width}px`,
              '--card-height': `${se.height}px`,
            } as React.CSSProperties}>
              <div className="shatter-impact" aria-hidden="true" />
              {se.shards.map((s, idx) => (
                <div key={idx} className="shard" style={{
                  left: s.x,
                  top: s.y,
                  width: s.width,
                  height: s.height,
                  clipPath: s.clipPath,
                  '--shard-x': `${s.x}px`,
                  '--shard-y': `${s.y}px`,
                  '--tx': s.tx,
                  '--ty': s.ty,
                  '--rot': s.rot,
                  '--delay': s.delay,
                } as React.CSSProperties}>
                  <div className="shatter-card-copy">
                    <div
                      className={`shatter-card-source ${se.rotated ? 'shatter-card-source--rotated' : ''} ${se.faceDown ? 'card-back' : ''}`}
                      dangerouslySetInnerHTML={{ __html: se.cardMarkup }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
          </>, document.body)}

          <GameOverlays gameState={gameState} activePlayer={activePlayer} state={state} actions={actions} actionsDisabled={actionsDisabled} viewerIndex={viewIndex} onQuit={onQuit} />
        </div>

        <GameSidebar viewerIndex={viewIndex} xray={xray} gameState={gameState} selectedCard={selectedCard} inspectedCard={state.inspectedPileCard} selectedFieldSlot={state.selectedFieldSlot} isOpen={state.isRightPanelOpen} setIsOpen={actions.setIsRightPanelOpen} />
      </div>

      <PileViewModal
        viewingDiscardIdx={state.viewingDiscardIdx}
        viewingVoidIdx={state.viewingVoidIdx}
        gameState={gameState}
        setViewingDiscardIdx={actions.setViewingDiscardIdx}
        setViewingVoidIdx={actions.setViewingVoidIdx}
        onSelectCard={actions.inspectPileCard}
      />

      <DeckViewModal
        isOpen={state.isDeckViewerOpen}
        onClose={() => actions.setIsDeckViewerOpen(false)}
        deck={activePlayer.initialDeck}
        playerName={activePlayer.name}
        deckName={activePlayer.deckName ?? (viewIndex === 0 ? initialDecks?.[0]?.name : initialDecks?.[1]?.name) ?? 'Random test deck'}
      />
    </div>
  );
};

export default GameView;
