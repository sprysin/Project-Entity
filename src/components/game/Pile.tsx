import React from 'react';
import { Card } from '../../types';
import { CardDetail } from '../cards/CardDetail';

/**
 * DeckPile Sub-component: Visualizes the deck with a card count.
 */
export const DeckPile: React.FC<{ count: number, label: string, domRef?: (el: HTMLElement | null) => void }> = ({ count, label, domRef }) => (
    <div className="flex flex-col items-center group relative">
        <div ref={domRef} aria-label={`${label}: ${count} cards`} className={`deck-pile w-32 aspect-[2/3] rounded flex items-center justify-center relative ${count > 0 ? 'card-back border-2 border-slate-400 shadow-xl transition-transform group-hover:scale-105' : 'deck-pile--empty'}`}>
            {count > 0
                ? <span className="font-black text-white text-3xl font-orbitron drop-shadow-md z-20 pointer-events-none">{count}</span>
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
        {!fannedOut && <span className="history-pile__label" aria-hidden="true">{label}</span>}
        <span className="history-pile__counter" aria-hidden="true">
            <span className="history-pile__count"><i className={`fa-solid ${icon}`} />{cards.length}</span>
        </span>
    </button>
);
