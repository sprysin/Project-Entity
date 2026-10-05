import { handSummonCandidates, handSummonSource } from '../../game/summonReactions';
import { cardRegistry } from '../../cards/CardRegistry';
import React, { useEffect, useRef, useState } from 'react';
import type { useGameLogic } from '../../hooks/useGameLogic';
import { GameState, Phase, Player } from '../../types';
import { isDrawingForTurn } from '../../game/phases';
import { LevelTributeSelectionModal, ReserveSelectionModal, ShuffleSelectionModal, VoidSelectionModal } from './SelectionModals';
import { checkActivationConditions } from '../../game/cardHelpers';
import { DeckSelectionModal, DiscardSelectionModal, EffectModal, HandSelectionModal, PeekSelectionModal, WinnerModal } from './GameModals';
import { DuelPrompt } from './DuelPrompt';
import { CardDetail } from '../cards/CardDetail';

type GameLogic = ReturnType<typeof useGameLogic>;

const HOLD_TO_END_MS = 650;

const PeekAutoDismiss: React.FC<{ eventId: string; dismiss: (id: string) => void }> = ({ eventId, dismiss }) => {
    const dismissRef = useRef(dismiss);
    dismissRef.current = dismiss;
    useEffect(() => {
        const timer = setTimeout(() => dismissRef.current(eventId), 3100);
        return () => clearTimeout(timer);
    }, [eventId]);
    return null;
};

const PhaseAdvanceButton: React.FC<{
    disabled: boolean;
    phase: GameState['currentPhase'];
    nextPhase: () => void;
    skipToEndPhase: () => void;
}> = ({ disabled, phase, nextPhase, skipToEndPhase }) => {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const held = useRef(false);
    const [holding, setHolding] = useState(false);
    const cancelHold = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setHolding(false);
    };
    const startHold = () => {
        if (disabled || timer.current || held.current) return;
        held.current = false;
        setHolding(true);
        timer.current = setTimeout(() => {
            timer.current = null;
            held.current = true;
            setHolding(false);
            skipToEndPhase();
        }, HOLD_TO_END_MS);
    };
    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    return (
        <button
            data-sound="select"
            disabled={disabled}
            onPointerDown={event => {
                if (disabled || event.button !== 0) return;
                startHold();
            }}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onKeyDown={event => {
                if (event.key === ' ') startHold();
            }}
            onKeyUp={event => {
                if (event.key === ' ') cancelHold();
            }}
            onBlur={cancelHold}
            onClick={event => {
                if (held.current) {
                    held.current = false;
                    event.preventDefault();
                    return;
                }
                nextPhase();
            }}
            className={`relative flex flex-col items-center justify-center overflow-hidden bg-yellow-600 px-4 py-2 font-orbitron font-bold uppercase text-white shadow-lg hover:bg-yellow-500 ${disabled ? 'opacity-50 grayscale' : ''}`}
            aria-label="Next phase. Hold to skip to End Phase."
        >
            {holding && <span className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[hold-fill_650ms_linear_forwards] bg-white" />}
            <span className="whitespace-nowrap text-xl leading-none tracking-tighter">Next phase</span>
            <span className="font-orbitron text-[10px] font-bold italic tracking-widest opacity-90">({phase})</span>
        </button>
    );
};

