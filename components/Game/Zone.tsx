import React, { useState, useEffect, useRef } from 'react';
import { PlacedCard, Position, CardType } from '../../types';
import { CardDetail } from './CardDetail';

/**
 * Zone Sub-component: A single slot on the field. Handles display of cards in Attack/Defense/Hidden positions.
 */
export const Zone: React.FC<{
    card: PlacedCard | null;
    type: 'pawn' | 'action';
    owner: 'active' | 'opponent';
    onClick?: () => void;
    isSelected?: boolean;
    isSelectable?: boolean;
    isTributeSelected?: boolean;
    isDropTarget?: boolean;
    isActivatable?: boolean;
    domRef?: (el: HTMLElement | null) => void;
}> = ({ card, type, owner, onClick, isSelected, isSelectable, isTributeSelected, isDropTarget, isActivatable, domRef }) => {
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
        <div ref={domRef} onClick={onClick} className={`w-32 aspect-[2/3] rounded border-2 transition-all cursor-pointer flex flex-col relative hover:z-50 ${isSelected ? 'border-yellow-400 scale-105 z-40' : isTributeSelected ? 'border-green-400 scale-105 animate-pulse z-40' : isSelectable ? 'border-red-500 animate-pulse z-40' : isDropTarget ? 'zone-drop-target z-40' : 'border-white/5 bg-black/40 hover:border-white/20'} ${isActivatable ? 'glow-activatable z-30' : 'z-10'}`}>
            {/* Base Zone Content (Empty State) */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center space-y-2 transition-opacity duration-300 ${card ? 'opacity-0' : 'opacity-20'}`}>
                <i className={`${type === 'pawn' ? 'fa-solid fa-chess-pawn text-3xl' : 'fa-solid fa-wand-sparkles text-2xl'} text-white`}></i>
                <span className="text-[10px] font-orbitron tracking-widest text-white font-black">{type.toUpperCase()}</span>
            </div>

            {/* Floating Card Content */}
            {card && (
                <div className={`absolute inset-0 w-full h-full transition-all duration-700 z-20 ${card.position === Position.HIDDEN ? 'card-back' : ''} ${(card.position === Position.DEFENSE || (card.position === Position.HIDDEN && card.card.type === CardType.PAWN)) ? 'rotate-90' : ''}`}>
                    {card.position === Position.HIDDEN ? (
                        <div className="w-full h-full flex items-center justify-center opacity-40">
                            <i className="fa-solid fa-lock text-2xl text-slate-800"></i>
                        </div>
                    ) : (
                        <CardDetail
                            card={card.card}
                            highlightAtk={popStats.atk}
                            highlightDef={popStats.def}
                            className="w-full h-full"
                            compact={true}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
