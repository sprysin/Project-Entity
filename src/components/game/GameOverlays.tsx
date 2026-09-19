import React from 'react';
import type { useGameLogic } from '../../hooks/useGameLogic';
import { GameState, Player } from '../../types';
import { checkActivationConditions } from '../../hooks/cardHelpers';
import { DeckSelectionModal, DiscardSelectionModal, EffectModal, HandSelectionModal, WinnerModal } from './GameModals';

type GameLogic = ReturnType<typeof useGameLogic>;

export const GameOverlays: React.FC<{
    gameState: GameState;
    activePlayer: Player;
    state: GameLogic['state'];
    actions: GameLogic['actions'];
    actionsDisabled: boolean;
    onQuit: () => void;
}> = ({ gameState, state, actions, actionsDisabled, onQuit }) => (
    <>
        {state.floatingTexts.map(text => (
            <div key={text.id} className={`floating-text text-6xl ${text.type === 'damage' ? 'text-red-600' : 'text-green-500'}`} style={{ left: `${text.x}%`, top: `${text.y}%` }}>{text.text}</div>
        ))}

        {gameState.response && !gameState.response.ready && state.responseOptions.length > 0 && !state.pendingEffectCard && !state.triggeredEffect && !state.responseFieldMode && !(state.opponentMode === 'ai' && gameState.response.priority === 1) && (
            <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/65 p-6" role="dialog" aria-modal="true" aria-label="Response window">
                <div className="w-full max-w-lg border-2 border-yellow-500 bg-slate-950 p-6 text-slate-100 shadow-2xl">
                    <h2 className="font-orbitron text-xl text-yellow-400">{gameState.players[gameState.response.priority].name}: Respond?</h2>
                    <p className="font-orbitron mt-3 font-bold">{gameState.response.reason}</p>
                    <p className="font-orbitron my-3">{state.responseOptions.length} activatable {state.responseOptions.length === 1 ? 'card' : 'cards'}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => actions.setResponseFieldMode('peek')} className="border border-white/20 bg-slate-800 p-3 font-orbitron text-xs font-bold uppercase tracking-widest text-slate-200 hover:bg-slate-700">Peek at field</button>
                        <button onClick={() => actions.setResponseFieldMode('activate')} className="border border-yellow-400 bg-yellow-600 p-3 font-orbitron text-xs font-bold uppercase tracking-widest text-white hover:bg-yellow-500">Activate</button>
                    </div>
                    {!!gameState.chain?.length && <ol className="my-4 text-sm text-slate-300">{gameState.chain.map((link, i) => <li key={i}>{i + 1}. {link.context.card.name}{i === gameState.chain!.length - 1 ? ' · resolves first' : ''}</li>)}</ol>}
                    <button onClick={actions.passResponse} className="mt-4 w-full border border-white/20 bg-slate-700 p-3 font-orbitron font-bold text-slate-100 hover:bg-slate-600">PASS</button>
                </div>
            </div>
        )}
        {state.opponentMode === 'ai' && (gameState.activePlayerIndex === 1 || gameState.response?.priority === 1) && !gameState.winner && <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 border border-yellow-600 bg-slate-950 px-4 py-2 text-sm text-yellow-400">{gameState.response?.priority === 0 ? 'Your response' : 'AI is thinking…'}</div>}
        <WinnerModal winner={gameState.winner} onQuit={onQuit} />
        <HandSelectionModal selectionReq={state.handSelectionReq} gameState={gameState} selectedHandSelectionIndex={state.selectedHandSelectionIndex} setSelectedHandSelectionIndex={actions.setSelectedHandSelectionIndex} setHandSelectionReq={actions.cancelEffect} handleHandSelection={actions.handleHandSelection} />
        <DiscardSelectionModal selectionReq={state.discardSelectionReq} gameState={gameState} selectedDiscardIndex={state.selectedDiscardIndex} setSelectedDiscardIndex={actions.setSelectedDiscardIndex} setDiscardSelectionReq={actions.cancelEffect} handleDiscardSelection={actions.handleDiscardSelection} />
        <DeckSelectionModal selectionReq={state.deckSelectionReq} gameState={gameState} selectedDeckIndex={state.selectedDeckIndex} setSelectedDeckIndex={actions.setSelectedDeckIndex} setDeckSelectionReq={actions.cancelEffect} handleDeckSelection={actions.handleDeckSelection} />
        <EffectModal triggeredEffect={state.triggeredEffect} gameState={gameState} isPeekingField={state.isPeekingField} resolveEffect={card => actions.resolveEffect(card, undefined, undefined, undefined, undefined, state.pendingTriggerType || 'activate')} checkActivationConditions={checkActivationConditions} setIsPeekingField={actions.setIsPeekingField} setTriggeredEffect={actions.setTriggeredEffect} setPendingEffectCard={actions.setPendingEffectCard} />

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
            <button disabled={actionsDisabled || state.targetSelectMode !== null} onClick={actions.nextPhase} className={`flex flex-col items-center justify-center overflow-hidden bg-yellow-600 px-4 py-2 font-orbitron font-bold uppercase text-white shadow-lg hover:bg-yellow-500 ${actionsDisabled || state.targetSelectMode !== null ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}>
                <span className="whitespace-nowrap text-xl leading-none tracking-tighter">Next phase</span><span className="font-orbitron text-[10px] font-bold italic tracking-widest opacity-90">({gameState.currentPhase})</span>
            </button>
            {gameState.response && !gameState.response.ready && state.responseOptions.length > 0 && state.responseFieldMode && !state.pendingEffectCard && !state.triggeredEffect && (
                <div className="w-44 border border-white/10 bg-black/80 p-2 text-right shadow-lg backdrop-blur-md" role="status" aria-label="Response field controls">
                    <div aria-label="Response field message" className="mb-2 font-orbitron text-[10px] font-bold uppercase leading-relaxed tracking-widest text-yellow-500">
                        {state.responseFieldMode === 'activate' ? 'Select a highlighted card' : 'Viewing field'}
                    </div>
                    <button onClick={() => actions.setResponseFieldMode(null)} className="w-full border border-white/10 bg-slate-800 px-4 py-2 font-orbitron text-[10px] font-bold uppercase tracking-widest text-slate-200 hover:bg-slate-700">Return</button>
                </div>
            )}
            {state.pendingEffectCard && <button onClick={actions.cancelEffect} className="bg-red-900 px-4 py-2 text-white">Cancel effect</button>}
            {state.targetSelectMode === 'effect' && <div className="animate-pulse border-2 border-red-500 bg-red-900 px-4 py-2 text-center font-orbitron text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{state.pendingEffectCard?.name}: Select target</div>}
            {state.targetSelectMode === 'tribute' && (
                <div className="flex flex-col space-y-2">
                    {state.effectTributeReq && <div className="animate-pulse border-2 border-red-500 bg-red-900 px-4 py-2 text-center font-orbitron text-[10px] font-black uppercase tracking-widest text-white shadow-lg">{state.effectTributeReq.title}</div>}
                    <button onClick={state.effectTributeReq ? actions.handleEffectTribute : actions.handleTributeSummon} className="animate-pulse bg-green-600 px-6 py-3 font-orbitron text-lg font-black uppercase text-white shadow-lg transition-all hover:bg-green-500 active:translate-x-1">
                        Sacrifice [{state.tributeSelection.length}/{state.effectTributeReq?.count ?? (state.pendingTributeCard ? (state.pendingTributeCard.level <= 7 ? 1 : 2) : 0)}]
                    </button>
                </div>
            )}
        </div>
    </>
);
