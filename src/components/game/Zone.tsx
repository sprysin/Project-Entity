import React, { useState, useEffect, useRef } from 'react';
import { PlacedCard, Position, CardType } from '../../types';
import { CardDetail } from '../cards/CardDetail';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';
import { LandCardIcon } from '../icons/LandCardIcon';
import { ActionCardIcon } from '../icons/ActionCardIcon';
import { playSound } from '../../audio';
import { cardRegistry } from '../../cards/CardRegistry';
import { XrayOverlay } from './XrayOverlay';

/**
 * Zone Sub-component: A single slot on the field. Handles display of cards in Attack/Defense/Hidden positions.
 */
export const Zone: React.FC<{
    card: PlacedCard | null;
    fieldStats?: { atk: number; def: number };
    type: 'pawn' | 'action' | 'land';
    onClick?: () => void;
    isSelected?: boolean;
    isSelectable?: boolean;
    isTributeSelected?: boolean;
    isDropTarget?: boolean;
    isActivatable?: boolean;
    isVisuallyHidden?: boolean;
    xray?: boolean;
    contextualActions?: React.ReactNode;
    domRef?: (el: HTMLElement | null) => void;
}> = ({ card, fieldStats, type, onClick, isSelected, isSelectable, isTributeSelected, isDropTarget, isActivatable, isVisuallyHidden, xray, contextualActions, domRef }) => {
    const schedule = useManagedTimeout();
    const visibleCard = isVisuallyHidden ? null : card;
    const displayedAtk = fieldStats?.atk ?? visibleCard?.card.atk ?? 0;
    const displayedDef = fieldStats?.def ?? visibleCard?.card.def ?? 0;
    const originalCard = visibleCard?.card.type === CardType.PAWN ? cardRegistry.getCard(visibleCard.card.id) : undefined;
    const statTone = (current: number, original: number | undefined) =>
        original === undefined || current === original ? 'is-base' : current > original ? 'is-increased' : 'is-decreased';
    // Track previous stats to trigger pop animations
    const prevStats = useRef<{ id: string, atk: number, def: number } | null>(null);
    const prevPlacement = useRef<{ id: string, position: Position } | null>(null);
    const [popStats, setPopStats] = useState<{ atk: boolean, def: boolean }>({ atk: false, def: false });
    const [isRevealFlashing, setIsRevealFlashing] = useState(false);

    useEffect(() => {
        if (!card) {
            prevStats.current = null;
            prevPlacement.current = null;
            return;
        }

        if (card.position === Position.HIDDEN
            && (prevPlacement.current?.id !== card.card.instanceId || prevPlacement.current.position !== Position.HIDDEN)) {
            playSound('hide-card');
        }
        if (card.position !== Position.HIDDEN
            && (type === 'land' || (card.card.type === CardType.ACTION && card.card.isLingering))
            && prevPlacement.current?.id !== card.card.instanceId) {
            playSound('hide-card');
        }
        if (card.card.type === CardType.CONDITION
            && card.position !== Position.HIDDEN
            && prevPlacement.current?.id === card.card.instanceId
            && prevPlacement.current.position === Position.HIDDEN) {
            playSound('toggle');
            setIsRevealFlashing(true);
            schedule(() => setIsRevealFlashing(false), 550);
        }

        if (prevStats.current && prevStats.current.id === card.card.instanceId) {
            if (displayedAtk > prevStats.current.atk || displayedDef > prevStats.current.def) {
                playSound('gain-stat');
            }
            if (displayedAtk !== prevStats.current.atk) {
                setPopStats(prev => ({ ...prev, atk: true }));
                schedule(() => setPopStats(prev => ({ ...prev, atk: false })), 800);
            }
            if (displayedDef !== prevStats.current.def) {
                setPopStats(prev => ({ ...prev, def: true }));
                schedule(() => setPopStats(prev => ({ ...prev, def: false })), 800);
            }
        }
        prevStats.current = { id: card.card.instanceId, atk: displayedAtk, def: displayedDef };
        prevPlacement.current = { id: card.card.instanceId, position: card.position };
    }, [card, displayedAtk, displayedDef, schedule, type]);

    return (
        <div ref={domRef} onClick={onClick} className={`field-zone field-zone--${type} ${visibleCard ? 'field-zone--occupied' : 'field-zone--empty'} w-32 aspect-[2/3] rounded border-2 transition-all cursor-pointer flex flex-col relative hover:z-50 ${isSelected ? 'border-yellow-400 scale-105 z-40' : isTributeSelected ? 'border-green-400 scale-105 animate-pulse z-40' : isSelectable ? 'border-red-500 animate-pulse z-40' : isDropTarget ? 'zone-drop-target z-40' : 'field-zone--idle border-white/5 bg-black/40 hover:border-white/20'} ${isActivatable ? 'glow-activatable z-30' : 'z-10'}`}>
            {contextualActions && (
                <div
                    className="field-context-menu absolute bottom-[calc(100%+0.65rem)] left-1/2 z-[100] w-max max-w-64 -translate-x-1/2 cursor-default"
                    onClick={(event) => event.stopPropagation()}
                >
                    {contextualActions}
                </div>
            )}
            {/* Base Zone Content (Empty State) */}
            <div className={`field-zone-placeholder absolute inset-0 flex flex-col items-center justify-center space-y-2 transition-opacity duration-300 ${visibleCard ? 'opacity-0' : 'opacity-20'}`}>
                {type === 'pawn'
                    ? <i className="fa-solid fa-chess-pawn text-3xl text-white"></i>
                    : type === 'land' ? <LandCardIcon className="h-8 w-8 text-white" />
                    : <ActionCardIcon className="h-8 w-8 text-white" />}
                <span className="text-[10px] font-orbitron tracking-widest text-white font-black">{type.toUpperCase()}</span>
            </div>

            {/* Floating Card Content */}
            {visibleCard && (
                <div key={visibleCard.card.instanceId} data-card-face className="absolute inset-0">
                <div data-field-card-id={visibleCard.card.instanceId} data-attached-to={visibleCard.position !== Position.HIDDEN ? visibleCard.attachedToInstanceIds?.length ? JSON.stringify(visibleCard.attachedToInstanceIds) : undefined : undefined} className={`absolute inset-0 w-full h-full transition-all duration-700 z-20 ${visibleCard.position === Position.HIDDEN ? 'card-back' : ''} ${(visibleCard.position === Position.DEFENSE || (visibleCard.position === Position.HIDDEN && visibleCard.card.type === CardType.PAWN)) ? 'rotate-90' : ''}`}>
                    {visibleCard.position !== Position.HIDDEN && (
                        <CardDetail
                            card={visibleCard.card}
                            counters={visibleCard.counters}
                            highlightAtk={popStats.atk}
                            highlightDef={popStats.def}
                            className="w-full h-full"
                            showOriginalStats={type === 'pawn'}
                        />
                    )}
                {xray && visibleCard.position === Position.HIDDEN && <XrayOverlay card={visibleCard.card} />}
                </div>
                {isRevealFlashing && <div className="effect-marker effect-activation" aria-hidden="true" />}
                {type === 'pawn' && visibleCard.position !== Position.HIDDEN && (
                    <div className={`field-pawn-overlay ${visibleCard.position === Position.DEFENSE ? 'field-pawn-overlay--defense' : 'field-pawn-overlay--attack'}`} aria-label={`Level ${visibleCard.card.level}, attack ${displayedAtk}, defense ${displayedDef}`}>
                        <div className="field-pawn-overlay__level"><span>Lv.</span><strong>{visibleCard.card.level}</strong></div>
                        <div className="field-pawn-overlay__stats">
                            <span className={`${statTone(displayedAtk, originalCard?.atk)} ${visibleCard.position === Position.DEFENSE ? 'is-secondary' : ''} ${popStats.atk ? 'is-popping' : ''}`}>{displayedAtk}</span>
                            <span className="field-pawn-overlay__divider">/</span>
                            <span className={`${statTone(displayedDef, originalCard?.def)} ${visibleCard.position === Position.ATTACK ? 'is-secondary' : ''} ${popStats.def ? 'is-popping' : ''}`}>{displayedDef}</span>
                        </div>
                    </div>
                )}
                </div>
            )}
        </div>
    );
};