export const GameOverlays: React.FC<{
    gameState: GameState;
    activePlayer: Player;
    state: GameLogic['state'];
    actions: GameLogic['actions'];
    actionsDisabled: boolean;
    viewerIndex: number;
    onQuit: () => void;
}> = ({ gameState, state, actions, actionsDisabled, viewerIndex, onQuit }) => {
    const [responseSelection, setResponseSelection] = useState<{ request: GameState['response']; cardId: string } | null>(null);
    const selectedResponse = responseSelection?.request === gameState.response
        ? state.responseOptions.find(option => option.card.instanceId === responseSelection?.cardId)
        : undefined;
    return (
    <>
        {state.floatingTexts.map(text => (
            <div key={text.id} className={`floating-text text-6xl ${text.type === 'damage' ? 'text-red-600' : 'text-green-500'}`} style={{ left: `${text.x}%`, top: `${text.y}%` }}>{text.text}</div>
        ))}
        {gameState.resolvingChain && (
            <div role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 border border-yellow-500 bg-slate-950/95 px-5 py-3 text-center shadow-lg">
                <div className="font-orbitron text-[10px] uppercase tracking-widest text-yellow-400">Chain resolving · {gameState.resolvingChain.current} / {gameState.resolvingChain.total}</div>
                <div className="mt-1 text-sm font-bold text-white">{gameState.resolvingChain.cardName}</div>
            </div>
        )}

        {!state.cardMovementPending && <>
        {gameState.attackReplay && !(state.opponentMode === 'ai' && gameState.activePlayerIndex === 1) && (
            gameState.attackReplay.choosingTarget
                ? <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2"><button data-sound="cancellation" className="border border-white/10 bg-slate-800 px-4 py-2 font-orbitron text-[10px] font-bold uppercase text-slate-200 hover:bg-slate-700" onClick={() => actions.chooseAttackReplay(false)}>Cancel attack</button></div>
                : <DuelPrompt ariaLabel="Attack target left the field" title={`${gameState.players[gameState.activePlayerIndex].name}: Attempt another attack?`}
                    actions={[
                        { label: 'Cancel attack', onClick: () => actions.chooseAttackReplay(false), variant: 'secondary' },
                        { label: 'Attempt another attack', onClick: () => actions.chooseAttackReplay(true), variant: 'primary' }
                    ]}><p>The attacked Pawn left the field. Choose another target or cancel this attack.</p></DuelPrompt>
        )}
        {state.showResponsePopup && gameState.response && !gameState.response.ready && state.responseOptions.length > 0 && !state.pendingEffectCard && !state.triggeredEffect && !(state.opponentMode === 'ai' && gameState.response.priority === 1) && (
            <DuelPrompt
                className="duel-prompt--response"
                ariaLabel="Response window"
                title={<>
                    <span className="duel-prompt__response-title">{gameState.response.reason.startsWith('Leave ')
                        ? `${gameState.activePlayerIndex === gameState.response.priority ? 'You' : 'Opponent'} Leaving ${gameState.response.reason.slice(6)}`
                        : gameState.response.reason}</span>
                    <span>-</span>
                    <span>Activate a card or effect?</span>
                </>}
                peeking={state.responseFieldMode === 'peek'}
                setPeeking={peeking => actions.setResponseFieldMode(peeking ? 'peek' : null)}
                onBackdropClick={actions.passResponse}
                actions={[
                    { label: 'Decline', onClick: actions.passResponse, variant: 'secondary' },
                    { label: 'Activate', variant: 'primary', disabled: !selectedResponse, onClick: () => {
                        if (!selectedResponse) return;
                        setResponseSelection(null);
                        actions.respond(selectedResponse.card.instanceId);
                    } },
                ]}
            >
                {!!gameState.chain?.length && <ol className="duel-prompt__chain">{gameState.chain.map((link, i) => <li key={i}>{i + 1}. {link.context.card.name}{i === gameState.chain!.length - 1 ? ' · resolves first' : ''}</li>)}</ol>}
                <div className="response-cards" role="group" aria-label="Activatable response cards">
                    {state.responseOptions.map(({ card, slot }) => {
                        const player = gameState.players[slot.playerIndex];
                        const zone = player[slot.type === 'pawn' ? 'pawnZones' : 'actionZones'][slot.index];
                        return <button key={card.instanceId} type="button" data-sound="select-small"
                            className={`duel-card-choice response-cards__card ${selectedResponse?.card.instanceId === card.instanceId ? 'is-selected' : ''}`}
                            aria-label={`Select ${card.name}`}
                            aria-pressed={selectedResponse?.card.instanceId === card.instanceId}
                            onClick={() => {
                                setResponseSelection({ request: gameState.response, cardId: card.instanceId });
                                actions.setSelectedHandIndex(null);
                                actions.setSelectedFieldSlot(slot);
                                actions.setIsRightPanelOpen(true);
                            }}>
                            <CardDetail card={card} counters={zone?.counters} className="w-full h-full" />
                        </button>;
                    })}
                </div>
            </DuelPrompt>
        )}
        </>}
        {state.opponentMode === 'ai' && !isDrawingForTurn(gameState) && !gameState.pendingResponse && !gameState.response?.ready
            && !gameState.resolvingChain && (gameState.response || [Phase.MAIN1, Phase.MAIN2, Phase.BATTLE].includes(gameState.currentPhase))
            && (gameState.activePlayerIndex === 1 || gameState.response?.priority === 1) && !gameState.winner
            && <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 border border-yellow-600 bg-slate-950 px-4 py-2 text-sm text-yellow-400">{gameState.response?.priority === 0 ? 'Your response' : 'AI is thinking…'}</div>}
        {gameState.winner && <WinnerModal gameState={gameState} isDefeat={state.opponentMode === 'ai' && gameState.winner !== gameState.players[0].name} onQuit={onQuit} />}
        {!state.cardMovementPending && <>
        {!gameState.winner && gameState.pendingVoidSelections?.length
            && !(state.opponentMode === 'ai' && gameState.pendingVoidSelections[0].playerIndex === 1)
            ? <VoidSelectionModal gameState={gameState} onConfirm={actions.chooseVoidCard} /> : null}
        <ShuffleSelectionModal request={state.shuffleSelectionReq} gameState={gameState} onConfirm={actions.handleShuffleSelection} />
        <LevelTributeSelectionModal request={state.levelTributeReq} gameState={gameState} onConfirm={actions.handleLevelTribute} onCancel={actions.cancelEffect} />
        <ReserveSelectionModal request={state.reserveSelectionReq} gameState={gameState} onConfirm={actions.handleReserveSelection} onCancel={actions.cancelEffect} />
        {gameState.pendingHandSummons?.length && !state.handSummonCardId && !state.triggeredEffect && !state.pendingEffectCard && !gameState.response && !gameState.resolvingChain
            && !(state.opponentMode === 'ai' && gameState.pendingHandSummons[0].playerIndex === 1)
            && <PeekSelectionModal
                selectionReq={{
                    playerIndex: gameState.pendingHandSummons[0].playerIndex,
                    viewerPlayerIndex: gameState.pendingHandSummons[0].playerIndex,
                    title: handSummonSource(gameState, gameState.pendingHandSummons[0])?.card.name ?? 'Special Summon',
                    prompt: cardRegistry.getEffect(handSummonSource(gameState, gameState.pendingHandSummons[0])?.card.id ?? '')?.handSummonPrompt ?? 'Choose a Pawn'
                }}
                gameState={gameState}
                selectedPeekIndex={state.handSummonSelectedHandIndex}
                setSelectedPeekIndex={actions.setHandSummonSelectedHandIndex}
                cancelEffect={() => actions.declineHandSummon(gameState.pendingHandSummons![0].sourceId)}
                handlePeekSelection={actions.handSummonChooseCard}
                filter={card => handSummonCandidates(gameState, gameState.pendingHandSummons[0]).some(candidate => candidate.instanceId === card.instanceId)}
                confirmLabel="Choose Pawn"
                cancellable
            />}
        <HandSelectionModal selectionReq={state.handSelectionReq} gameState={gameState} selectedHandSelectionIndex={state.selectedHandSelectionIndex} setSelectedHandSelectionIndex={actions.setSelectedHandSelectionIndex} setHandSelectionReq={actions.cancelEffect} handleHandSelection={actions.handleHandSelection} />
        <PeekSelectionModal selectionReq={state.peekSelectionReq} gameState={gameState} selectedPeekIndex={state.selectedPeekIndex} setSelectedPeekIndex={actions.setSelectedPeekIndex} cancelEffect={actions.cancelEffect} handlePeekSelection={actions.handlePeekSelection} />
        {gameState.peekEvents?.filter(event => event.viewerPlayerIndex === viewerIndex).slice(0, 1).map(event => <PeekAutoDismiss key={event.id} eventId={event.id} dismiss={actions.dismissPeek} />)}
        <DiscardSelectionModal selectionReq={state.discardSelectionReq} gameState={gameState} selectedDiscardIndex={state.selectedDiscardIndex} setSelectedDiscardIndex={actions.setSelectedDiscardIndex} handleDiscardSelection={actions.handleDiscardSelection} />
        <DeckSelectionModal selectionReq={state.deckSelectionReq} gameState={gameState} selectedDeckIndex={state.selectedDeckIndex} setSelectedDeckIndex={actions.setSelectedDeckIndex} handleDeckSelection={actions.handleDeckSelection} />
        <EffectModal triggeredEffect={state.triggeredEffect} gameState={gameState} isPeekingField={state.isPeekingField} resolveEffect={card => actions.resolveEffect(card, undefined, undefined, undefined, undefined, state.pendingTriggerType || 'activate')} checkActivationConditions={checkActivationConditions} setIsPeekingField={actions.setIsPeekingField} setTriggeredEffect={actions.setTriggeredEffect} setPendingEffectCard={actions.setPendingEffectCard} declineReaction={actions.declineReaction} />
        {state.effectChoiceReq?.some(choice => !choice.disabled) && (
            <DuelPrompt className="duel-prompt--effect-choice" ariaLabel="Choose card effect" title={state.pendingEffectCard?.name}
                peeking={state.isPeekingField} setPeeking={actions.setIsPeekingField}
                onBackdropClick={actions.cancelEffect}
                actions={[
                    ...state.effectChoiceReq.map(choice => ({ label: choice.label, disabled: choice.disabled,
                        variant: 'primary' as const, onClick: () => actions.handleEffectChoice(choice.id) })),
                    { label: 'Cancel', onClick: actions.cancelEffect }
                ]} />
        )}
        </>}

        {state.phaseFlash && (
            <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center overflow-hidden">
                <div key={gameState.turnNumber + gameState.currentPhase} className="phase-slide flex w-full items-center justify-center border-y border-yellow-500/30 bg-black/80 py-3 backdrop-blur-sm">
                    <div className="pl-[0.8em] text-center font-orbitron text-2xl font-bold uppercase tracking-[0.8em] text-white md:text-4xl">{state.phaseFlash}</div>
                </div>
            </div>
        )}
        {state.turnFlash && (
            <div className="pointer-events-none absolute inset-0 z-[65] flex items-center justify-center overflow-hidden">
                <div key={state.turnFlash} className="turn-slide flex w-full items-center justify-center border-y-8 border-yellow-400 bg-yellow-600/90 py-12 backdrop-blur-md">
                    <div className="text-center font-orbitron text-6xl font-black uppercase tracking-[0.1em] text-white drop-shadow-xl md:text-8xl">{state.turnFlash}</div>
                </div>
            </div>
        )}

        <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end space-y-2">
            <div className="rounded-sm border border-white/10 bg-black/80 px-4 py-2 text-right shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-end space-x-2"><span className="font-orbitron text-[10px] uppercase tracking-widest text-slate-400">Turn</span><span className="font-orbitron text-xl font-bold leading-none text-white">{gameState.turnNumber}</span></div>
                <div className="mt-1 font-orbitron text-[10px] font-bold uppercase tracking-widest text-yellow-500">{gameState.players[gameState.activePlayerIndex].name}'s turn</div>
            </div>
            <PhaseAdvanceButton disabled={actionsDisabled || state.cardMovementPending || state.targetSelectMode !== null} phase={gameState.currentPhase} nextPhase={actions.nextPhase} skipToEndPhase={actions.skipToEndPhase} />
            {!state.cardMovementPending && <>
            {state.handSummonCardId && gameState.pendingHandSummons?.[0] && (
                <div className="w-44 border border-yellow-500 bg-slate-950 p-2 text-right shadow-lg" role="status">
                    <div className="mb-2 font-orbitron text-[10px] font-bold uppercase leading-relaxed tracking-widest text-yellow-400">Select an empty Pawn slot</div>
                    <button data-sound="cancellation" onClick={() => actions.declineHandSummon(gameState.pendingHandSummons![0].sourceId)} className="w-full border border-white/10 bg-slate-800 px-4 py-2 font-orbitron text-[10px] font-bold uppercase text-slate-200 hover:bg-slate-700">Decline</button>
                </div>
            )}
            {state.targetSelectMode === 'effect' && <div className="animate-pulse border-2 border-red-500 bg-red-900 px-4 py-2 text-center font-orbitron text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{state.pendingEffectCard?.name}: Select target</div>}
            {state.targetSelectMode === 'tribute' && (
                <div className="flex flex-col space-y-2">
                    {state.effectTributeReq && <div className="animate-pulse border-2 border-red-500 bg-red-900 px-4 py-2 text-center font-orbitron text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{state.effectTributeReq.title}</div>}
                    <button data-sound={state.effectTributeReq ? 'select' : 'select-small'} onClick={state.effectTributeReq ? actions.handleEffectTribute : actions.handleTributeSummon} className="animate-pulse bg-green-600 px-6 py-3 font-orbitron text-lg font-black uppercase text-white shadow-lg transition-all hover:bg-green-500 active:translate-x-1">
                        Sacrifice [{state.tributeSelection.length}/{state.effectTributeReq?.count ?? (state.pendingTributeCard ? (state.pendingTributeCard.level <= 7 ? 1 : 2) : 0)}]
                    </button>
                </div>
            )}
            </>}
        </div>
    </>
);
};
