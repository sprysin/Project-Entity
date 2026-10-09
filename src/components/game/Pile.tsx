import React from 'react';
import { Card } from '../../types';
import { CardDetail } from '../cards/CardDetail';
import { XrayOverlay } from './XrayOverlay';

/** Shared overlay for the visible count on field piles. */
export const PileCounter: React.FC<{ label: string; count: number; icon: React.ReactNode; compact?: boolean }> = ({ label, count, icon, compact }) => (
    <span className={`history-pile__counter ${compact ? 'history-pile__counter--compact' : ''}`} aria-hidden="true">
        <span className="history-pile__label">{label}</span>
        <span className="history-pile__count">{icon}{count}</span>
    </span>
);

/**
 * DeckPile Sub-component: Visualizes the deck with a card count.
 */
export const DeckPile: React.FC<{ count: number, label: string, backStyle?: 'dark' | 'light', domRef?: (el: HTMLElement | null) => void, xrayCard?: Card, onInspect?: () => void, onOpen?: () => void }> = ({ count, label, backStyle = 'dark', domRef, xrayCard, onInspect, onOpen }) => (
    <div className="flex flex-col items-center group relative">
        <div ref={domRef} role={onOpen || xrayCard ? 'button' : undefined} tabIndex={onOpen || xrayCard ? 0 : undefined} onClick={onOpen ?? (xrayCard ? onInspect : undefined)} onKeyDown={event => { if ((onOpen || xrayCard) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); (onOpen ?? onInspect)?.(); } }} aria-label={`${label}: ${count} cards${onOpen ? '. Open pile' : xrayCard ? '. Inspect top card' : ''}`} className={`deck-pile w-32 aspect-[2/3] rounded flex items-center justify-center relative ${count > 0 ? `card-back ${backStyle === 'light' ? 'card-back--light ' : ''}border-2 border-slate-400 shadow-xl transition-transform group-hover:scale-105` : 'deck-pile--empty'}`}>
            {xrayCard && <XrayOverlay card={xrayCard} />}
            {count > 0
                ? <span className="deck-pile__count font-black text-3xl font-orbitron z-20 pointer-events-none">{count}</span>
                : <span className="deck-pile__empty-label">EMPTY</span>}
        </div>
    </div>
);

/**
 * Pile Sub-component: Represents Discard and Void piles. Supports glow animations.
 */
export const Pile: React.FC<{
    cards: Card[];
    label: string;
    color: 'slate' | 'purple';
    icon: string;
    fannedOut?: boolean;
    isFlashing?: boolean;
    onClick?: () => void;
    domRef?: (el: HTMLElement | null) => void;
}> = ({ cards, label, color, icon, fannedOut = false, isFlashing, onClick, domRef }) => (
    <button type="button" data-sound="select-small" data-pile-trigger aria-label={`${label}: ${cards.length} cards. Open pile`} className={`history-pile history-pile--${color} ${fannedOut ? '' : 'history-pile--compact'} ${isFlashing ? (color === 'slate' ? 'flash-gold' : 'flash-purple') : ''}`} onClick={onClick}>
        <span ref={domRef} className="history-pile__target" aria-hidden="true" />
        <span className="history-pile__cards" aria-hidden="true">
            {cards.slice(fannedOut ? -4 : -1).reverse().map((card, index) => (
                <span key={card.instanceId} className="history-pile__card" style={fannedOut ? { left: `${7 + index * 55}px`, zIndex: 4 - index } : undefined}>
                    <CardDetail card={card} compact className="w-full h-full" />
                </span>
            ))}
        </span>
        <PileCounter label={label} count={cards.length} compact={!fannedOut} icon={<i className={`fa-solid ${icon}`} />} />
    </button>
);
