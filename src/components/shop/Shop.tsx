import React, { useEffect, useRef, useState } from 'react';
import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import { CardDetail } from '../cards/CardDetail';
import { CardDescription, CardPreview } from '../cards/CardPreview';
import { CardDefinition } from '../../cards/CardRegistry';
import { playSound } from '../../audio';
import { CARD_RARITY_TIERS } from '../../types';
import { DEBUG_PACK, PACKS } from '../../shop/packs';
import type { Pack } from '../../shop/packs';
import { advanceRotation, loadRotation, openPack, packCards, PACK_SIZE, rarityColor, saveRotation } from '../../shop/PackLogic';
import './Shop.css';

function PackArtwork({ pack, size = PACK_SIZE }: { pack: Pack; size?: number }) {
  return <div className={`pack-art pack-art--${pack.id}`} aria-hidden="true">
    <div className="pack-art__halo" /><div className="pack-art__wrapper">
      <span className="pack-art__brand">PROJECT ENTITY</span>
      <div className="pack-art__sigil"><i className={`fa-solid ${pack.icon}`} /></div>
      <strong>{pack.name}</strong><span className="pack-art__edition">{size} CARDS / BASE EDITION</span>
    </div><span className="pack-art__floor" />
  </div>;
}
const tone = (color: string) => ({ '--pack-color': color } as React.CSSProperties);
const asCard = (card: CardDefinition, index = 0) => ({ ...card, instanceId: `preview-${index}`, ownerId: 'preview' });

function ShowcaseChevron({ right = false }: { right?: boolean }) {
  return <svg className={`pack-showcase__chevron${right ? ' pack-showcase__chevron--right' : ''}`} viewBox="0 0 40 56" aria-hidden="true">
    <path d="M28 4 4 28 28 52 34 46 16 28 34 10Z" fill="currentColor" />
    <path d="m28 23 5 5-5 5-5-5Z" fill="currentColor" />
  </svg>;
}

function PackShowcase({ pack, onInspect }: { pack: Pack; onInspect: (card: CardDefinition) => void }) {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const cards = packCards(pack);
  const chaseCards = pack.chaseCardIds.map(id => cards.find(card => card.id === id)!);
  const card = slide === 0 ? null : chaseCards[slide - 1];
  const move = (step: number) => {
    setDirection(step);
    setSlide(current => (current + step + chaseCards.length + 1) % (chaseCards.length + 1));
  };
  return <div className="pack-showcase" role="region" aria-label={`${pack.name} showcase`}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    }}>
    <button type="button" className="pack-showcase__arrow" aria-label="Previous showcase item" data-sound="select-small" onClick={() => move(-1)}><ShowcaseChevron /></button>
    <div className="pack-showcase__viewport">
      <div key={slide} className="pack-showcase__slide" style={{ '--slide-direction': direction } as React.CSSProperties}>
        {card ? <div className="pack-showcase__chase">
          <button type="button" className="pack-showcase__card" style={tone(rarityColor(card.rarity))} aria-label={`Inspect ${card.name}, ${card.rarity}`} data-sound="select-small" onClick={() => onInspect(card)}>
            <CardDetail card={asCard(card)} />
          </button>
          <CardDescription card={card} />
        </div> : <PackArtwork pack={pack} />}
      </div>
    </div>
    <button type="button" className="pack-showcase__arrow" aria-label="Next showcase item" data-sound="select-small" onClick={() => move(1)}><ShowcaseChevron right /></button>
    <div className="pack-showcase__positions" aria-label="Showcase position">
      {[null, ...chaseCards].map((entry, index) => <button type="button" key={entry?.id ?? 'pack'} aria-label={entry ? `Preview ${entry.name}` : 'Preview pack artwork'} aria-current={slide === index ? 'true' : undefined} data-sound="select-small" onClick={() => { setDirection(index >= slide ? 1 : -1); setSlide(index); }}><span aria-hidden="true" /></button>)}
    </div>
  </div>;
}

