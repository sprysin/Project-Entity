import { useState, type CSSProperties } from 'react';
import { cardRegistry } from '../../cards/CardRegistry';
import '../../decks';
import { CardType, PawnSubtype, type Card } from '../../types';
import { CardDetail, cardFrameClass } from '../cards/CardDetail';
import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import './CardColorTest.css';

const samples = [
  { frame: 'card-token', label: 'Token / Bomb', color: '#9ca3af' },
  { frame: 'card-pawn', label: 'Main deck Pawn', color: '#eebb4f' },
  { frame: 'card-vassal', label: 'Vassal', color: '#7c2204' },
  { frame: 'card-merge', label: 'Merge', color: '#7465ec' },
  { frame: 'card-action', label: 'Action', color: '#20965b' },
  { frame: 'card-condition', label: 'Condition', color: '#d94571' },
].map(sample => {
  const definition = cardRegistry.getAllCards().find(card => cardFrameClass(card) === sample.frame
    && (sample.frame !== 'card-token' || card.pawnSubtype === PawnSubtype.TOKEN)
    && (card.type === CardType.PAWN || !card.isAttached && !card.isLingering && !card.actionSubtype && !card.conditionSubtype));
  return { ...sample, card: definition ? { ...definition, instanceId: `color-test-${sample.frame}`, ownerId: 'color-test' } as Card : undefined };
});

const validHex = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
const fullHex = (value: string) => value.length === 4 ? `#${[...value.slice(1)].map(char => char + char).join('')}` : value;

export default function CardColorTest({ onBack }: { onBack: () => void }) {
  const [colors, setColors] = useState(samples.map(sample => ({ draft: sample.color, applied: sample.color })));
  const update = (index: number, draft: string) => {
    setColors(previous => previous.map((color, position) => position === index
      ? { draft, applied: validHex(draft) ? fullHex(draft) : color.applied } : color));
  };

  return <main className="card-color-test flex-1 overflow-y-auto font-mono">
    <div className="entity-topbar">
      <PageBrand section="SETTINGS / CARD COLOR TEST" />
      <BackToHubButton label="Back to settings" onClick={onBack} />
    </div>
    <div className="card-color-test__body">
      <header className="settings-header">
        <div className="settings-heading">
          <h1>CARD <em>COLOR TEST</em></h1>
          <p>Compare all six frame colors. Changes stay in this room and reset when you leave.</p>
        </div>
        <BackToHubButton label="Reset colors" onClick={() => setColors(samples.map(sample => ({ draft: sample.color, applied: sample.color })))} />
      </header>
      <div className="card-color-test__grid">
        {samples.map((sample, index) => {
          const { draft, applied } = colors[index];
          const originalToken = sample.frame === 'card-token' && applied.toLowerCase() === sample.color;
          return <section key={sample.frame} className="card-color-test__sample" style={{
            '--test-color': applied,
            '--test-light': originalToken ? '#30343b' : `color-mix(in srgb, ${applied} 24%, #000)`,
            '--test-dark': originalToken ? '#191c22' : `color-mix(in srgb, ${applied} 12%, #000)`,
          } as CSSProperties} aria-labelledby={`${sample.frame}-label`}>
            <div className="card-color-test__sample-heading">
              <h2 id={`${sample.frame}-label`}>{sample.label}</h2>
              <button type="button" className="page-back-button" aria-label={`Reset ${sample.label} color`}
                onClick={() => update(index, sample.color)}>Reset</button>
            </div>
            <div className="card-color-test__inputs">
              <input type="color" aria-label={`${sample.label} color picker`} value={applied} onChange={event => update(index, event.target.value)} />
              <input className="settings-text-input" type="text" aria-label={`${sample.label} hex code`}
                aria-invalid={!validHex(draft)} aria-describedby={!validHex(draft) ? `${sample.frame}-help` : undefined} spellCheck={false} maxLength={7}
                value={draft} onChange={event => update(index, event.target.value)} />
            </div>
            {!validHex(draft) && <p id={`${sample.frame}-help`} className="card-color-test__help">
              Enter #RGB or #RRGGBB. Preview keeps the last valid color.
            </p>}
            {sample.card ? <CardDetail card={sample.card} className="card-color-test__card" /> : <p>No sample card available.</p>}
          </section>;
        })}
      </div>
    </div>
  </main>;
}
