import React, { useEffect, useState, type CSSProperties } from 'react';
import { PACKS, type Pack } from '../../shop/packs';
import { PackArtwork } from '../shop/PackOpening';
import { playSound } from '../../audio';
import './DraftPackReveal.css';

const candidates = PACKS.filter(pack => pack.id !== 'master');

function PackReel({ pack, active, reduced }: { pack: Pack; active: boolean; reduced: boolean }) {
  useEffect(() => {
    if (!active) return;
    const times = reduced ? [0] : [0, 80, 180, 300, 450, 640, 880, 1180, 1560, 2040, 2640, 3300];
    const ticks = times.map(time => window.setTimeout(() => playSound('draw-tick'), time));
    const stop = window.setTimeout(() => playSound('gain-stat'), reduced ? 200 : 3600);
    return () => { ticks.forEach(window.clearTimeout); window.clearTimeout(stop); };
  }, [active, reduced]);
  const sequence = reduced ? [pack] : [...Array.from({ length: 5 }, () => candidates).flat(), pack];
  return <div className={`draft-reel${active ? ' is-spinning' : ' is-waiting'}`}
    style={{ '--pack-color': pack.color, '--reel-stop': `${-(sequence.length - 1) * 480}px` } as CSSProperties}>
    <div className="draft-reel__window" aria-hidden="true">
      {active ? <div className="draft-reel__track">{sequence.map((entry, index) =>
        <div className="draft-reel__item" key={index} style={{ '--pack-color': entry.color } as CSSProperties}><PackArtwork pack={entry} /></div>)}</div>
        : <span className="draft-reel__waiting" />}
      <div className="draft-reel__flash" />
    </div>
    {active && <div className="draft-reel__caption"><h2>{pack.name}</h2><span>×5</span></div>}
  </div>;
}

export default function DraftPackReveal({ packs, onOpen }: { packs: readonly Pack[]; onOpen: () => void }) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const first = window.setTimeout(() => setStep(1), reduced ? 600 : 4100);
    const second = window.setTimeout(() => setStep(2), reduced ? 1200 : 8200);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, [reduced]);

  return <section className="draft-pack-reveal" aria-label="Draft pack reveal">
    <div className="draft-pack-reveal__cabinet">
      <div className="draft-pack-reveal__mark" role="img" aria-label="Project Entity"><span /></div>
      <div className="draft-pack-reveal__reels">{packs.map((pack, index) =>
      <React.Fragment key={pack.id}><PackReel pack={pack} active={index === 0 || step >= 1} reduced={reduced} /></React.Fragment>)}</div>
    </div>
    <p className="sr-only" role="status">{step === 2 ? `${packs.map(pack => `Five ${pack.name} packs`).join(' and ')} ready to open.` : 'Revealing draft packs.'}</p>
    <div className="draft-pack-reveal__actions">{step === 2 && <button className="entity-primary" onClick={onOpen}>Open packs <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>}</div>
  </section>;
}
