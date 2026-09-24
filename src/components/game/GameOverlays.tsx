import React, { useEffect, useRef, useState } from 'react';
import type { useGameLogic } from '../../hooks/useGameLogic';
import { Attribute, CardType, GameState, Player } from '../../types';
import { ShuffleSelectionModal } from './SelectionModals';
import { checkActivationConditions } from '../../game/cardHelpers';
import { DeckSelectionModal, DiscardSelectionModal, EffectModal, HandSelectionModal, PeekSelectionModal, WinnerModal } from './GameModals';
import { DuelPrompt } from './DuelPrompt';

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
            className={`relative flex flex-col items-center justify-center overflow-hidden bg-yellow-600 px-4 py-2 font-orbitron font-bold uppercase text-white shadow-lg hover:bg-yellow-500 ${disabled ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
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
}> = ({ gameState, state, actions, actionsDisabled, viewerIndex, onQuit }) => (
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

        {state.showResponsePopup && gameState.response && !gameState.response.ready && state.responseOptions.length > 0 && !state.pendingEffectCard && !state.triggeredEffect && state.responseFieldMode !== 'activate' && !(state.opponentMode === 'ai' && gameState.response.priority === 1) && (
            <DuelPrompt
                ariaLabel="Response window"
                title={<span className="duel-prompt__response-title">{gameState.players[gameState.response.priority].name}: Respond?</span>}
                peeking={state.responseFieldMode === 'peek'}
                setPeeking={peeking => actions.setResponseFieldMode(peeking ? 'peek' : null)}
                onBackdropClick={actions.passResponse}
                actions={[
                    { label: 'Decline', onClick: actions.passResponse, variant: 'secondary' },
                    { label: 'Activate', onClick: () => actions.setResponseFieldMode('activate'), variant: 'primary' },
                ]}
            >
                <p className="duel-prompt__reason">{gameState.response.reason}</p>
                <p>{state.responseOptions.length} activatable {state.responseOptions.length === 1 ? 'card' : 'cards'}</p>
                {!!gameState.chain?.length && <ol className="duel-prompt__chain">{gameState.chain.map((link, i) => <li key={i}>{i + 1}. {link.context.card.name}{i === gameState.chain!.length - 1 ? ' · resolves first' : ''}</li>)}</ol>}
            </DuelPrompt>
        )}
        {state.opponentMode === 'ai' && !gameState.resolvingChain && (gameState.activePlayerIndex === 1 || gameState.response?.priority === 1) && !gameState.winner && <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 border border-yellow-600 bg-slate-950 px-4 py-2 text-sm text-yellow-400">{gameState.response?.priority === 0 ? 'Your response' : 'AI is thinking…'}</div>}
        {gameState.winner && <WinnerModal gameState={gameState} isDefeat={state.opponentMode === 'ai' && gameState.winner !== gameState.players[0].name} onQuit={onQuit} />}
        <ShuffleSelectionModal request={state.shuffleSelectionReq} gameState={gameState} onConfirm={actions.handleShuffleSelection} onCancel={actions.cancelEffect} />
        {gameState.pendingFrontline?.length && !state.frontlineCardId && !state.triggeredEffect && !state.pendingEffectCard && !gameState.response && !gameState.resolvingChain
            && !(state.opponentMode === 'ai' && gameState.pendingFrontline[0].playerIndex === 1)
            && <PeekSelectionModal
                selectionReq={{ playerIndex: gameState.pendingFrontline[0].playerIndex, viewerPlayerIndex: gameState.pendingFrontline[0].playerIndex, title: 'Orcustrated Frontline Unit', prompt: 'Choose a LIGHT Pawn' }}
                gameState={gameState}
                selectedPeekIndex={state.frontlineSelectedHandIndex}
                setSelectedPeekIndex={actions.setFrontlineSelectedHandIndex}
                cancelEffect={() => actions.frontlineDecline(gameState.pendingFrontline![0].sourceId)}
                handlePeekSelection={actions.frontlineChooseCard}
                filter={card => card.type === CardType.PAWN && card.attribute === Attribute.LIGHT && card.level <= 4}
                confirmLabel="Choose Pawn"
                cancellable
            />}
        <HandSelectionModal selectionReq={state.handSelectionReq} gameState={gameState} selectedHandSelectionIndex={state.selectedHandSelectionIndex} setSelectedHandSelectionIndex={actions.setSelectedHandSelectionIndex} setHandSelectionReq={actions.cancelEffect} handleHandSelection={actions.handleHandSelection} />
        <PeekSelectionModal selectionReq={state.peekSelectionReq} gameState={gameState} selectedPeekIndex={state.selectedPeekIndex} setSelectedPeekIndex={actions.setSelectedPeekIndex} cancelEffect={actions.cancelEffect} handlePeekSelection={actions.handlePeekSelection} />
        {gameState.peekEvents?.filter(event => event.viewerPlayerIndex === viewerIndex).slice(0, 1).map(event => <PeekAutoDismiss key={event.id} eventId={event.id} dismiss={actions.dismissPeek} />)}
        <DiscardSelectionModal selectionReq={state.discardSelectionReq} gameState={gameState} selectedDiscardIndex={state.selectedDiscardIndex} setSelectedDiscardIndex={actions.setSelectedDiscardIndex} setDiscardSelectionReq={actions.cancelEffect} handleDiscardSelection={actions.handleDiscardSelection} />
        <DeckSelectionModal selectionReq={state.deckSelectionReq} gameState={gameState} selectedDeckIndex={state.selectedDeckIndex} setSelectedDeckIndex={actions.setSelectedDeckIndex} setDeckSelectionReq={actions.cancelEffect} handleDeckSelection={actions.handleDeckSelection} />
        <EffectModal triggeredEffect={state.triggeredEffect} gameState={gameState} isPeekingField={state.isPeekingField} resolveEffect={card => actions.resolveEffect(card, undefined, undefined, undefined, undefined, state.pendingTriggerType || 'activate')} checkActivationConditions={checkActivationConditions} setIsPeekingField={actions.setIsPeekingField} setTriggeredEffect={actions.setTriggeredEffect} setPendingEffectCard={actions.setPendingEffectCard} declineSwitch={actions.declineSwitch} />

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
            <PhaseAdvanceButton disabled={actionsDisabled || state.targetSelectMode !== null} phase={gameState.currentPhase} nextPhase={actions.nextPhase} skipToEndPhase={actions.skipToEndPhase} />
            {state.frontlineCardId && gameState.pendingFrontline?.[0] && (
                <div className="w-44 border border-yellow-500 bg-slate-950 p-2 text-right shadow-lg" role="status">
                    <div className="mb-2 font-orbitron text-[10px] font-bold uppercase leading-relaxed tracking-widest text-yellow-400">Select an empty Pawn slot</div>
                    <button data-sound="cancellation" onClick={() => actions.frontlineDecline(gameState.pendingFrontline![0].sourceId)} className="w-full border border-white/10 bg-slate-800 px-4 py-2 font-orbitron text-[10px] font-bold uppercase text-slate-200 hover:bg-slate-700">Decline</button>
                </div>
            )}
            {gameState.response && !gameState.response.ready && state.responseOptions.length > 0 && state.responseFieldMode === 'activate' && !state.pendingEffectCard && !state.triggeredEffect && (
                <div className="w-44 border border-white/10 bg-black/80 p-2 text-right shadow-lg backdrop-blur-md" role="status" aria-label="Response field controls">
                    <div aria-label="Response field message" className="mb-2 font-orbitron text-[10px] font-bold uppercase leading-relaxed tracking-widest text-yellow-500">
                        Select a highlighted card
                    </div>
                    <button data-sound="cancellation" onClick={() => actions.setResponseFieldMode(null)} className="w-full border border-white/10 bg-slate-800 px-4 py-2 font-orbitron text-[10px] font-bold uppercase tracking-widest text-slate-200 hover:bg-slate-700">Return</button>
                </div>
            )}
            {state.pendingEffectCard && <button data-sound="cancellation" onClick={actions.cancelEffect} className="bg-red-900 px-4 py-2 text-white">Cancel effect</button>}
            {state.targetSelectMode === 'effect' && <div className="animate-pulse border-2 border-red-500 bg-red-900 px-4 py-2 text-center font-orbitron text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{state.pendingEffectCard?.name}: Select target</div>}
            {state.targetSelectMode === 'tribute' && (
                <div className="flex flex-col space-y-2">
                    {state.effectTributeReq && <div className="animate-pulse border-2 border-red-500 bg-red-900 px-4 py-2 text-center font-orbitron text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{state.effectTributeReq.title}</div>}
                    <button data-sound={state.effectTributeReq ? 'select' : 'select-small'} onClick={state.effectTributeReq ? actions.handleEffectTribute : actions.handleTributeSummon} className="animate-pulse bg-green-600 px-6 py-3 font-orbitron text-lg font-black uppercase text-white shadow-lg transition-all hover:bg-green-500 active:translate-x-1">
                        Sacrifice [{state.tributeSelection.length}/{state.effectTributeReq?.count ?? (state.pendingTributeCard ? (state.pendingTributeCard.level <= 7 ? 1 : 2) : 0)}]
                    </button>
                </div>
            )}
        </div>
    </>
);
