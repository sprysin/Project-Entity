import React from 'react';
import { Card, GameState } from '../../types';
import { getDuelMvp } from '../../game/mvp';
import { CardDetail } from './CardDetail';
import { DuelPrompt } from './DuelPrompt';

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
    React.useEffect(() => {
        if (!triggeredEffect || !isPeekingField) return;
        const returnToPrompt = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setIsPeekingField(false);
        };
        window.addEventListener('keydown', returnToPrompt);
        return () => window.removeEventListener('keydown', returnToPrompt);
    }, [isPeekingField, setIsPeekingField, triggeredEffect]);

    if (!triggeredEffect || !gameState) return null;
    const canActivate = checkActivationConditions(gameState, triggeredEffect, gameState.activePlayerIndex);
    const decline = () => {
        setTriggeredEffect(null);
        setPendingEffectCard(null);
        setIsPeekingField(false);
    };

    return <DuelPrompt
        ariaLabel="Summon effect prompt"
        title={<>Activate the effect of <strong>“{triggeredEffect.name}”</strong> on the field?</>}
        peeking={isPeekingField}
        setPeeking={setIsPeekingField}
        actions={[
            { label: 'Decline', onClick: decline, variant: 'secondary' },
            { label: 'Activate', onClick: () => resolveEffect(triggeredEffect), variant: 'primary', disabled: !canActivate },
        ]}
    >
        <p className="duel-prompt__effect-text">{triggeredEffect.effectText}</p>
    </DuelPrompt>;
};
