import React from 'react';
import { Card, GameState } from '../../types';
import { getDuelMvp } from '../../game/mvp';
import { CardDetail } from '../cards/CardDetail';
import { DuelPrompt } from './DuelPrompt';
import { playSound } from '../../audio';

export const QuitDuelDialog: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => {
    const cancelButton = React.useRef<HTMLButtonElement>(null);
    const confirmButton = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        cancelButton.current?.focus();
        return () => previous?.focus();
    }, []);

    return (
        <div
            className="quit-duel-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="quit-duel-title"
            aria-describedby="quit-duel-description"
            onClick={onCancel}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                }
                if (event.key === 'Tab') {
                    event.preventDefault();
                    const next = document.activeElement === cancelButton.current ? confirmButton.current : cancelButton.current;
                    next?.focus();
                }
            }}
        >
            <section className="quit-duel-dialog__panel" onClick={event => event.stopPropagation()}>
                <div className="quit-duel-dialog__icon" aria-hidden="true"><i className="fa-solid fa-power-off" /></div>
                <h2 id="quit-duel-title">Quit this duel?</h2>
                <p id="quit-duel-description">Your current duel progress will be lost. Neither player earns account XP from an unfinished duel.</p>
                <div className="quit-duel-dialog__actions">
                    <button data-sound="cancellation" ref={cancelButton} type="button" onClick={onCancel}>Keep Playing</button>
                    <button data-sound="select-small" ref={confirmButton} type="button" className="quit-duel-dialog__confirm" onClick={onConfirm}>Quit Duel</button>
                </div>
            </section>
        </div>
    );
};

