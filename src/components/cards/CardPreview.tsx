import React, { useEffect, useRef } from 'react';
import { CardDefinition, cardTypeLabel } from '../../cards/CardRegistry';
import { CardType } from '../../types';
import { CardDetail, cardFrameClass } from './CardDetail';
import { rarityColor } from '../../cards/rarity';
import './CardPreview.css';
const tone = (color: string) => ({ '--pack-color': color } as React.CSSProperties);
const asCard = (card: CardDefinition) => ({ ...card, instanceId: 'preview', ownerId: 'preview' });
export function CardDescription({ card, onClose }: { card: CardDefinition; onClose?: () => void }) {
  const pawnType = card.pawnType;
  const typing = `${card.type === CardType.PAWN ? `${pawnType ? pawnType[0] + pawnType.slice(1).toLowerCase() : 'Unknown'}/` : ''}${cardTypeLabel(card)}`;
  return <div className="pack-showcase__description" role="region" aria-label={`${card.name} description`}>
    {onClose && <button autoFocus type="button" className="shop-inspector__close" data-sound="cancellation" onClick={onClose}>Close Preview</button>}
    <header className="pack-showcase__heading">
      <h2 className={cardFrameClass(card)}>{card.name}</h2>
      <div className="pack-showcase__typing">[{typing}]</div>
      <div className={`pack-showcase__bar ${cardFrameClass(card)}`} aria-hidden="true" />
    </header>
    <div className="pack-showcase__text" tabIndex={0} role="region" aria-label={`${card.name} effect text`}><p>{card.effectText}</p></div>
  </div>;
}

export function CardPreview({ card, packColor, onClose, showOriginalStats }: { card: CardDefinition; packColor?: string; onClose: () => void; showOriginalStats?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const dismissOutside = (event: React.MouseEvent) => { if (event.target === event.currentTarget) onClose(); };
  return <dialog className="shop-inspector" ref={dialog} style={tone(packColor ?? rarityColor(card.rarity))} onCancel={onClose} onClick={dismissOutside} aria-label={card.name}>
    <div className="shop-inspector__layout" onClick={dismissOutside}>
      <div className="shop-inspector__card" style={tone(rarityColor(card.rarity))}><CardDetail card={asCard(card)} showOriginalStats={showOriginalStats} /></div>
      <CardDescription card={card} onClose={onClose} />
    </div>
  </dialog>;
}
