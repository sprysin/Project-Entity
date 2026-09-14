import React from 'react';
import { Card, GameState } from '../../types';

export const WinnerModal: React.FC<{ winner: string | null; onQuit: () => void }> = ({ winner, onQuit }) => {
    if (!winner) return null;
    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 text-white animate-in fade-in zoom-in">
            <h2 className="mb-2 font-orbitron text-7xl font-black uppercase tracking-tighter text-yellow-500 drop-shadow-[0_0_50px_rgba(234,179,8,0.5)]">Battle Concluded</h2>
            <div className="mb-12 h-1 w-96 bg-yellow-600/50" />
            <p className="mb-16 font-orbitron text-4xl font-bold uppercase tracking-widest text-white">{winner} is Victorious</p>
            <button onClick={onQuit} className="border-b-8 border-yellow-800 bg-yellow-600 px-16 py-6 font-orbitron text-xl font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-yellow-500 active:translate-y-2 active:border-b-0">Return to Hub</button>
        </div>
    );
};

interface EffectModalProps {
    triggeredEffect: Card | null;
    gameState: GameState | null;
    isPeekingField: boolean;
    resolveEffect: (card: Card) => void;
    checkActivationConditions: (state: GameState, card: Card, playerIndex: number) => boolean;
    setIsPeekingField: (peeking: boolean) => void;
    setTriggeredEffect: (card: Card | null) => void;
    setPendingEffectCard: (card: Card | null) => void;
}

export const EffectModal: React.FC<EffectModalProps> = ({ triggeredEffect, gameState, isPeekingField, resolveEffect, checkActivationConditions, setIsPeekingField, setTriggeredEffect, setPendingEffectCard }) => {
    if (!triggeredEffect || !gameState) return null;
    const canActivate = checkActivationConditions(gameState, triggeredEffect, gameState.activePlayerIndex);
    const decline = () => {
        setTriggeredEffect(null);
        setPendingEffectCard(null);
        setIsPeekingField(false);
    };

    return (
        <div className={`fixed inset-0 z-[70] flex flex-col items-center justify-center transition-opacity duration-300 ${isPeekingField ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
            <div className="flex flex-col items-center space-y-4 border-2 border-yellow-600 bg-slate-900 p-6 shadow-[0_0_40px_rgba(234,179,8,0.5)]">
                <h3 className="font-orbitron text-2xl font-black uppercase tracking-tighter text-yellow-500">{triggeredEffect.name}</h3>
                <p className="max-w-sm text-center font-mono text-sm font-bold text-white/90">{triggeredEffect.effectText}</p>
                <div className="flex w-full flex-col space-y-3">
                    <button onClick={() => resolveEffect(triggeredEffect)} disabled={!canActivate} className={`border-b-4 px-8 py-3 font-orbitron font-black uppercase tracking-widest text-white ${canActivate ? 'border-yellow-800 bg-yellow-600 hover:bg-yellow-500' : 'cursor-not-allowed border-gray-800 bg-gray-600 opacity-50'}`}>Activate ability</button>
                    <div className="flex w-full space-x-3">
                        <button onClick={() => setIsPeekingField(true)} className="flex-1 border border-white/10 bg-slate-800 py-2 font-orbitron text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-700">Peek field</button>
                        <button onClick={decline} className="flex-1 border border-red-500/30 bg-red-900/40 py-2 font-orbitron text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-900/60">Decline</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
