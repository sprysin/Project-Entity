import { isGeneratedCard, isReservePawn } from '../../game/cardHelpers';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AttributeIcon } from '../icons/AttributeIcon';
import { ActionCardIcon } from '../icons/ActionCardIcon';
import { Card, CardType, Attribute, PawnSubtype } from '../../types';
import { cardSubtype, cardTypeLabel } from '../../cards/CardRegistry';
import { cardRegistry } from '../../cards/CardRegistry';
import { attributeColors } from './attributeColors';

export const cardFrameClass = (card: Pick<Card, 'type' | 'pawnSubtype' | 'actionSubtype'>) =>
    isGeneratedCard(card) ? 'card-token' : card.pawnSubtype === PawnSubtype.MERGE ? 'card-merge' : isReservePawn(card) ? 'card-vassal' : card.type === CardType.PAWN ? 'card-pawn' : card.type === CardType.ACTION ? 'card-action' : 'card-condition';

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
    const lines = text.split('\n');
    const bulletStart = lines.findIndex(line => line.startsWith('- '));
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
        <div ref={box} className="h-full overflow-hidden"><div ref={content} className="card-effect-content">
            {bulletStart < 0 ? text : <>
                {lines.slice(0, bulletStart).join(' ')}
                <ul className="list-disc pl-4">
                    {lines.slice(bulletStart).map((line, index) => <li key={index}>{line.replace(/^-\s*/, '')}</li>)}
                </ul>
            </>}
        </div></div>
    </div>;
};

interface CardDetailProps {
    card: Card;
    counters?: Record<string, number>;
    isSet?: boolean;
    className?: string;
    onClick?: () => void;
    highlightAtk?: boolean;
    highlightDef?: boolean;
    showOriginalStats?: boolean;
    domRef?: (el: HTMLElement | null) => void;
}

/**
 * CardDetail Sub-component: A high-fidelity representation of a card.
 * Used in the Hand, the Sidebar, and the Database Gallery.
 */
