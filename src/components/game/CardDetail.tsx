import React, { useLayoutEffect, useRef, useState } from 'react';
import { NormalAttributeIcon } from '../NormalAttributeIcon';
import { ActionCardIcon } from '../ActionCardIcon';
import { Card, CardType, Attribute } from '../../types';
import { cardTypeLabel } from '../../cards/CardRegistry';
import { cardRegistry } from '../../cards/CardRegistry';

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

const AttributeSymbol = ({ attribute }: { attribute?: Attribute }) => {
    const icons: Partial<Record<Attribute, string>> = {
        [Attribute.FIRE]: 'fa-fire',
        [Attribute.WATER]: 'fa-droplet',
        [Attribute.EARTH]: 'fa-mountain',
        [Attribute.AIR]: 'fa-wind',
        [Attribute.ELECTRIC]: 'fa-bolt',
        [Attribute.LIGHT]: 'fa-sun',
        [Attribute.DARK]: 'fa-moon',
    };
    const icon = attribute && icons[attribute];
    return icon ? <i className={`fa-solid ${icon}`} /> : <NormalAttributeIcon />;
};

// Every face is laid out at 240 × 360, then uniformly scaled to its slot.
const ScaledCard: React.FC<React.PropsWithChildren<{
    className: string;
    onClick?: () => void;
    domRef?: (el: HTMLElement | null) => void;
}>> = ({ children, className, onClick, domRef }) => {
    const slot = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useLayoutEffect(() => {
        const element = slot.current;
        if (!element) return;
        const update = () => setScale(Math.min(element.clientWidth / 240, element.clientHeight / 360));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return <div ref={element => { slot.current = element; domRef?.(element); }}
        onClick={onClick} className={`card-scale-slot ${className}`}>
        <div className="card-scale-face" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
            {children}
        </div>
    </div>;
};

const FittedEffect = ({ text }: { text: string }) => {
    const box = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        let disposed = false;
        const fit = () => {
            if (disposed || !box.current || !content.current) return;
            const element = content.current;
            const available = box.current.clientHeight;
            const fits = () => element.scrollHeight <= available && element.scrollWidth <= element.clientWidth;
            element.style.fontSize = '10px';
            element.style.lineHeight = '1.25';
            element.style.letterSpacing = '0px';
            // Tighten leading and tracking before reducing the type size.
            for (let step = 1; step <= 5 && !fits(); step++) {
                element.style.lineHeight = String(1.25 - step * .05);
                element.style.letterSpacing = `${-step * .05}px`;
            }
            if (!fits()) {
                let low = .1;
                let high = 10;
                for (let step = 0; step < 16; step++) {
                    const size = (low + high) / 2;
                    element.style.fontSize = `${size}px`;
                    if (fits()) low = size;
                    else high = size;
                }
                element.style.fontSize = `${low}px`;
            }
        };
        fit();
        if (typeof document !== 'undefined') document.fonts?.ready.then(fit);
        return () => { disposed = true; };
    }, [text]);
    return <div className="card-effect-frame flex-1 min-h-0 p-2 font-medium text-white/90 bg-black/40 border border-white/10 relative z-10 font-mono shadow-inner">
        <div ref={box} className="h-full overflow-hidden"><div ref={content} className="card-effect-content">{text}</div></div>
    </div>;
};

interface CardDetailProps {
    card: Card;
    isSet?: boolean;
    className?: string;
    onClick?: () => void;
    highlightAtk?: boolean;
    highlightDef?: boolean;
    compact?: boolean;
    domRef?: (el: HTMLElement | null) => void;
}

/**
 * CardDetail Sub-component: A high-fidelity representation of a card.
 * Used in the Hand, the Sidebar, and the Database Gallery.
 */
