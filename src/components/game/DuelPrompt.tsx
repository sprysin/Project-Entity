import React from 'react';

export interface DuelPromptAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
}

interface DuelPromptProps {
    className?: string;
    ariaLabel: string;
    title: React.ReactNode;
    abovePanel?: React.ReactNode;
    children?: React.ReactNode;
    actions: DuelPromptAction[];
    peeking: boolean;
    setPeeking: (peeking: boolean) => void;
    onBackdropClick?: () => void;
}

export const DuelPrompt: React.FC<DuelPromptProps> = ({
    className = '',
    ariaLabel,
    title,
    abovePanel,
    children,
    actions,
    peeking,
    setPeeking,
    onBackdropClick,
}) => {
    React.useEffect(() => {
        if (!peeking) return;
        const returnToPrompt = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setPeeking(false);
        };
        window.addEventListener('keydown', returnToPrompt);
        return () => window.removeEventListener('keydown', returnToPrompt);
    }, [peeking, setPeeking]);
    return (
    <div
        className={`duel-prompt ${className} ${peeking ? 'duel-prompt--peeking' : ''}`}
        role="dialog"
        aria-modal={!peeking}
        aria-label={ariaLabel}
        onClick={peeking ? undefined : onBackdropClick}
    >
        <div className="duel-prompt__shell" onClick={event => event.stopPropagation()}>
            {abovePanel && <div className="duel-prompt__above-panel">{abovePanel}</div>}
            <button
                type="button"
                className="duel-prompt__peek-tab"
                aria-label={peeking ? `Return to ${ariaLabel.toLowerCase()}` : 'Hide prompt and peek at field'}
                aria-expanded={!peeking}
                onClick={() => setPeeking(!peeking)}
            >
                <svg className="duel-prompt__chevron" viewBox="0 0 24 16" aria-hidden="true">
                    <path d={peeking ? 'M3 13 12 4 21 13' : 'M3 3 12 12 21 3'} />
                </svg>
            </button>
            <section className="duel-prompt__panel">
                <header className="duel-prompt__header">
                    <h2 className="duel-prompt__title">{title}</h2>
                </header>
                {children && <div className="duel-prompt__content">{children}</div>}
                <div className="duel-prompt__actions">
                    {actions.map(action => (
                        <button
                            data-sound={action.variant === 'primary' ? 'select' : 'cancellation'}
                            key={action.label}
                            type="button"
                            disabled={action.disabled}
                            onClick={action.onClick}
                            className={action.variant === 'primary' ? 'duel-prompt__primary' : 'duel-prompt__secondary'}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    </div>
);
};
