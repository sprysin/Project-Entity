import React from 'react';
import { Card, CardType } from '../types';

/**
 * CardDetail Component
 * A high-fidelity representation of a card.
 * Used in the Hand, the Sidebar, and the Database Gallery.
 */
export const CardDetail: React.FC<{ card: Card, isSet?: boolean }> = ({ card, isSet }) => {
    // Handle hidden state for opponent's Set cards
    if (isSet) return (<div className="p-8 rounded-sm bg-slate-100 border-4 border-slate-400 flex flex-col items-center space-y-8 shadow-inner"><div className="w-24 h-24 rounded-sm border-2 border-slate-300 flex items-center justify-center bg-white/50 rotate-45 shadow-lg"><i className="fa-solid fa-eye-slash text-5xl opacity-40 -rotate-45 text-slate-600"></i></div><div className="text-center space-y-2"><h3 className="text-3xl font-orbitron font-black text-slate-600 uppercase tracking-widest">MASKED DATA</h3><p className="font-bold text-xs text-slate-500 uppercase tracking-[0.3em]">Signature Hidden</p></div></div>);

    return (
        <div className={`p-4 rounded border-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col space-y-4 relative overflow-hidden transition-all aspect-[2/3] ${card.type === CardType.ENTITY ? 'card-entity glow-gold' : card.type === CardType.ACTION ? 'card-action glow-green' : card.type === CardType.CONDITION ? 'card-condition glow-pink' : ''}`}>
            <div className="card-inner-border"></div>
            <div className="card-title-box p-3 relative z-10 border-b-2 border-white/10 flex justify-between items-center">
                <h3 className="text-xs font-orbitron font-bold leading-tight tracking-tight text-white truncate mr-2">{card.name}</h3>
                {card.type === CardType.ENTITY && <span className="text-xs font-orbitron font-black text-yellow-500 whitespace-nowrap">Lv.{card.level}</span>}
            </div>
            <div className="flex-1 text-[11px] font-bold leading-relaxed text-white/90 p-3 bg-black/40 border border-white/10 relative z-10 font-mono shadow-inner overflow-y-auto scrollbar-hide">
                {card.effectText}
            </div>
            {card.type === CardType.ENTITY && (
                <div className="flex justify-center items-center py-2 bg-black/50 border border-white/10 rounded-sm relative z-10">
                    <span className="font-orbitron font-black text-white text-md">ATK: {card.atk} / DEF: {card.def}</span>
                </div>
            )}
        </div>
    );
};