export const WinnerModal: React.FC<{
    gameState: GameState; isDefeat?: boolean; onQuit: () => void; children?: React.ReactNode;
    saving?: boolean; error?: string; onRetry?: () => void;
}> = ({ gameState, isDefeat, onQuit, children, saving = false, error = '', onRetry }) => {
    const mvp = gameState.isDraw ? null : getDuelMvp(gameState);
    isDefeat = !gameState.isDraw && isDefeat;
    const dialog = React.useRef<HTMLDivElement>(null);
    const continueButton = React.useRef<HTMLButtonElement>(null);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const [revealed, setRevealed] = React.useState(reducedMotion);
    const [reportVisible, setReportVisible] = React.useState(reducedMotion);
    const defeatSoundPlayed = React.useRef(false);
    React.useEffect(() => {
        if (isDefeat && !defeatSoundPlayed.current) {
            defeatSoundPlayed.current = true;
            playSound('defeat');
        }
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.focus();
        const timer = setTimeout(() => setRevealed(true), reducedMotion ? 0 : 1000);
        // Let the flip (850ms) and damage reveal settle before introducing the report.
        const reportTimer = setTimeout(() => setReportVisible(true), reducedMotion ? 0 : mvp ? 2700 : 1200);
        return () => { clearTimeout(timer); clearTimeout(reportTimer); previous?.focus(); };
    }, [isDefeat, reducedMotion, !!mvp]);
    React.useEffect(() => {
        if ((!children || reportVisible) && !saving && !error) continueButton.current?.focus({ preventScroll: true });
    }, [reportVisible, saving, error, !!children]);
    return (
        <div ref={dialog} tabIndex={-1} className={`duel-result ${isDefeat ? 'duel-result--defeat' : ''} ${gameState.isDraw ? 'duel-result--draw' : ''}`} role="dialog" aria-modal="true" aria-labelledby="duel-result-title" onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const buttons = [...(event.currentTarget as HTMLDivElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            event.preventDefault();
            if (!buttons.length) dialog.current?.focus();
            else buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }}>
            <div className="duel-result-vfx" aria-hidden="true">
                <div className="duel-result-ring" /><div className="duel-result-sweep" />
                {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
            </div>
            <div className="duel-result-layout">
            <header className="duel-result-heading">
                <p className="duel-result-eyebrow">Duel complete · Turn {gameState.turnNumber}</p>
                <h2 id="duel-result-title">{gameState.isDraw ? 'Draw' : isDefeat ? 'Defeat' : 'Victory'}</h2>
                <p className="duel-result-winner">{gameState.isDraw ? 'Both players reached 0 LP at the same time.' : `${gameState.winner} is victorious`}</p>
                {gameState.resultReason === 'empty_deck' && <p className="duel-result-reason">A required draw could not be completed: the deck was empty.</p>}
                {!mvp && !gameState.isDraw && <p className="duel-result-empty">No damage-dealing MVP this duel.</p>}
            </header>
            <div className={`duel-result-body ${!mvp || !children ? 'duel-result-body--single' : ''}`}>
            {mvp && <section className="duel-result-content" aria-label={isDefeat ? 'Opponent’s MVP' : 'Duel MVP'}>
                    <p className="duel-result-label">{isDefeat ? 'Opponent’s MVP' : 'MVP'}</p>
                    <div className="duel-mvp-stage">
                        <div className={`duel-mvp-card ${revealed ? 'is-revealed' : ''}`}>
                            <div className="duel-mvp-face duel-mvp-back card-back" aria-hidden="true" />
                            <div className="duel-mvp-face duel-mvp-front" aria-hidden={!revealed}><CardDetail card={mvp.card} className="w-full h-full" /></div>
                        </div>
                    </div>
                    <div className={`duel-mvp-stats ${revealed ? 'is-revealed' : ''}`} aria-live="polite">
                        {revealed && <><h3>{mvp.card.name}</h3><p><strong>{mvp.total.toLocaleString()}</strong> damage dealt</p></>}
                    </div>
            </section>}
            {children && <div className="duel-result-report">{reportVisible && children}</div>}
            </div>
            <footer className={`duel-result-footer ${!children || reportVisible ? 'is-visible' : ''}`}>
                <p role="status">{error || (saving ? 'Saving account XP…' : '')}</p>
                <div>{error && onRetry && <button className="deck-secondary" data-sound="select-small" onClick={onRetry}>Retry save</button>}
                    <button ref={continueButton} data-sound="select" disabled={saving || !!error} onClick={onQuit} className="duel-result-button">Continue <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
                </div>
            </footer>
            </div>
        </div>
    );
};

interface EffectModalProps {
    declineReaction: (cardId: string) => void;
    triggeredEffect: Card | null;
    gameState: GameState | null;
    isPeekingField: boolean;
    resolveEffect: (card: Card) => void;
    checkActivationConditions: (state: GameState, card: Card, playerIndex: number) => boolean;
    setIsPeekingField: (peeking: boolean) => void;
    setTriggeredEffect: (card: Card | null) => void;
    setPendingEffectCard: (card: Card | null) => void;
}

export const EffectModal: React.FC<EffectModalProps> = ({ triggeredEffect, gameState, isPeekingField, resolveEffect, checkActivationConditions, setIsPeekingField, setTriggeredEffect, setPendingEffectCard, declineReaction }) => {

    if (!triggeredEffect || !gameState) return null;
    const reactionController = gameState.pendingReactions?.find(entry => entry.card.instanceId === triggeredEffect.instanceId)?.playerIndex;
    const canActivate = checkActivationConditions(gameState, triggeredEffect, reactionController ?? gameState.activePlayerIndex);
    const decline = () => {
        if (reactionController !== undefined) declineReaction(triggeredEffect.instanceId);
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
            ...(!triggeredEffect.switchMandatory || reactionController === undefined ? [{ label: 'Decline', onClick: decline, variant: 'secondary' as const }] : []),
            { label: 'Activate', onClick: () => resolveEffect(triggeredEffect), variant: 'primary', disabled: !canActivate },
        ]}
    >
        <p className="duel-prompt__effect-text">{triggeredEffect.effectText}</p>
    </DuelPrompt>;
};
