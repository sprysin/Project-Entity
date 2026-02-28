import React from 'react';
import { Card, CardType, Attribute } from '../../types';
import { BASE_CARDS } from '../../constants';

const getAttributeColor = (attr?: Attribute) => {
    switch (attr) {
        case Attribute.FIRE: return 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]';
        case Attribute.WATER: return 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.8)]';
        case Attribute.EARTH: return 'bg-amber-700 text-white shadow-[0_0_10px_rgba(180,83,9,0.8)]';
        case Attribute.AIR: return 'bg-sky-300 text-slate-900 shadow-[0_0_10px_rgba(125,211,252,0.8)]';
        case Attribute.ELECTRIC: return 'bg-yellow-400 text-slate-900 shadow-[0_0_10px_rgba(250,204,21,0.8)]';
        case Attribute.DARK: return 'bg-purple-900 text-white shadow-[0_0_10px_rgba(88,28,135,0.8)]';
        case Attribute.LIGHT: return 'bg-yellow-200 text-slate-900 shadow-[0_0_10px_rgba(254,240,138,0.8)]';
        default: return 'bg-slate-300 text-slate-900'; // Normal
    }
};

interface CardDetailProps {
    card: Card;
    isSet?: boolean;
    className?: string;
    onClick?: () => void;
    highlightAtk?: boolean;
    highlightDef?: boolean;
    compact?: boolean;
}

/**
 * CardDetail Sub-component: A high-fidelity representation of a card.
 * Used in the Hand, the Sidebar, and the Database Gallery.
 */
export const CardDetail: React.FC<CardDetailProps> = ({ card, isSet, className = '', onClick, highlightAtk, highlightDef, compact = false }) => {
    const originalCard = BASE_CARDS.find(c => c.id === card.id);
    const getStatColor = (current: number, original?: number) => {
        if (original === undefined) return 'text-yellow-400';
        if (current > original) return 'text-blue-500';
        if (current < original) return 'text-red-500';
        return 'text-yellow-400';
    };

    // Handle hidden state for opponent's Set cards (Sidebar view)
    if (isSet) return (
        <div className={`p-8 rounded-sm bg-slate-100 border-4 border-slate-400 flex flex-col items-center space-y-8 shadow-inner ${className}`}>
            <div className="w-24 h-24 rounded-sm border-2 border-slate-300 flex items-center justify-center bg-white/50 rotate-45 shadow-lg">
                <i className="fa-solid fa-eye-slash text-5xl opacity-40 -rotate-45 text-slate-600"></i>
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-orbitron font-black text-slate-600 uppercase tracking-widest">MASKED DATA</h3>
                <p className="font-bold text-xs text-slate-500 uppercase tracking-[0.3em]">Signature Hidden</p>
            </div>
        </div>
    );

    return (
        <div
            onClick={onClick}
            className={`${compact ? 'p-1 border-2' : 'p-2 border-4'} rounded shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col space-y-1 relative overflow-hidden transition-all aspect-[2/3] ${card.type === CardType.PAWN ? 'card-pawn glow-gold' : card.type === CardType.ACTION ? 'card-action glow-green' : card.type === CardType.CONDITION ? 'card-condition glow-pink' : ''} ${className}`}
        >
            {/* Header: Name + Level */}
            <div className="card-inner-border"></div>
            <div className={`relative z-10 flex ${compact ? 'h-5' : 'h-8'} gap-[1px]`}>
                <div className="card-title-box flex-grow p-1 flex items-center border-b-[1px] border-white/10">
                    <h3 className={`${compact ? 'text-[7px]' : 'text-[10px]'} font-orbitron font-bold leading-tight tracking-tight text-white line-clamp-2`}>{card.name}</h3>
                </div>
                {card.type === CardType.PAWN && (
                    <div className={`card-title-box ${compact ? 'w-5' : 'w-8'} flex-shrink-0 flex items-center justify-center border-b-[1px] border-white/10`}>
                        <span className={`${compact ? 'text-[6px]' : 'text-[8px]'} font-orbitron font-black text-yellow-500 leading-tight`}>Lv.{card.level}</span>
                    </div>
                )}
            </div>

            {/* Sub-Header: Attribute/Type OR Action/Condition Status */}
            <div className={`relative z-10 border-b border-white/10 ${compact ? 'pb-0.5 mb-0.5 min-h-[12px]' : 'pb-1 mb-1 min-h-[20px]'} flex items-center`}>
                {card.type === CardType.PAWN ? (
                    <div className="flex items-center space-x-1 w-full">
                        {/* Attribute Bubble */}
                        <div className={`${compact ? 'w-3 h-3 text-[5px]' : 'w-5 h-5 text-[8px]'} rounded-full flex items-center justify-center ${getAttributeColor(card.attribute)} font-bold border border-white/20`}>
                            {(() => {
                                switch (card.attribute) {
                                    case Attribute.FIRE: return <i className="fa-solid fa-fire"></i>;
                                    case Attribute.WATER: return <i className="fa-solid fa-droplet"></i>;
                                    case Attribute.EARTH: return <i className="fa-solid fa-mountain"></i>;
                                    case Attribute.AIR: return <i className="fa-solid fa-wind"></i>;
                                    case Attribute.ELECTRIC: return <i className="fa-solid fa-bolt"></i>;
                                    case Attribute.LIGHT: return <i className="fa-solid fa-sun"></i>;
                                    case Attribute.DARK: return <i className="fa-solid fa-moon"></i>;
                                    default: return <span className="scale-75">N</span>;
                                }
                            })()}
                        </div>
                        <span className={`${compact ? 'text-[6px]' : 'text-[9px]'} font-orbitron text-slate-300 font-bold uppercase tracking-wider`}>
                            [{card.pawnType || 'Unknown'}/Pawn]
                        </span>
                    </div>
                ) : (
                    <div className="w-full text-left pl-1">
                        <span className={`${compact ? 'text-[6px]' : 'text-[9px]'} font-orbitron font-bold uppercase tracking-widest block ${card.type === CardType.ACTION ? 'text-green-400' : 'text-pink-400'}`}>
                            [{card.isLingering ? 'Lingering' : 'Normal'} {card.type === CardType.ACTION ? 'Action' : 'Condition'}]
                        </span>
                    </div>
                )}
            </div>

            {/* Body: Effect Text */}
            <div className={`flex-1 ${compact ? 'text-[7px] p-1' : 'text-[10px] p-2'} font-medium leading-tight text-white/90 bg-black/40 border border-white/10 relative z-10 font-mono shadow-inner overflow-y-auto scrollbar-hide`}>
                {card.effectText}
            </div>

            {/* Footer: Stats (Entities only) */}
            {card.type === CardType.PAWN && (
                <div className={`flex justify-between items-center ${compact ? 'px-2 py-0.5 mt-0.5' : 'px-4 py-1 mt-auto'} bg-black/50 border border-white/10 rounded-sm relative z-10`}>
                    <span className={`font-orbitron font-bold ${getStatColor(card.atk, originalCard?.atk)} ${compact ? 'text-[8px]' : 'text-xs'} transition-all duration-300 ${highlightAtk ? 'scale-125' : ''}`}>ATK: {card.atk}</span>
                    <span className={`font-orbitron font-bold ${getStatColor(card.def, originalCard?.def)} ${compact ? 'text-[8px]' : 'text-xs'} transition-all duration-300 ${highlightDef ? 'scale-125' : ''}`}>DEF: {card.def}</span>
                </div>
            )}
        </div>
    );
};
