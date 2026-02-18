import React from 'react';

interface PileProps {
    count: number;
    label: string;
    color: string;
    icon: string;
    isFlashing?: boolean;
    onClick?: () => void;
    domRef?: (el: HTMLElement | null) => void;
}

/**
 * Pile Component
 * Represents Discard and Void piles. Supports glow animations.
 */
export const Pile: React.FC<PileProps> = ({ count, label, color, icon, isFlashing, onClick, domRef }) => (
    <div ref={domRef} className="flex flex-col items-center group cursor-pointer" onClick={onClick}>
        <div className={`w-32 aspect-[2/3] bg-${color}-900/40 border border-white/10 rounded flex flex-col items-center justify-center shadow-xl transition-all group-hover:scale-105 text-white font-orbitron ${isFlashing ? (color === 'slate' ? 'flash-gold' : 'flash-purple') : ''}`}>
            <i className={`fa-solid ${icon} text-2xl mb-1 opacity-60`}></i>
            <span className="text-xl font-black">{count}</span>
        </div>
        <span className="text-[11px] font-orbitron mt-2 text-white font-black drop-shadow-md tracking-widest">{label.toUpperCase()}</span>
    </div>
);

/**
 * DeckPile Component
 * Visualizes the deck with a card count.
 */
export const DeckPile: React.FC<{ count: number, label: string }> = ({ count, label }) => (
    <div className="flex flex-col items-center group relative">
        <div className={`w-32 aspect-[2/3] card-back rounded border-2 border-slate-400 flex items-center justify-center shadow-xl transition-transform group-hover:scale-105 relative`}>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-black text-white text-3xl font-orbitron drop-shadow-md z-20 pointer-events-none">{count}</span>
            </div>
        </div>
        <span className="text-[11px] font-orbitron mt-2 text-white font-black drop-shadow-md tracking-widest">{label.toUpperCase()}</span>
    </div>
);