export const CardDetail: React.FC<CardDetailProps> = ({ card, counters, isSet, className = '', onClick, highlightAtk, highlightDef, showOriginalStats, domRef }) => {
    const artworkSubtype = cardSubtype(card);
    const framedArtwork = artworkSubtype !== null;
    const visibleCounters = Object.entries<number>(counters ?? {}).filter(([, count]) => count > 0);
    const originalCard = cardRegistry.getCard(card.id);
    const changedAttribute = originalCard?.attribute !== undefined && card.attribute !== originalCard.attribute;
    const originalPawnType = card.fieldOriginalPawnType ?? originalCard?.pawnType;
    const changedPawnType = originalPawnType !== undefined && card.pawnType !== originalPawnType;
    const originalStats = card.tokenOriginalStats ?? originalCard;
    const displayedAtk = showOriginalStats ? originalStats?.atk ?? card.atk : card.atk;
    const displayedDef = showOriginalStats ? originalStats?.def ?? card.def : card.def;
    const getStatColor = (current: number, original?: number) => {
        if (original === undefined) return 'text-yellow-400';
        if (current > original) return 'text-[var(--increased-stat-color)]';
        if (current < original) return 'text-red-500';
        return 'text-yellow-400';
    };

    // Handle hidden state for opponent's Set cards (Sidebar view)
    if (isSet) return (
        <ScaledCard className={className} onClick={onClick} domRef={domRef}>
        <div className="hidden-card-face card-back" aria-label="Hidden card">
            <div className="hidden-card-icon" aria-hidden="true">
                <i className="fa-solid fa-eye-slash" />
            </div>
        </div>
        </ScaledCard>
    );

    return (
        <ScaledCard className={className} onClick={onClick} domRef={domRef}>
        <div
            className={`p-2 border-4 w-full h-full rounded shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col space-y-1 relative overflow-hidden transition-all aspect-[2/3] ${cardFrameClass(card)} ${isGeneratedCard(card) || isReservePawn(card) ? '' : card.type === CardType.PAWN ? 'glow-gold' : card.type === CardType.ACTION ? 'glow-green' : 'glow-pink'}`}
        >
            {/* Header: Name + Level */}
            <div className="card-inner-border"></div>
            <div className={`relative z-10 flex shrink-0 h-8 gap-[1px]`}>
                <div className="card-title-box flex-grow p-1 flex items-center border-b-[1px] border-white/10">
                    <h3 className={`text-[10px] font-orbitron font-bold leading-tight tracking-tight text-white line-clamp-2`}>{card.name}</h3>
                </div>
                {card.type === CardType.PAWN && (
                    <div className={`card-title-box w-8 flex-shrink-0 flex items-center justify-center border-b-[1px] border-white/10`}>
                        <span className="flex items-baseline gap-[1px] font-orbitron font-black text-yellow-500 leading-none" aria-label={`Level ${card.level}`}>
                            <span className="text-[6px]">Lv.</span>
                            <span className="text-[12px]">{card.level}</span>
                        </span>
                    </div>
                )}
            </div>

            {/* Sub-Header: Attribute/Type OR Action/Condition Status */}
            <div className={`relative z-10 shrink-0 border-b border-white/10 pb-1 mb-1 min-h-[20px] flex items-center`}>
                {card.type === CardType.PAWN ? (
                    <div className="flex items-center space-x-1 w-full">
                        {/* Attribute Bubble */}
                        <div aria-label={`${card.attribute ?? 'NORMAL'} attribute${changedAttribute ? ' (changed)' : ''}`} style={{
                            backgroundColor: attributeColors[card.attribute ?? Attribute.NORMAL],
                            color: '#0f172a',
                            boxShadow: card.attribute && card.attribute !== Attribute.NORMAL ? `0 0 10px ${attributeColors[card.attribute]}cc` : undefined,
                        }} className={`w-5 h-5 text-[14px] rounded-full flex items-center justify-center font-bold border ${changedAttribute ? 'ring-2 ring-[var(--increased-stat-color)] border-[var(--increased-stat-color)]' : 'border-white/20'}`}>
                            <AttributeIcon attribute={card.attribute} />
                        </div>
                        <span className={`text-[9px] font-orbitron text-slate-300 font-bold uppercase tracking-wider`}>
                            [<span className={changedPawnType ? 'text-[var(--increased-stat-color)]' : undefined}
                                aria-label={changedPawnType ? `${card.pawnType} type (changed)` : undefined}>{card.pawnType || 'Unknown'}</span>/{cardTypeLabel(card)}]
                        </span>
                    </div>
                ) : (
                    <div className="w-full text-left pl-1">
                        <span className="card-type-label text-[9px] font-orbitron font-bold uppercase tracking-widest block">
                            [{cardTypeLabel(card)}]
                        </span>
                    </div>
                )}
            </div>

            {/* Artwork placeholder: shared symbols keep the classification recognizable. */}
            <div className="card-artwork">
                <div className={`card-artwork-symbol${framedArtwork ? ' card-artwork-symbol--framed' : ''}`} data-subtype={artworkSubtype ?? undefined} aria-hidden="true">
                    {framedArtwork && <svg className="card-artwork-subtype-frame" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3">
                        {artworkSubtype === 'Attach' ? <polygon points="50,4 97,94 3,94" strokeLinejoin="round" />
                            : artworkSubtype === 'Land' ? <polygon points="26,4 74,4 98,50 74,96 26,96 2,50" strokeLinejoin="round" />
                            : artworkSubtype === 'Lingering' ? <circle cx="50" cy="50" r="46" />
                            : <rect x="4" y="4" width="92" height="92" />}
                        {artworkSubtype === 'Contract' && <path d="M -8 15 V 85 M 108 15 V 85" />}
                    </svg>}
                    {card.type === CardType.PAWN ? (
                        <AttributeIcon attribute={card.attribute} />
                    ) : card.type === CardType.ACTION ? (
                        <ActionCardIcon />
                    ) : (
                        <i className="fa-solid fa-hourglass-half" />
                    )}
                </div>
                {visibleCounters.length > 0 && <div className="field-pawn-overlay field-counter-overlay">
                    {visibleCounters.map(([name, count]) => <div key={name} className="field-pawn-overlay__level field-counter-overlay__count" title={name} aria-label={`${name}: ${count}`}>
                        <i className="fa-solid fa-circle-dot" aria-hidden="true" /><strong>{count}</strong>
                    </div>)}
                </div>}
            </div>

            {card.mergeMaterials?.length ? <div className="card-materials" aria-label={`Merge materials: ${card.mergeMaterials.join(' + ')}`}>
                {card.mergeMaterials.map(name => `"${name}"`).join(' + ')}
            </div> : null}

            {/* Body: Effect Text */}
            <FittedEffect text={card.effectText} />

            {/* Footer: Stats (Entities only) */}
            {card.type === CardType.PAWN && (
                <div className={`flex shrink-0 justify-between items-center px-4 py-1 mt-auto bg-black/50 border border-white/10 rounded-sm relative z-10`}>
                    <span className={`font-orbitron font-bold ${getStatColor(displayedAtk, originalStats?.atk)} text-xs transition-all duration-300 ${highlightAtk && !showOriginalStats ? 'scale-125' : ''}`}>ATK: {displayedAtk}</span>
                    <span className={`font-orbitron font-bold ${getStatColor(displayedDef, originalStats?.def)} text-xs transition-all duration-300 ${highlightDef && !showOriginalStats ? 'scale-125' : ''}`}>DEF: {displayedDef}</span>
                </div>
            )}
        </div>
        </ScaledCard>
    );
};
