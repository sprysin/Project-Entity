import React from 'react';
import { Card } from '../../types';
import { CardDetail } from '../cards/CardDetail';

/**
 * DeckPile Sub-component: Visualizes the deck with a card count.
 */
export const DeckPile: React.FC<{ count: number, label: string, domRef?: (el: HTMLElement | null) => void }> = ({ count, label, domRef }) => (
    <div className="flex flex-col items-center group relative">
        <div ref={domRef} className={`w-32 aspect-[2/3] card-back rounded border-2 border-slate-400 flex items-center justify-center shadow-xl transition-transform group-hover:scale-105 relative`}>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-black text-white text-3xl font-orbitron drop-shadow-md z-20 pointer-events-none">{count}</span>
            </div>
        </div>
        <span className="text-[11px] font-orbitron mt-2 text-white font-black drop-shadow-md tracking-widest">{label.toUpperCase()}</span>
    </div>
);

/**
 * Pile Sub-component: Represents Discard and Void piles. Supports glow animations.
 */
export const Pile: React.FC<{
    count: number;
    topCard?: Card;
    label: string;
    color: string;
    icon: string;
    isFlashing?: boolean;
    onClick?: () => void;
    domRef?: (el: HTMLElement | null) => void;
}> = ({ count, topCard, label, color, icon, isFlashing, onClick, domRef }) => (
    <button type="button" data-sound="select-small" data-pile-trigger aria-label={`${label}: ${count} cards. Open pile`} className="flex flex-col items-center group cursor-pointer" onClick={onClick}>
        <div ref={domRef} className={`relative w-32 aspect-[2/3] ${color === 'slate' ? 'bg-slate-900/40' : 'bg-purple-900/40'} border border-white/10 rounded flex flex-col items-center justify-center shadow-xl transition-all group-hover:scale-105 text-white font-orbitron ${isFlashing ? (color === 'slate' ? 'flash-gold' : 'flash-purple') : ''}`}>
            {topCard && <div className="absolute inset-0"><CardDetail card={topCard} compact className="w-full h-full" /></div>}
            {topCard && <div aria-hidden="true" className={`absolute inset-0 pointer-events-none ${color === 'slate' ? 'bg-slate-500/35' : 'bg-purple-600/35'}`} />}
            <div className={`z-10 rounded px-2 py-1 ${topCard ? 'absolute bottom-1 right-1 bg-black/85 border border-white/30' : 'relative'}`}>
            <i className={`fa-solid ${icon} text-2xl mb-1 opacity-60`}></i>
            <span className="text-xl font-black">{count}</span>
            </div>
        </div>
    </button>
);