export const CardDetail: React.FC<CardDetailProps> = ({ card, isSet, className = '', onClick, highlightAtk, highlightDef, domRef }) => {
    const originalCard = cardRegistry.getCard(card.id);
    const getStatColor = (current: number, original?: number) => {
        if (original === undefined) return 'text-yellow-400';
        if (current > original) return 'text-blue-500';
        if (current < original) return 'text-red-500';
        return 'text-yellow-400';
    };

    // Handle hidden state for opponent's Set cards (Sidebar view)
    if (isSet) return (
        <ScaledCard className={className} onClick={onClick} domRef={domRef}>
        <div className={`p-8 rounded-sm bg-slate-100 border-4 border-slate-400 flex flex-col items-center space-y-8 shadow-inner w-full h-full`}>
            <div className="w-24 h-24 rounded-sm border-2 border-slate-300 flex items-center justify-center bg-white/50 rotate-45 shadow-lg">
                <i className="fa-solid fa-eye-slash text-5xl opacity-40 -rotate-45 text-slate-600"></i>
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-orbitron font-black text-slate-600 uppercase tracking-widest">MASKED DATA</h3>
                <p className="font-bold text-xs text-slate-500 uppercase tracking-[0.3em]">Signature Hidden</p>
            </div>
        </div>
        </ScaledCard>
    );

    return (
        <ScaledCard className={className} onClick={onClick} domRef={domRef}>
        <div
            className={`p-2 border-4 w-full h-full rounded shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col space-y-1 relative overflow-hidden transition-all aspect-[2/3] ${card.type === CardType.PAWN ? 'card-pawn glow-gold' : card.type === CardType.ACTION ? 'card-action glow-green' : card.type === CardType.CONDITION ? 'card-condition glow-pink' : ''}`}
        >
            {/* Header: Name + Level */}
            <div className="card-inner-border"></div>
            <div className={`relative z-10 flex shrink-0 h-8 gap-[1px]`}>
                <div className="card-title-box flex-grow p-1 flex items-center border-b-[1px] border-white/10">
                    <h3 className={`text-[10px] font-orbitron font-bold leading-tight tracking-tight text-white line-clamp-2`}>{card.name}</h3>
                </div>
                {card.type === CardType.PAWN && (
                    <div className={`card-title-box w-8 flex-shrink-0 flex items-center justify-center border-b-[1px] border-white/10`}>
                        <span className={`text-[8px] font-orbitron font-black text-yellow-500 leading-tight`}>Lv.{card.level}</span>
                    </div>
                )}
            </div>

            {/* Sub-Header: Attribute/Type OR Action/Condition Status */}
            <div className={`relative z-10 shrink-0 border-b border-white/10 pb-1 mb-1 min-h-[20px] flex items-center`}>
                {card.type === CardType.PAWN ? (
                    <div className="flex items-center space-x-1 w-full">
                        {/* Attribute Bubble */}
                        <div className={`w-5 h-5 text-[8px] rounded-full flex items-center justify-center ${getAttributeColor(card.attribute)} font-bold border border-white/20`}>
                            <AttributeSymbol attribute={card.attribute} />
                        </div>
                        <span className={`text-[9px] font-orbitron text-slate-300 font-bold uppercase tracking-wider`}>
                            [{card.pawnType || 'Unknown'}/Pawn]
                        </span>
                    </div>
                ) : (
                    <div className="w-full text-left pl-1">
                        <span className={`text-[9px] font-orbitron font-bold uppercase tracking-widest block ${card.type === CardType.ACTION ? 'text-green-400' : 'text-pink-400'}`}>
                            [{cardTypeLabel(card)}]
                        </span>
                    </div>
                )}
            </div>

            {/* Artwork placeholder: shared symbols keep the classification recognizable. */}
            <div className="card-artwork" aria-hidden="true">
                <div className="card-artwork-symbol">
                    {card.type === CardType.PAWN ? (
                        <AttributeSymbol attribute={card.attribute} />
                    ) : card.type === CardType.ACTION ? (
                        <ActionCardIcon />
                    ) : (
                        <i className="fa-solid fa-hourglass-half" />
                    )}
                </div>
            </div>

            {/* Body: Effect Text */}
            <FittedEffect text={card.effectText} />

            {/* Footer: Stats (Entities only) */}
            {card.type === CardType.PAWN && (
                <div className={`flex shrink-0 justify-between items-center px-4 py-1 mt-auto bg-black/50 border border-white/10 rounded-sm relative z-10`}>
                    <span className={`font-orbitron font-bold ${getStatColor(card.atk, originalCard?.atk)} text-xs transition-all duration-300 ${highlightAtk ? 'scale-125' : ''}`}>ATK: {card.atk}</span>
                    <span className={`font-orbitron font-bold ${getStatColor(card.def, originalCard?.def)} text-xs transition-all duration-300 ${highlightDef ? 'scale-125' : ''}`}>DEF: {card.def}</span>
                </div>
            )}
        </div>
        </ScaledCard>
    );
};