export default function Shop({ onBack }: { onBack: () => void }) {
  const [now, setNow] = useState(Date.now);
  const [rotation, setRotation] = useState(() => loadRotation(Date.now()));
  const [opening, setOpening] = useState<{ pack: Pack; cards: CardDefinition[] } | null>(null);
  const [selected, setSelected] = useState<{ pack: Pack; slot: number } | null>(null);
  const [session, setSession] = useState<{ pack: Pack; batches: CardDefinition[][]; index: number } | null>(null);
  const [summary, setSummary] = useState(false);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const revealedRef = useRef<number[]>([]);
  const sweepRevealed = useRef(false);
  const [inspected, setInspected] = useState<CardDefinition | null>(null);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      setRotation(current => advanceRotation(current, time));
    };
    const interval = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => saveRotation(rotation), [rotation]);
  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => setReady(true), 850);
    return () => window.clearTimeout(timer);
  }, [opening]);
  useEffect(() => { heading.current?.focus(); }, [opening, selected, summary]);
  const remaining = Math.max(0, Math.ceil((rotation.expiresAt - now) / 1000));
  const timer = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  const returnToShop = () => { setOpening(null); setSelected(null); setSession(null); setSummary(false); setInspected(null); setNotice(''); };
  const beginOpening = (pack: Pack, cards: CardDefinition[]) => {
    revealedRef.current = [];
    sweepRevealed.current = false;
    setRevealed([]); setReady(false); setInspected(null); setNotice('');
    setOpening({ pack, cards });
    playSound('to-the-void');
  };
  const startOpening = (pack: Pack, selectedSlot: number, count: 1 | 5) => {
    const current = advanceRotation(rotation, Date.now());
    setRotation(current);
    if (current.packIds[selectedSlot] !== pack.id) {
      setNotice('This slot has rotated. Choose a pack from the new lineup.');
      setOpening(null); setSelected(null); return;
    }
    const batches = Array.from({ length: count }, () => openPack(pack));
    setSession({ pack, batches, index: 0 });
    setSelected(null); setSummary(false);
    beginOpening(pack, batches[0]);
  };
  const reveal = (index?: number, inspect = true) => {
    if (!opening || !ready) return;
    const current = revealedRef.current;
    if (index !== undefined && current.includes(index)) {
      if (inspect) setInspected(opening.cards[index]);
      return;
    }
    const next = index === undefined ? opening.cards.map((_, i) => i) : [...current, index];
    const fresh = next.filter(i => !current.includes(i));
    if (!fresh.length) return;
    if (!inspect) sweepRevealed.current = true;
    revealedRef.current = next;
    setRevealed(next);
    playSound(fresh.some(i => CARD_RARITY_TIERS[opening.cards[i].rarity] >= 3) ? 'high-effect' : 'draw-tick');
  };
  const continueOpening = () => {
    if (session && session.index + 1 < session.batches.length) {
      const next = session.index + 1;
      setSession({ ...session, index: next });
      beginOpening(session.pack, session.batches[next]);
    } else if (session && session.batches.length > 1) {
      setOpening(null); setSummary(true);
    } else returnToShop();
  };
  const results = summary && session ? session.batches.flat().map((card, index) => ({ card, index }))
    .sort((a, b) => CARD_RARITY_TIERS[b.card.rarity] - CARD_RARITY_TIERS[a.card.rarity]
      || a.card.name.localeCompare(b.card.name) || a.card.id.localeCompare(b.card.id)) : [];
  const browsing = !opening && !selected && !summary;
  const complete = opening && revealed.length === opening.cards.length;
  return <main className="entity-page shop">
    <header className="entity-topbar"><PageBrand section="SHOP / CARD DEALER" />
      <BackToHubButton onClick={browsing ? onBack : returnToShop} label={browsing ? undefined : 'Back to shop'} />
    </header>
    <div className={`shop-body${opening ? ' shop-body--opening' : selected ? ' shop-body--detail' : ''}`}>
      {!selected && !summary && <div className="shop-heading"><div>{browsing && <span className="shop-eyebrow">VENDOR: CARD DEALER</span>}
        <h1 ref={heading} tabIndex={-1}>{opening ? opening.pack.name : summary ? 'SESSION PULLS' : selected ? selected.pack.name : <>PACK <em>SELECTION</em></>}</h1>
        {browsing && <p>Rotating stock of packs, unlock more through gameplay</p>}</div>
        {browsing && <div className="shop-clock"><small>NEXT ROTATION</small><strong> {timer}</strong></div>}
      </div>}
      {opening && session && session.batches.length > 1 && <span className="shop-session-progress">PACK {session.index + 1} / {session.batches.length}</span>}
      <p className="shop-notice" role="status">{notice}</p>
      {opening ? <section className={`pack-opening ${ready ? 'is-ready' : 'is-sealed'}`} style={tone(opening.pack.color)} aria-label="Pack opening">
        {!ready && <div className="pack-opening__seal"><PackArtwork pack={opening.pack} size={opening.cards.length} /></div>}
        <div className="pack-opening__cards" aria-hidden={!ready}
          onMouseDownCapture={() => { sweepRevealed.current = false; }}
          onClickCapture={event => {
            if (event.detail > 0 && sweepRevealed.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}>{opening.cards.map((card, index) => {
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
              <div className="pack-reveal__stage"><div className="pack-reveal__flip"><div className="pack-reveal__back"><span className="pack-back-logo" /><span>PROJECT ENTITY</span><small>{String(index + 1).padStart(2, '0')} / {String(opening.cards.length).padStart(2, '0')}</small></div>
                <div className="pack-reveal__face">{shown && <CardDetail card={asCard(card, index)} />}</div></div>
                {shown && CARD_RARITY_TIERS[card.rarity] >= 3 && <span className="pack-reveal__burst" aria-hidden="true"><span /></span>}
              </div>
              <span className="pack-reveal__rarity">{shown ? card.rarity : 'CLICK TO REVEAL'}</span>
            </button>;
          })}</div>
        <div className="shop-opening-actions">
          {!complete ? <button className="shop-button" disabled={!ready} onClick={() => reveal()}>REVEAL ALL</button>
            : <button className="shop-button" data-sound="select" onClick={continueOpening}>CONTINUE <i className="fa-solid fa-arrow-right" /></button>}
        </div>
      </section> : summary ? <section className="shop-results" aria-label="Session pulls">
        <div className="shop-results__heading"><div className="shop-results__title"><h1 ref={heading} tabIndex={-1}>SESSION PULLS</h1><span>{results.length} CARDS</span></div><button className="shop-button" data-sound="select" onClick={returnToShop}>CONTINUE</button></div>
        <div className="shop-results__grid">{results.map(({ card, index }) => <button key={index} className="shop-result" style={tone(rarityColor(card.rarity))} data-rarity-tier={CARD_RARITY_TIERS[card.rarity]} data-sound="select-small" aria-label={`Inspect ${card.name}, ${card.rarity}`} onClick={() => setInspected(card)}>
          <div className="shop-result__card"><CardDetail card={asCard(card, index)} /></div><span>{card.rarity}</span>
        </button>)}</div>
      </section> : selected ? <section className="shop-pack-detail" style={tone(selected.pack.color)} aria-label="Pack details">
        <div className="shop-pack-detail__showcase">
          <div className="shop-pack-detail__strip"><span>{selected.slot === 0 ? 'TEMP PACK' : `FEATURED SLOT / 0${selected.slot}`}</span><span>PACK SHOWCASE</span></div>
          <PackShowcase pack={selected.pack} onInspect={setInspected} />
          <div className="shop-pack-detail__edition"><span>PROJECT ENTITY</span><span>{String(PACK_SIZE).padStart(2, '0')} CARDS / PACK</span></div>
        </div>
        <div className="shop-pack-detail__copy">
          <header className="shop-pack-detail__header"><span className="shop-eyebrow">PACK DETAILS</span><h1 ref={heading} tabIndex={-1}>{selected.pack.name}</h1><p>{selected.pack.description}</p></header>
          <dl className="shop-pack-detail__stats">
            <div><dt>CARDS IN POOL</dt><dd>{selected.pack.cardIds.length}</dd></div>
            <div><dt>CARDS PER PACK</dt><dd>{PACK_SIZE}</dd></div>
            <div><dt>PACK COST</dt><dd>000</dd></div>
          </dl>
          <div className="shop-pack-detail__purchase">
            <div className="shop-pack-detail__actions">
              <button className="shop-button shop-pack-option" aria-label="OPEN 1 PACK" onClick={() => startOpening(selected.pack, selected.slot, 1)}><strong>OPEN 1 PACK</strong><small>{PACK_SIZE} cards</small></button>
              <button className="shop-button shop-pack-option shop-pack-option--batch" aria-label="OPEN 5 PACKS" onClick={() => startOpening(selected.pack, selected.slot, 5)}><strong>OPEN 5 PACKS</strong><small>{PACK_SIZE * 5} cards</small></button>
            </div>
          </div>
        </div>
      </section> : <>
        <div className="shop-pack-grid">{rotation.packIds.map((id, index) => {
          const pack = PACKS.find(entry => entry.id === id)!;
          return <button key={`${index}-${id}`} className="shop-pack" style={tone(pack.color)} data-sound="select" onClick={() => { setSelected({ pack, slot: index }); setNotice(''); }}>
            <span className="shop-pack__top">{index === 0 ? 'TEMP PACK' : `FEATURED SLOT / 0${index}`}</span>
            <PackArtwork pack={pack} /><div className="shop-pack__copy"><h2>{pack.name}</h2>
              <span className="shop-pack__cta">PACK COST <span>000</span></span>
            </div>
          </button>;
        })}</div>
        <div className="shop-opening-actions">
          <button type="button" className="shop-button" data-sound="select" onClick={() => { setSession(null); beginOpening(DEBUG_PACK, packCards(DEBUG_PACK)); }}>Debug pulls</button>
        </div>
      </>}
    </div>
    {inspected && <CardPreview card={inspected} packColor={selected?.pack.color ?? opening?.pack.color ?? session?.pack.color ?? rarityColor(inspected.rarity)} onClose={() => setInspected(null)} />}
  </main>;
}

