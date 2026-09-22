import React from 'react';

export interface DuelPromptAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
}

interface DuelPromptProps {
    ariaLabel: string;
    title: React.ReactNode;
    children?: React.ReactNode;
    actions: DuelPromptAction[];
    peeking: boolean;
    setPeeking: (peeking: boolean) => void;
    onBackdropClick?: () => void;
}

export const DuelPrompt: React.FC<DuelPromptProps> = ({
    ariaLabel,
    title,
    children,
    actions,
    peeking,
    setPeeking,
    onBackdropClick,
}) => (
    <div
        className={`duel-prompt ${peeking ? 'duel-prompt--peeking' : ''}`}
        role="dialog"
        aria-modal={!peeking}
        aria-label={ariaLabel}
        onClick={peeking ? undefined : onBackdropClick}
    >
        <div className="duel-prompt__shell" onClick={event => event.stopPropagation()}>
            <button
                type="button"
                className="duel-prompt__peek-tab"
                aria-label={peeking ? `Return to ${ariaLabel.toLowerCase()}` : 'Hide prompt and peek at field'}
                aria-expanded={!peeking}
                onClick={() => setPeeking(!peeking)}
            >
                <i className={`fa-solid ${peeking ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true" />
            </button>
            <section className="duel-prompt__panel">
                <h2 className="duel-prompt__title">{title}</h2>
                {children && <div className="duel-prompt__content">{children}</div>}
                <div className="duel-prompt__actions">
                    {actions.map(action => (
                        <button
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
