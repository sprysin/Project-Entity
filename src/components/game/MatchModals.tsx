import React from 'react';
import { Card, GameState } from '../../types';
import { getDuelMvp } from '../../game/mvp';
import { CardDetail } from './CardDetail';

export const WinnerModal: React.FC<{ gameState: GameState; isDefeat?: boolean; onQuit: () => void }> = ({ gameState, isDefeat, onQuit }) => {
    const mvp = gameState.isDraw ? null : getDuelMvp(gameState);
    isDefeat = !gameState.isDraw && isDefeat;
    const button = React.useRef<HTMLButtonElement>(null);
    const [revealed, setRevealed] = React.useState(false);
    React.useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        button.current?.focus();
        const timer = setTimeout(() => setRevealed(true), 1000);
        return () => { clearTimeout(timer); previous?.focus(); };
    }, []);
    return (
        <div className={`duel-result ${isDefeat ? 'duel-result--defeat' : ''}`} role="dialog" aria-modal="true" aria-labelledby="duel-result-title" onKeyDown={event => { if (event.key === 'Tab') { event.preventDefault(); button.current?.focus(); } }}>
            <div className="duel-result-vfx" aria-hidden="true">
                <div className="duel-result-ring" /><div className="duel-result-sweep" />
                {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
            </div>
            <section className="duel-result-content">
                <p className="duel-result-eyebrow">Duel complete · Turn {gameState.turnNumber}</p>
                <h2 id="duel-result-title">{gameState.isDraw ? 'Draw' : isDefeat ? 'Defeat' : 'Victory'}</h2>
                <p className="duel-result-winner">{gameState.isDraw ? 'Both players reached 0 LP at the same time.' : `${gameState.winner} is victorious`}</p>
                {gameState.resultReason === 'empty_deck' && <p>A required draw could not be completed: the deck was empty.</p>}
                {mvp ? <>
                    <p className="duel-result-label">-MVP-</p>
                    <div className="duel-mvp-stage">
                        <div className={`duel-mvp-card ${revealed ? 'is-revealed' : ''}`}>
                            <div className="duel-mvp-face duel-mvp-back card-back" aria-hidden="true" />
                            <div className="duel-mvp-face duel-mvp-front" aria-hidden={!revealed}><CardDetail card={mvp.card} className="w-full h-full" /></div>
                        </div>
                    </div>
                    <div className={`duel-mvp-stats ${revealed ? 'is-revealed' : ''}`} aria-live="polite">
                        {revealed && <><h3>{mvp.card.name}</h3><p><strong>{mvp.total.toLocaleString()}</strong> damage dealt</p></>}
                    </div>
                </> : !gameState.isDraw && <p className="duel-result-empty">A victory beyond damage.<br /><span>No damage-dealing MVP this duel.</span></p>}
                <button ref={button} onClick={onQuit} className="duel-result-button">Continue</button>
            </section>
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
