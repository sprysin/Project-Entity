import React from 'react';
import { Card, CardType } from '../types';

interface HandProps {
    cards: Card[];
    activePlayerIndex: number;
    selectedHandIndex: number | null;
    onCardClick: (index: number) => void;
    canPlayCard: (card: Card) => boolean;
    domRef: (index: number) => (el: HTMLElement | null) => void;
    containerRef: (el: HTMLElement | null) => void;
    drawStartIndex: number | null;
}

/**
 * Hand Component
 * Renders the active player's hand with hover and selection effects.
 */
export const Hand: React.FC<HandProps> = ({
    cards,
    activePlayerIndex,
    selectedHandIndex,
    onCardClick,
    canPlayCard,
    domRef,
    containerRef,
    drawStartIndex
}) => {
    return (
        <div className="absolute bottom-0 w-full flex justify-center space-x-[-10px] z-50 pointer-events-none pb-0" ref={containerRef}>
            {cards.map((card, i) => {
                const isActivatable = canPlayCard(card);
                return (
                    <div key={card.instanceId}
                        ref={domRef(i)}
                        onClick={() => onCardClick(i)}
                        className={`w-36 aspect-[2/3] rounded transition-all duration-300 cursor-pointer relative overflow-hidden border-2 border-slate-300 shadow-2xl pointer-events-auto 
               ${selectedHandIndex === i ? 'transform translate-y-[-20%] z-20 ring-4 ring-yellow-500' : 'transform translate-y-[30%] hover:translate-y-[0%] z-10 hover:z-20'}
               ${card.type === CardType.ENTITY ? 'card-entity' : card.type === CardType.ACTION ? 'card-action' : card.type === CardType.CONDITION ? 'card-condition' : ''}
               ${isActivatable ? 'glow-activatable' : (card.type === CardType.ENTITY ? 'glow-gold' : card.type === CardType.ACTION ? 'glow-green' : 'glow-pink')}
               ${drawStartIndex !== null && i >= drawStartIndex ? 'animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500 fill-mode-backwards' : ''}
             `}
                        style={{ animationDelay: (drawStartIndex !== null && i >= drawStartIndex) ? `${(i - drawStartIndex) * 150}ms` : '0ms' }}
                    >
                        <div className="card-inner-border"></div>
                        <div className="p-2 flex flex-col h-full text-white relative z-10 text-[9px]">
                            <div className="font-orbitron font-bold uppercase tracking-tight py-1 mb-1 border-b border-white/10 text-center truncate">{card.name}</div>
                            <div className="flex-1 opacity-80 font-bold leading-tight font-mono p-1 bg-black/20 rounded-sm">{card.effectText}</div>
                            {card.type === CardType.ENTITY && (<div className="flex justify-between font-orbitron font-black mt-auto text-[10px] pt-1 border-t border-white/10"><span className="text-yellow-500">A:{card.atk}</span><span className="text-blue-400">D:{card.def}</span></div>)}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
