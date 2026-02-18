import React, { useState, useEffect, useRef } from 'react';
import { PlacedCard, CardType, Position } from '../types';

interface ZoneProps {
    card: PlacedCard | null;
    type: 'entity' | 'action';
    owner: 'active' | 'opponent';
    onClick?: () => void;
    isSelected?: boolean;
    isSelectable?: boolean;
    isTributeSelected?: boolean;
    isDropTarget?: boolean;
    domRef?: (el: HTMLElement | null) => void;
}

/**
 * Zone Component
 * A single slot on the field. Handles display of cards in Attack/Defense/Hidden positions.
 */
export const Zone: React.FC<ZoneProps> = ({ card, type, owner, onClick, isSelected, isSelectable, isTributeSelected, isDropTarget, domRef }) => {
    // Track previous stats to trigger pop animations
    const prevStats = useRef<{ id: string, atk: number, def: number } | null>(null);
    const [popStats, setPopStats] = useState<{ atk: boolean, def: boolean }>({ atk: false, def: false });

    useEffect(() => {
        if (!card) {
            prevStats.current = null;
            return;
        }

        if (prevStats.current && prevStats.current.id === card.card.instanceId) {
            if (card.card.atk !== prevStats.current.atk) {
                setPopStats(prev => ({ ...prev, atk: true }));
                setTimeout(() => setPopStats(prev => ({ ...prev, atk: false })), 800);
            }
            if (card.card.def !== prevStats.current.def) {
                setPopStats(prev => ({ ...prev, def: true }));
                setTimeout(() => setPopStats(prev => ({ ...prev, def: false })), 800);
            }
        }
        prevStats.current = { id: card.card.instanceId, atk: card.card.atk, def: card.card.def };
    }, [card]);

    return (
        <div ref={domRef} onClick={onClick} className={`w-32 aspect-[2/3] rounded border-2 transition-all cursor-pointer flex flex-col overflow-hidden relative ${isSelected ? 'border-yellow-400 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.5)] z-10' : isTributeSelected ? 'border-green-400 scale-105 animate-pulse z-10' : isSelectable ? 'border-red-500 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)] z-10' : isDropTarget ? 'zone-drop-target z-10' : 'border-white/5 bg-black/40 hover:border-white/20'}`}>
            {card ? (
                <div className={`w-full h-full p-1 flex flex-col transition-all duration-700 relative ${card.position === Position.HIDDEN ? 'card-back' : card.card.type === CardType.ENTITY ? 'card-entity' : card.card.type === CardType.ACTION ? 'card-action' : 'card-condition'} ${(card.position === Position.DEFENSE || (card.position === Position.HIDDEN && card.card.type === CardType.ENTITY)) ? 'rotate-90 scale-90' : ''}`}>
                    <div className="card-inner-border"></div>
                    {card.position === Position.HIDDEN ? (<div className="flex-1 flex items-center justify-center opacity-40"><i className="fa-solid fa-lock text-2xl text-slate-800"></i></div>) : (
                        <div className="flex flex-col h-full text-white relative z-10">
                            <div className="card-title-box px-0.5 mb-0.5 border-b border-white/20"><div className="text-[6px] font-orbitron font-bold leading-tight truncate">{card.card.name}</div></div>
                            <div className="flex-1 text-[5px] font-black leading-[1.2] opacity-80 overflow-hidden bg-black/20 p-0.5 mb-0.5 font-mono">{card.card.effectText}</div>
                            {card.card.type === CardType.ENTITY && (<div className="flex justify-between text-[7px] font-black p-0.5 bg-black/40 border border-white/10 font-orbitron"><span className={`text-yellow-500 ${popStats.atk ? 'stat-changed' : ''}`}>A:{card.card.atk}</span><span className={`text-blue-400 ${popStats.def ? 'stat-changed' : ''}`}>D:{card.card.def}</span></div>)}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center space-y-2 opacity-20"><i className={`${type === 'entity' ? 'fa-solid fa-chess-pawn text-3xl' : 'fa-solid fa-wand-sparkles text-2xl'} text-white`}></i><span className="text-[10px] font-orbitron tracking-widest text-white font-black drop-shadow-sm">{type.toUpperCase()}</span></div>
            )}
        </div>
    );
};
