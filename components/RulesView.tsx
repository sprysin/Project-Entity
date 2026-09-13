import React, { useRef, useState } from 'react';
import { CardDetail } from './Game/CardDetail';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card } from '../types';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import './RulesView.css';

type Topic = {
  id: string; title: string; subtitle: string; icon: string;
  rules?: string[];
  table?: { headings: string[]; rows: string[][] };
  note?: string;
};

const topics: Topic[] = [
  {
    id: 'basics', title: 'The essentials', subtitle: 'Your objective & your deck', icon: 'fa-flag-checkered', rules: [
      'Start with 800 Life Points (LP). Reduce your opponent’s LP to 0 or below to win, through combat or card effects.',
      'A deck contains 40–60 cards, with no more than 3 copies of any one card.',
      'The three card types are Pawns, Actions and Conditions. Actions and Conditions can also be Lingering cards.',
    ]
  },
  {
    id: 'drawing', title: 'Setup & drawing', subtitle: 'Start with five. Keep your hand moving.', icon: 'fa-layer-group',
    rules: ['Each player shuffles their deck and draws 5 cards as their opening hand.'],
    table: {
      headings: ['Draw Phase', 'What to draw'], rows: [
        ['First turn of the game', 'The starting player skips drawing.'],
        ['Later turns: fewer than 5 cards in hand', 'Draw until you have 5 cards.'],
        ['Later turns: 5 or more cards in hand', 'Draw 1 card.'],
      ]
    }
  },
  {
    id: 'turn', title: 'The turn', subtitle: 'Six phases, one turn', icon: 'fa-repeat',
    table: {
      headings: ['Phase', 'What happens'], rows: [
        ['01 · Draw', 'Draw according to your hand size.'],
        ['02 · Standby', 'Apply effects that specify this phase.'],
        ['03 · Main 1', 'Summon or set Pawns, play Actions, set Conditions and use eligible effects.'],
        ['04 · Battle', 'Attack with your Attack Position Pawns.'],
        ['05 · Main 2', 'Another Main Phase, with the same options as Main 1.'],
        ['06 · End', 'Apply end-of-turn effects, then the other player begins their turn.'],
      ]
    }, note: 'First turn: go directly from Main 1 to End. Skip both Battle and Main 2.'
  },
  {
    id: 'field', title: 'The field', subtitle: 'A place for every card', icon: 'fa-border-all', rules: [
      'Each player has 5 Pawn zones and 5 shared Action/Condition zones. Each zone holds one card.',
      'Pawns can be in face-up Attack, face-up Defense or face-down Defense Position.',
      'Normal and Tribute Summons place Pawns in face-up Attack Position. Setting places them in face-down Defense Position.',
      'Face-down cards are hidden from your opponent. You may inspect your own face-down cards.',
    ]
  },
  {
    id: 'summoning', title: 'Summoning Pawns', subtitle: 'Levels 1–10', icon: 'fa-chess-pawn',
    table: {
      headings: ['Level', 'Requirement', 'Per-turn allowance'], rows: [
        ['1–4', 'No tribute', '1 Normal Summon + 1 separate face-down set'],
        ['5–7', 'Tribute 1 Pawn you control', 'Unlimited Tribute Summons and tribute sets'],
        ['8–10', 'Tribute 2 Pawns you control', 'Unlimited Tribute Summons and tribute sets'],
      ]
    }, rules: [
      'Summon or set during either of your Main Phases. The allowances are shared across the whole turn.',
      'When you Tribute Summon or tribute set, the sacrificed Pawns go to the Discard Pile.',
      'You may tribute with all 5 Pawn zones occupied, then place the new Pawn in a zone freed by the tributes.',
      'A face-up Tribute Summon counts as a Normal Summon for “on Normal Summon” effects.',
    ], note: 'Tribute Summons and tribute sets use neither your level 1–4 Normal Summon allowance nor your level 1–4 set allowance.'
  },
  {
    id: 'positions', title: 'Changing position', subtitle: 'Manual changes & Flip Summons', icon: 'fa-arrows-rotate', rules: [
      'During either Main Phase, each Pawn may manually change between Attack and Defense Position once per turn.',
      'A Pawn cannot manually change position on the turn it was summoned or set, or after it has attacked that turn.',
      'Manually turning a face-down Pawn face-up is a Flip Summon. It enters Attack Position and uses its manual position change for that turn.',
      'Position changes caused by card effects do not use the manual position change allowance.',
    ]
  },
  {
    id: 'combat', title: 'Attacking & combat', subtitle: 'Compare stats. Resolve the outcome.', icon: 'fa-burst', rules: [
      'Each Attack Position Pawn may attack once per turn, during its controller’s Battle Phase.',
      'A Pawn may attack on the turn it is summoned or flipped face-up, provided that turn has a Battle Phase.',
      'If your opponent controls any Pawns, attack one of them. Otherwise, attack directly and deal your Pawn’s ATK as LP damage.',
      'An attacked face-down Pawn flips into face-up Defense Position before combat resolves.',
    ], table: {
      headings: ['Matchup', 'Result', 'LP damage'], rows: [
        ['Attack vs. Attack: unequal ATK', 'Destroy the Pawn with lower ATK.', 'Its controller loses the difference in ATK.'],
        ['Attack vs. Attack: equal ATK', 'Destroy both Pawns.', 'None'],
        ['Attack vs. Defense: ATK > DEF', 'Destroy the defending Pawn.', 'None'],
        ['Attack vs. Defense: ATK < DEF', 'Neither Pawn is destroyed.', 'The attacker’s controller loses the difference.'],
        ['Attack vs. Defense: ATK = DEF', 'Neither Pawn is destroyed.', 'None'],
      ]
    }, note: 'Pawns destroyed in combat go to the Discard Pile.'
  },
  {
    id: 'actions', title: 'Actions & Conditions', subtitle: 'Two card types. Different timing.', icon: 'fa-bolt',
    table: {
      headings: ['Rule', 'Actions', 'Conditions'], rows: [
        ['Play from hand', 'Activate in your own Main Phase, or set face-down.', 'Must be set face-down first.'],
        ['Activate after setting', 'May activate the turn they are set.', 'Wait until the turn they were set has ended.'],
        ['Activation timing', 'Your own Main 1 or Main 2 only.', 'Any phase of either player’s turn, once eligible.'],
        ['After resolution', 'Normal Actions go to the Discard Pile.', 'Normal Conditions go to the Discard Pile.'],
        ['Lingering subtype', 'Stays face-up in its zone.', 'Stays face-up in its zone.'],
      ]
    }, rules: [
      'Use an empty Action/Condition zone to play or set a card.',
      'There is no general per-turn limit on playing Actions or setting and activating Conditions. Individual cards may impose limits.',
      'Every activation must meet the card’s requirements and pay its costs.',
    ]
  },
  {
    id: 'lingering', title: 'Lingering cards', subtitle: 'Effects that stay on the field', icon: 'fa-infinity', rules: [
      'Lingering Actions and Conditions stay face-up and continue occupying their zone after activation.',
      'Their text determines whether an effect is continuous, triggered by an event or manually activated.',
      'Remaining face-up does not automatically repeat the original activation effect.',
      'Manual effects follow the card type’s timing: Actions in your own Main Phases; Conditions in any phase of either turn. Apply any further restrictions on the card.',
      'Effects maintained by a Lingering card normally end when it leaves the field. Explicit card text may provide exceptions.',
    ]
  },
  {
    id: 'effects', title: 'Pawn effects & costs', subtitle: 'Check the text before activating', icon: 'fa-wand-magic-sparkles', rules: [
      'Use a Pawn’s effect only when its stated trigger or activation requirements are met.',
      '“On Normal Summon” includes face-up Tribute Summons. It does not trigger when the Pawn is set, Flip Summoned or Special Summoned.',
      'Manually activated Pawn effects are used during your own Main Phases unless the card specifies another timing.',
      'Face-up Pawns may activate effects in Attack or Defense Position unless their text requires a particular position. Face-down Pawns cannot manually activate effects unless explicitly allowed.',
      'Meet all activation requirements and be able to pay the full cost before activating. Pay that cost once per activation, even if resolution involves several selections.',
      'You may pay an LP cost that reduces your LP to exactly 0.',
      'Without a stated usage limit, a manual effect may be used repeatedly whenever its timing, requirements and costs allow.',
    ], table: {
      headings: ['Card text', 'Usage limit'], rows: [
        ['“Once per turn”', 'Once per individual copy of that card.'],
        ['“You can only use this effect of [card name] once per turn”', 'Once across all your copies of that named card.'],
      ]
    }
  },
];


