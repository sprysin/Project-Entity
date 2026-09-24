import React, { useState, useEffect, useRef } from 'react';
import { PlacedCard, Position, CardType } from '../../types';
import { CardDetail } from '../cards/CardDetail';
import { useManagedTimeout } from '../../hooks/useManagedTimeout';
import { ActionCardIcon } from '../icons/ActionCardIcon';
import { playSound } from '../../audio';
import { cardRegistry } from '../../cards/CardRegistry';

/**
 * Zone Sub-component: A single slot on the field. Handles display of cards in Attack/Defense/Hidden positions.
 */
export const Zone: React.FC<{
    card: PlacedCard | null;
    type: 'pawn' | 'action';
    onClick?: () => void;
    isSelected?: boolean;
    isSelectable?: boolean;
    isTributeSelected?: boolean;
    isDropTarget?: boolean;
    isActivatable?: boolean;
    isVisuallyHidden?: boolean;
    contextualActions?: React.ReactNode;
    domRef?: (el: HTMLElement | null) => void;
}> = ({ card, type, onClick, isSelected, isSelectable, isTributeSelected, isDropTarget, isActivatable, isVisuallyHidden, contextualActions, domRef }) => {
    const schedule = useManagedTimeout();
    const visibleCard = isVisuallyHidden ? null : card;
    const originalCard = visibleCard?.card.type === CardType.PAWN ? cardRegistry.getCard(visibleCard.card.id) : undefined;
    const statTone = (current: number, original: number | undefined) =>
        original === undefined || current === original ? 'is-base' : current > original ? 'is-increased' : 'is-decreased';
    // Track previous stats to trigger pop animations
    const prevStats = useRef<{ id: string, atk: number, def: number } | null>(null);
    const prevPlacement = useRef<{ id: string, position: Position } | null>(null);
    const [popStats, setPopStats] = useState<{ atk: boolean, def: boolean }>({ atk: false, def: false });

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

        if (prevStats.current && prevStats.current.id === card.card.instanceId) {
            if (card.card.atk > prevStats.current.atk || card.card.def > prevStats.current.def) {
                playSound('gain-stat');
            }
            if (card.card.atk !== prevStats.current.atk) {
                setPopStats(prev => ({ ...prev, atk: true }));
                schedule(() => setPopStats(prev => ({ ...prev, atk: false })), 800);
            }
            if (card.card.def !== prevStats.current.def) {
                setPopStats(prev => ({ ...prev, def: true }));
                schedule(() => setPopStats(prev => ({ ...prev, def: false })), 800);
            }
        }
        prevStats.current = { id: card.card.instanceId, atk: card.card.atk, def: card.card.def };
        prevPlacement.current = { id: card.card.instanceId, position: card.position };
    }, [card, schedule]);

    return (
        <div ref={domRef} onClick={onClick} className={`w-32 aspect-[2/3] rounded border-2 transition-all cursor-pointer flex flex-col relative hover:z-50 ${isSelected ? 'border-yellow-400 scale-105 z-40' : isTributeSelected ? 'border-green-400 scale-105 animate-pulse z-40' : isSelectable ? 'border-red-500 animate-pulse z-40' : isDropTarget ? 'zone-drop-target z-40' : 'border-white/5 bg-black/40 hover:border-white/20'} ${isActivatable ? 'glow-activatable z-30' : 'z-10'}`}>
            {contextualActions && (
                <div
                    className="field-context-menu absolute bottom-[calc(100%+0.65rem)] left-1/2 z-[100] w-max max-w-64 -translate-x-1/2 cursor-default"
                    onClick={(event) => event.stopPropagation()}
                >
                    {contextualActions}
                </div>
            )}
            {/* Base Zone Content (Empty State) */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center space-y-2 transition-opacity duration-300 ${visibleCard ? 'opacity-0' : 'opacity-20'}`}>
                {type === 'pawn'
                    ? <i className="fa-solid fa-chess-pawn text-3xl text-white"></i>
                    : <ActionCardIcon className="h-8 w-8 text-white" />}
                <span className="text-[10px] font-orbitron tracking-widest text-white font-black">{type.toUpperCase()}</span>
            </div>

            {/* Floating Card Content */}
            {visibleCard && (
                <div key={visibleCard.card.instanceId} data-card-face className="absolute inset-0">
                <div data-field-card-id={visibleCard.card.instanceId} data-attached-to={visibleCard.position !== Position.HIDDEN ? visibleCard.attachedToInstanceId : undefined} className={`absolute inset-0 w-full h-full transition-all duration-700 z-20 ${visibleCard.position === Position.HIDDEN ? 'card-back' : ''} ${(visibleCard.position === Position.DEFENSE || (visibleCard.position === Position.HIDDEN && visibleCard.card.type === CardType.PAWN)) ? 'rotate-90' : ''}`}>
                    {visibleCard.position === Position.HIDDEN ? (
                        <div className="w-full h-full flex items-center justify-center opacity-40">
                            <i className="fa-solid fa-lock text-2xl text-slate-800"></i>
                        </div>
                    ) : (
                        <CardDetail
                            card={visibleCard.card}
                            highlightAtk={popStats.atk}
                            highlightDef={popStats.def}
                            className="w-full h-full"
                            compact={true}
                            showOriginalStats={type === 'pawn'}
                        />
                    )}
                </div>
                {type === 'pawn' && visibleCard.position !== Position.HIDDEN && (
                    <div className={`field-pawn-overlay ${visibleCard.position === Position.DEFENSE ? 'field-pawn-overlay--defense' : 'field-pawn-overlay--attack'}`} aria-label={`Level ${visibleCard.card.level}, attack ${visibleCard.card.atk}, defense ${visibleCard.card.def}`}>
                        <div className="field-pawn-overlay__level"><span>Lv.</span><strong>{visibleCard.card.level}</strong></div>
                        <div className="field-pawn-overlay__stats">
                            <span className={`${statTone(visibleCard.card.atk, originalCard?.atk)} ${visibleCard.position === Position.DEFENSE ? 'is-secondary' : ''} ${popStats.atk ? 'is-popping' : ''}`}>{visibleCard.card.atk}</span>
                            <span className="field-pawn-overlay__divider">/</span>
                            <span className={`${statTone(visibleCard.card.def, originalCard?.def)} ${visibleCard.position === Position.ATTACK ? 'is-secondary' : ''} ${popStats.def ? 'is-popping' : ''}`}>{visibleCard.card.def}</span>
                        </div>
                    </div>
                )}
                </div>
            )}
        </div>
    );
};
