import React, { useEffect, useRef, useState } from 'react';
import { CardDetail, ScaledCard } from '../cards/CardDetail';
import type { CardDefinition } from '../../cards/CardRegistry';
import type { Pack } from '../../shop/packs';
import { PACK_SIZE, rarityColor } from '../../shop/PackLogic';
import { CARD_RARITY_TIERS } from '../../types';
import { playSound } from '../../audio';
import './Shop.css';

const tone = (color: string) => ({ '--pack-color': color } as React.CSSProperties);
const asCard = (card: CardDefinition, index = 0) => ({ ...card, instanceId: `preview-${index}`, ownerId: 'preview' });

export function PackArtwork({ pack, size = PACK_SIZE }: { pack: Pack; size?: number }) {
  return <div className={`pack-art pack-art--${pack.id}`} aria-hidden="true">
    <div className="pack-art__halo" /><div className="pack-art__wrapper">
      <span className="pack-art__brand">PROJECT ENTITY</span>
      <div className="pack-art__sigil"><i className={`fa-solid ${pack.icon}`} /></div>
      <strong>{pack.name}</strong><span className="pack-art__edition">{size} CARDS / BASE EDITION</span>
    </div><span className="pack-art__floor" />
  </div>;
}
export function PackOpening({ pack, cards, onInspect, onContinue, newBatch = false, previousPack }: {
  pack: Pack; cards: CardDefinition[]; onInspect: (card: CardDefinition) => void; onContinue: () => void; newBatch?: boolean; previousPack?: Pack;
}) {
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const revealedRef = useRef<number[]>([]);
  const sweepRevealed = useRef(false);
  useEffect(() => {
    setReady(false); setRevealed([]); revealedRef.current = []; sweepRevealed.current = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setReady(true), newBatch ? reduced ? 1000 : 2600 : 850);
    return () => window.clearTimeout(timer);
  }, [cards, newBatch]);
  const reveal = (index?: number, inspect = true) => {
    if (!ready && index !== undefined) return;
    if (!ready) setReady(true);
    const current = revealedRef.current;
    if (index !== undefined && current.includes(index)) {
      if (inspect) onInspect(cards[index]);
      return;
    }
    const next = index === undefined ? cards.map((_, i) => i) : [...current, index];
    const fresh = next.filter(i => !current.includes(i));
    if (!fresh.length) return;
    if (!inspect) sweepRevealed.current = true;
    revealedRef.current = next;
    setRevealed(next);
    playSound(fresh.some(i => CARD_RARITY_TIERS[cards[i].rarity] >= 3) ? 'high-effect' : 'draw-tick');
  };
  const complete = revealed.length === cards.length;
  return <section className={`pack-opening ${ready ? 'is-ready' : 'is-sealed'}${newBatch ? ' pack-opening--new-batch' : ''}`} style={tone(pack.color)} aria-label="Pack opening">
        {!ready && <div className="pack-opening__seal">
          {newBatch && previousPack && <div className="pack-opening__previous" style={tone(previousPack.color)}><PackArtwork pack={previousPack} /></div>}
          {newBatch && <span className="pack-opening__next-label">NEXT SET</span>}
          <PackArtwork pack={pack} size={cards.length} />
        </div>}
        <div className="pack-opening__cards" aria-hidden={!ready}
          onMouseDownCapture={() => { sweepRevealed.current = false; }}
          onClickCapture={event => {
            if (event.detail > 0 && sweepRevealed.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}>{cards.map((card, index) => {
            const shown = revealed.includes(index);
            return <button key={index} type="button" disabled={!ready} className={`pack-reveal ${shown ? 'is-revealed' : ''}`} data-rarity-tier={shown ? CARD_RARITY_TIERS[card.rarity] : undefined} style={{ ...tone(rarityColor(card.rarity)), '--reveal-delay': `${index * 70}ms` } as React.CSSProperties}
              aria-label={shown ? `Inspect ${card.name}, ${card.rarity}` : `Reveal card ${index + 1}`}
              onMouseDown={event => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.focus();
                reveal(index, false);
              }}
              onMouseEnter={event => { if (event.buttons & 1) reveal(index, false); }}
              onDragStart={event => event.preventDefault()}
              onClick={() => reveal(index)}>
              <div className="pack-reveal__stage"><div className="pack-reveal__flip"><div className="pack-reveal__back"><ScaledCard className="w-full h-full" baseWidth={128}><div className="card-back w-full h-full rounded border-2 border-slate-400 shadow-xl" /></ScaledCard></div>
                <div className="pack-reveal__face">{shown && <CardDetail card={asCard(card, index)} />}</div></div>
                {shown && CARD_RARITY_TIERS[card.rarity] >= 3 && <span className="pack-reveal__burst" aria-hidden="true"><span /></span>}
              </div>
              <span className="pack-reveal__rarity">{shown ? card.rarity : 'CLICK TO REVEAL'}</span>
            </button>;
          })}</div>
        <div className="shop-opening-actions">
          {!complete ? <button className="shop-button entity-primary" onClick={() => reveal()}>REVEAL ALL</button>
            : <button className="shop-button entity-primary" data-sound="select" onClick={onContinue}>CONTINUE <i className="fa-solid fa-arrow-right" /></button>}
        </div>
      </section>;
}