const examples = [
  { id: 'pawn_01', label: 'Pawn', color: '#f5bd48', description: 'Your fighters on the field. Each has a level, ATK, DEF and its own effects.' },
  { id: 'action_01', label: 'Action', color: '#48e0ad', description: 'Play during your Main Phases. Normal Actions go to the Discard Pile after resolving.' },
  { id: 'condition_01', label: 'Condition', color: '#f181ce', description: 'Set first. From the next turn onward, activate during either player’s turn when eligible.' },
];

function ExampleCard({ index, decorative = false }: { index: number; decorative?: boolean }) {
  const example = examples[index];
  const definition = cardRegistry.getAllCards().find(card => card.id === example.id);
  if (!definition) return null;
  const card: Card = { ...definition, instanceId: `rules-${definition.id}`, ownerId: 'rulebook' };
  return <div className={decorative ? 'rule-cover-card' : 'rule-example-card'}><CardDetail card={card} /></div>;
}

const RulesView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [example, setExample] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const topic = selected === null ? null : topics[selected];
  // Long topics have short reading pages; reference tables get their own page.
  const rulePages: string[][] = [];
  if (topic?.rules) for (let i = 0; i < topic.rules.length; i += 4) rulePages.push(topic.rules.slice(i, i + 4));
  const pageCount = Math.max(1, rulePages.length + (topic?.table ? 1 : 0));
  const tablePage = !!topic?.table && page === rulePages.length;
  const resetPosition = () => {
    scroller.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus());
  };
  const open = (index: number) => {
    setSelected(index); setPage(0);
    setExample(topics[index].id === 'lingering' ? 2 : topics[index].id === 'actions' ? 1 : 0);
    resetPosition();
  };
  const turnPage = (direction: number) => {
    if (page + direction >= 0 && page + direction < pageCount) {
      setPage(page + direction); resetPosition();
    } else if (selected !== null && selected + direction >= 0 && selected + direction < topics.length) {
      open(selected + direction);
    }
  };
  return (
    <div ref={scroller} className="rulebook">
      <div className="rulebook-shell">
        <header className="rulebook-topbar">
          <button onClick={() => { setSelected(null); setPage(0); resetPosition(); }} className="rulebook-brand" aria-label="Rulebook home">
            <i className="fa-solid fa-chess-knight" aria-hidden="true" /><span>PROJECT ENTITY<small>THE RULEBOOK</small></span>
          </button>
          <button onClick={onBack} className="rulebook-exit"><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to Hub</button>
        </header>

        {topic === null ? <>
          <section className="rulebook-cover">
            <div className="rulebook-cover-copy">
              <span className="rulebook-eyebrow">LEARN THE GAME</span>
              <h1 ref={heading} tabIndex={-1}>PROJECT<br /><em>ENTITY</em></h1>
              <p>Covers all the major rules and mechanics of standard play.<br />These are subject to change as the game receives balance updates.</p>
              <button className="rulebook-primary" onClick={() => open(0)}>Start with the basics <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
            </div>
            <div className="rulebook-card-fan" aria-label="Example Pawn, Action and Condition cards">
              {[0, 1, 2].map(index => <div key={index} className={`rulebook-fan-item rulebook-fan-${index}`}><ExampleCard index={index} decorative /><span style={{ color: examples[index].color }}>{examples[index].label}</span></div>)}
            </div>
          </section>
          <div className="rulebook-chapter-label"><span>CHOOSE YOUR CHAPTER</span><span>01 — {String(topics.length).padStart(2, '0')}</span></div>
          <nav className="rulebook-chapters" aria-label="Rulebook chapters">
            {topics.map((item, index) => <button key={item.id} onClick={() => open(index)} className={`rulebook-chapter chapter-tone-${index % 3}`}>
              <span className="rulebook-chapter-number">{String(index + 1).padStart(2, '0')}</span>
              <i className={`fa-solid ${item.icon} rulebook-chapter-icon`} aria-hidden="true" />
              <span className="rulebook-chapter-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
              <i className="fa-solid fa-arrow-up-right-from-square rulebook-chapter-arrow" aria-hidden="true" />
            </button>)}
          </nav>
        </> : <>
          <div className="rulebook-breadcrumb"><button onClick={() => { setSelected(null); resetPosition(); }}><i className="fa-solid fa-grip" aria-hidden="true" /> All chapters</button><span>/</span><span>CHAPTER {String(selected! + 1).padStart(2, '0')}</span></div>
          <div className="rulebook-reading-grid">
            <main className="rulebook-reading">
              <div className="rulebook-topic-heading">
                <span className="rulebook-eyebrow"><i className={`fa-solid ${topic.icon}`} aria-hidden="true" /> {topic.subtitle}</span>
                <h1 ref={heading} tabIndex={-1}>{topic.title}</h1>
              </div>
              {pageCount > 1 && <nav className="rulebook-page-tabs" aria-label="Chapter pages">{Array.from({ length: pageCount }, (_, index) => <button key={index} aria-current={index === page ? 'page' : undefined} onClick={() => { setPage(index); resetPosition(); }}>{index === rulePages.length && topic.table ? 'Quick reference' : rulePages.length > 1 ? `Rules ${index + 1}` : 'The rules'}</button>)}</nav>}
              <div key={`${topic.id}-${page}`} className="rulebook-page">
                {tablePage && topic.table ? <div className="rulebook-table-wrap"><table><caption className="sr-only">{topic.title} reference</caption><thead><tr>{topic.table.headings.map(value => <th key={value} scope="col">{value}</th>)}</tr></thead><tbody>{topic.table.rows.map(row => <tr key={row[0]}>{row.map((value, index) => index === 0 ? <th key={index} scope="row">{value}</th> : <td key={index}>{value}</td>)}</tr>)}</tbody></table></div> :
                  <ol className="rulebook-rule-list">{rulePages[page]?.map((rule, index) => <li key={rule}><span className="rulebook-rule-number">{String(page * 4 + index + 1).padStart(2, '0')}</span><p>{rule}</p></li>)}</ol>}
                {topic.note && page === pageCount - 1 && <div className="rulebook-important"><i className="fa-solid fa-star" aria-hidden="true" /><div><strong>REMEMBER</strong><p>{topic.note}</p></div></div>}
              </div>
              <footer className="rulebook-pagination">
                <button disabled={selected === 0 && page === 0} onClick={() => turnPage(-1)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Previous</button>
                <span>{page + 1} / {pageCount}</span>
                {selected === topics.length - 1 && page === pageCount - 1 ? <button onClick={() => { setSelected(null); resetPosition(); }}>All chapters <i className="fa-solid fa-grip" aria-hidden="true" /></button> : <button onClick={() => turnPage(1)}>{page < pageCount - 1 ? 'Next page' : 'Next chapter'} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>}
              </footer>
            </main>
            <aside className="rulebook-example" aria-label="Card examples">
              <span className="rulebook-eyebrow">Card Examples</span>
              <div className="rulebook-example-tabs" role="group" aria-label="Choose a card type">{examples.map((item, index) => <button key={item.id} aria-pressed={example === index} onClick={() => setExample(index)} style={{ '--example-color': item.color } as React.CSSProperties}>{item.label}</button>)}</div>
              <div key={example} className="rulebook-example-stage" style={{ '--example-color': examples[example].color } as React.CSSProperties}><ExampleCard index={example} /></div>
              <p>{examples[example].description}</p>
              {example === 2 && <small>Reinforcement is a Lingering Condition, so it stays face-up after activation.</small>}
            </aside>
          </div>
          <nav className="rulebook-chapter-dots" aria-label="Jump to chapter">{topics.map((item, index) => <button key={item.id} aria-label={item.title} aria-current={selected === index ? 'page' : undefined} title={item.title} onClick={() => open(index)}>{String(index + 1).padStart(2, '0')}</button>)}</nav>
        </>}
      </div>
    </div>
  );
};

export default RulesView;
