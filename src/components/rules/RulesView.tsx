import BackToHubButton from '../common/BackToHubButton';
import React, { useRef, useState } from 'react';
import { CardDetail } from '../cards/CardDetail';
import { NormalAttributeIcon } from '../icons/NormalAttributeIcon';
import { cardRegistry } from '../../cards/CardRegistry';
import { Attribute, Card, PawnType } from '../../types';
import '../../cards/pawns';
import '../../cards/actions';
import '../../cards/conditions';
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
      'The three card types are Pawns, Actions and Conditions. Actions and Conditions have Normal, Lingering and Attach subtypes.',
    ]
  },
  {
    id: 'drawing', title: 'Setup & drawing', subtitle: 'Start with five. Keep your hand moving.', icon: 'fa-layer-group',
    rules: [
      'Each player shuffles their deck and draws 5 cards as their opening hand.',
      'If you must draw a card from an empty deck, you lose immediately. This applies to the Draw Phase and card effects. Drawing your last card does not itself cause a loss.',
      'If both players reach 0 LP or below at the same time, the duel is a draw.',
    ],
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
    id: 'chains', title: 'Responses & chains', subtitle: 'Take turns responding. Resolve in reverse order.', icon: 'fa-link', rules: [
      'Simultaneous triggered effects form one chain in this order: turn player mandatory effects, opponent mandatory effects, turn player optional effects, opponent optional effects. Optional effects are included only if activated. Build the entire chain before resolving it in reverse order.',
      'Before an attack, phase change or effect resolves, the other player gets a response opportunity. A window appears only if that player has an eligible card, and shows the number of activatable cards.',
      'Eligible responses are Conditions set on an earlier turn and face-up Pawns with an explicitly designated quick effect. Ordinary Pawn effects and Actions cannot join a chain as responses.',
      'Choose a response card or Pass. After a card is added, the other player may respond. A player with no eligible cards passes automatically. Two consecutive passes resolve the chain.',
      'Choose targets and costs before adding the effect. Costs are paid once, when the effect is added, and are not refunded if its target becomes invalid.',
      'Resolve the last effect added first, then work backward. A target that leaves the field is not replaced by another card in the same zone. Removing an effect’s source does not itself negate that effect.',
      'Once the chain finishes, the pending attack or phase change continues if still legal. No new links are added while a chain is resolving.',
    ]
  },
  {
    id: 'field', title: 'The field', subtitle: 'A place for every card', icon: 'fa-border-all', rules: [
      'Each player has 5 Pawn zones and 5 shared Action/Condition zones. Each zone holds one card.',
      'Pawns can be in face-up Attack, face-up Defense or face-down Defense Position.',
      'Normal and Tribute Summons place Pawns in face-up Attack Position. Setting places them in face-down Defense Position.',
      'Face-down cards are hidden from your opponent. You may inspect your own face-down cards.',
      'A card controlled by an opponent still goes to its original owner’s Discard or Void Pile when it leaves the field.',
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
    id: 'pawn-info', title: 'Pawn Information', subtitle: 'Read every part of a Pawn card', icon: 'fa-address-card', rules: [
      'During either Main Phase, each Pawn may manually change between Attack and Defense Position once per turn.',
      'A Pawn cannot manually change position on the turn it was summoned or set, or after it has attacked that turn.',
      'Manually turning a face-down Pawn face-up is a Switch Summon. It enters Attack Position and uses its manual position change for that turn.',
      'A Switch Pawn has [Type/Switch/Pawn] on its card. Its Switch effect triggers when it turns from face-down to face-up, including when attacked.',
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
        ['Attach subtype', 'Stays face-up attached to a field card. Hover to see its target.', 'Stays face-up attached to a field card. Hover to see its target.'],
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
    id: 'attach', title: 'Attach cards', subtitle: 'Link an effect to a card on the field', icon: 'fa-link', rules: [
      'Attach Actions and Attach Conditions stay face-up in their Action/Condition zone after successfully attaching to a field card.',
      'The card text specifies eligible targets: usually a Pawn, but some cards can attach to an Action or Condition.',
      "When an Attach card's target leaves the field, destroy the Attach card.",
      'When its target turns face-down, destroy the Attach card unless its text says otherwise. Its benefits last only while attached.',
      'Attaching does not repeat the original activation. If the chosen target becomes invalid before resolution, the attachment fails and the source is discarded.',
    ]
  },
  {
    id: 'effects', title: 'Pawn effects & costs', subtitle: 'Check the text before activating', icon: 'fa-wand-magic-sparkles', rules: [
      'Discard always means moving a card from the hand to the Discard Pile. Tribute, destroy and send are distinct actions; a card entering the Discard Pile does not by itself count as being discarded. Apply only triggers for the action specified.',
      'Use a Pawn’s effect only when its stated trigger or activation requirements are met.',
      'Face-down Pawns cannot manually activate effects unless explicitly allowed.',
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

const pawnCardFields = [
  ['Name', 'The Pawn’s unique name. Card effects may refer to a Pawn by name.'],
  ['Level', 'Shown as Lv. 1–10. Level determines how many tributes are required to summon or set the Pawn.'],
  ['Attribute', 'The Pawn’s elemental alignment. Attributes can be referenced by card effects.'],
  ['Type', 'The Pawn’s creature classification, shown as [Type/Pawn] or [Type/Switch/Pawn]. Types can be referenced by card effects.'],
  ['Effect', 'The text that explains the Pawn’s abilities, activation requirements, costs and limits.'],
  ['ATK & DEF', 'ATK is used while attacking or being attacked in Attack Position. DEF is used when attacked in Defense Position.'],
] as const;

const pawnTypes = Object.values(PawnType);

const attributes: { value: Attribute; icon?: string; glyph?: string; color: string; description: string }[] = [
  { value: Attribute.FIRE, icon: 'fa-fire', color: '#ef5b4f', description: 'Fire-aligned Pawns.' },
  { value: Attribute.WATER, icon: 'fa-droplet', color: '#4d9cff', description: 'Water-aligned Pawns.' },
  { value: Attribute.EARTH, icon: 'fa-mountain', color: '#b7793f', description: 'Earth-aligned Pawns.' },
  { value: Attribute.AIR, icon: 'fa-wind', color: '#8bdcf5', description: 'Air-aligned Pawns.' },
  { value: Attribute.ELECTRIC, icon: 'fa-bolt', color: '#f4d44d', description: 'Electric-aligned Pawns.' },
  { value: Attribute.NORMAL, glyph: <NormalAttributeIcon />, color: '#cbd0d8', description: 'Pawns without an elemental alignment.' },
  { value: Attribute.DARK, icon: 'fa-moon', color: '#9a6ad8', description: 'Dark-aligned Pawns.' },
  { value: Attribute.LIGHT, icon: 'fa-sun', color: '#ffe89a', description: 'Light-aligned Pawns.' },
];

const pawnInfoTabs = ['Pawn card', 'Types', 'Attributes', 'Changing position'];


const examples = [
  { id: 'pawn_01', label: 'Pawn', color: '#f5bd48', description: 'Your fighters on the field. Each has a level, ATK, DEF and its own effects.' },
  { id: 'action_01', label: 'Action', color: '#48e0ad', description: 'Play during your Main Phases. Normal Actions go to the Discard Pile after resolving.' },
  { id: 'condition_03', label: 'Condition', color: '#f181ce', description: 'Set first. From the next turn onward, activate during either player’s turn when eligible.' },
];

function ExampleCard({ index, decorative = false }: { index: number; decorative?: boolean }) {
  const example = examples[index];
  const definition = cardRegistry.getCard(example.id);
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
  const isPawnInfo = topic?.id === 'pawn-info';
  // Long topics have short reading pages; reference tables get their own page.
  const rulePages: string[][] = [];
  if (topic?.rules) for (let i = 0; i < topic.rules.length; i += 4) rulePages.push(topic.rules.slice(i, i + 4));
  const pageCount = isPawnInfo ? pawnInfoTabs.length : Math.max(1, rulePages.length + (topic?.table ? 1 : 0));
  const tablePage = !!topic?.table && page === rulePages.length;
  const resetPosition = () => {
    scroller.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus());
  };
  const open = (index: number) => {
    setSelected(index); setPage(0);
    setExample(topics[index].id === 'actions' ? 1 : 0);
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
          <button data-sound="select-small" onClick={() => { setSelected(null); setPage(0); resetPosition(); }} className="rulebook-brand" aria-label="Rulebook home">
            <i className="fa-solid fa-chess-knight" aria-hidden="true" /><span>PROJECT ENTITY<small>THE RULEBOOK</small></span>
          </button>
          <BackToHubButton onClick={onBack} />
        </header>

        {topic === null ? <>
          <section className="rulebook-cover">
            <div className="rulebook-cover-copy">
              <span className="rulebook-eyebrow">LEARN THE GAME</span>
              <h1 ref={heading} tabIndex={-1}>PROJECT<br /><em>ENTITY</em></h1>
              <p>Covers all the major rules and mechanics of standard play.<br />These are subject to change as the game receives balance updates.</p>
              <button data-sound="select-small" className="rulebook-primary" onClick={() => open(0)}>Start with the basics <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
            </div>
            <div className="rulebook-card-fan" aria-label="Example Pawn, Action and Condition cards">
              {[0, 1, 2].map(index => <div key={index} className={`rulebook-fan-item rulebook-fan-${index}`}><ExampleCard index={index} decorative /><span style={{ color: examples[index].color }}>{examples[index].label}</span></div>)}
            </div>
          </section>
          <div className="rulebook-chapter-label"><span>CHOOSE YOUR CHAPTER</span><span>01 — {String(topics.length).padStart(2, '0')}</span></div>
          <nav className="rulebook-chapters" aria-label="Rulebook chapters">
            {topics.map((item, index) => <button data-sound="select-small" key={item.id} onClick={() => open(index)} className={`rulebook-chapter chapter-tone-${index % 3}`}>
              <span className="rulebook-chapter-number">{String(index + 1).padStart(2, '0')}</span>
              <i className={`fa-solid ${item.icon} rulebook-chapter-icon`} aria-hidden="true" />
              <span className="rulebook-chapter-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
              <i className="fa-solid fa-arrow-up-right-from-square rulebook-chapter-arrow" aria-hidden="true" />
            </button>)}
          </nav>
        </> : <>
          <div className="rulebook-breadcrumb"><button data-sound="select-small" onClick={() => { setSelected(null); resetPosition(); }}><i className="fa-solid fa-grip" aria-hidden="true" /> All chapters</button><span>/</span><span>CHAPTER {String(selected! + 1).padStart(2, '0')}</span></div>
          <div className="rulebook-reading-grid">
            <main className="rulebook-reading">
              <div className="rulebook-topic-heading">
                <span className="rulebook-eyebrow"><i className={`fa-solid ${topic.icon}`} aria-hidden="true" /> {topic.subtitle}</span>
                <h1 ref={heading} tabIndex={-1}>{topic.title}</h1>
              </div>
              {pageCount > 1 && <nav className="rulebook-page-tabs" aria-label="Chapter pages">{Array.from({ length: pageCount }, (_, index) => <button data-sound="select-small" key={index} aria-current={index === page ? 'page' : undefined} onClick={() => { setPage(index); resetPosition(); }}>{isPawnInfo ? pawnInfoTabs[index] : index === rulePages.length && topic.table ? 'Quick reference' : rulePages.length > 1 ? `Rules ${index + 1}` : 'The rules'}</button>)}</nav>}
              <div key={`${topic.id}-${page}`} className="rulebook-page">
                {isPawnInfo && page === 0 ? <section className="rulebook-pawn-fields" aria-label="Information on a Pawn card">
                  <p className="rulebook-page-intro">Every Pawn card shows the information below. Read these fields together to understand how the Pawn enters play, what effects can interact with it, and how it performs in combat.</p>
                  <div>{pawnCardFields.map(([label, description], index) => <article key={label}><span>{String(index + 1).padStart(2, '0')}</span><h2>{label}</h2><p>{description}</p></article>)}</div>
                </section> : isPawnInfo && page === 1 ? <section aria-label="All Pawn types">
                  <p className="rulebook-page-intro">A Pawn’s Type appears beneath its name as <strong>[Type/Pawn]</strong>, or <strong>[Type/Switch/Pawn]</strong> for a Switch Pawn. Types do not have inherent abilities of their own, however cards of the same type may have stronger synergies when played together.</p>
                  <div className="rulebook-type-grid">{pawnTypes.map((type, index) => <div key={type}><span>{String(index + 1).padStart(2, '0')}</span>{type}</div>)}</div>
                </section> : isPawnInfo && page === 2 ? <section aria-label="All Pawn attributes">
                  <p className="rulebook-page-intro">The circular icon beside a Pawn’s Type shows its Attribute. Like Types, Attributes are classifications used by card effects.</p>
                  <div className="rulebook-attribute-grid">{attributes.map(attribute => <article key={attribute.value} style={{ '--attribute-color': attribute.color } as React.CSSProperties}>{attribute.icon ? <i className={`fa-solid ${attribute.icon}`} aria-hidden="true" /> : <span className="rulebook-attribute-glyph" aria-hidden="true">{attribute.glyph}</span>}<div><h2>{attribute.value}</h2><p>{attribute.description}</p></div></article>)}</div>
                </section> : isPawnInfo && page === 3 ? <section aria-label="Changing position rules">
                  <div className="rulebook-section-kicker"><i className="fa-solid fa-arrows-rotate" aria-hidden="true" /> Manual changes & Switch Summons</div>
                  <ol className="rulebook-rule-list">{topic.rules?.map((rule, index) => <li key={rule}><span className="rulebook-rule-number">{String(index + 1).padStart(2, '0')}</span><p>{rule}</p></li>)}</ol>
                </section> : tablePage && topic.table ? <div className="rulebook-table-wrap"><table><caption className="sr-only">{topic.title} reference</caption><thead><tr>{topic.table.headings.map(value => <th key={value} scope="col">{value}</th>)}</tr></thead><tbody>{topic.table.rows.map(row => <tr key={row[0]}>{row.map((value, index) => index === 0 ? <th key={index} scope="row">{value}</th> : <td key={index}>{value}</td>)}</tr>)}</tbody></table></div> :
                  <ol className="rulebook-rule-list">{rulePages[page]?.map((rule, index) => <li key={rule}><span className="rulebook-rule-number">{String(page * 4 + index + 1).padStart(2, '0')}</span><p>{rule}</p></li>)}</ol>}
                {topic.note && page === pageCount - 1 && <div className="rulebook-important"><i className="fa-solid fa-star" aria-hidden="true" /><div><strong>REMEMBER</strong><p>{topic.note}</p></div></div>}
              </div>
              <footer className="rulebook-pagination">
                <button data-sound="select-small" disabled={selected === 0 && page === 0} onClick={() => turnPage(-1)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Previous</button>
                <span>{page + 1} / {pageCount}</span>
                {selected === topics.length - 1 && page === pageCount - 1 ? <button data-sound="select-small" onClick={() => { setSelected(null); resetPosition(); }}>All chapters <i className="fa-solid fa-grip" aria-hidden="true" /></button> : <button data-sound="select-small" onClick={() => turnPage(1)}>{page < pageCount - 1 ? 'Next page' : 'Next chapter'} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>}
              </footer>
            </main>
            <aside className="rulebook-example" aria-label="Card examples">
              <span className="rulebook-eyebrow">Card Examples</span>
              <div className="rulebook-example-tabs" role="group" aria-label="Choose a card type">{examples.map((item, index) => <button data-sound="select-small" key={item.id} aria-pressed={example === index} onClick={() => setExample(index)} style={{ '--example-color': item.color } as React.CSSProperties}>{item.label}</button>)}</div>
              <div key={example} className="rulebook-example-stage" style={{ '--example-color': examples[example].color } as React.CSSProperties}><ExampleCard index={example} /></div>
              <p>{examples[example].description}</p>
            </aside>
          </div>
          <nav className="rulebook-chapter-dots" aria-label="Jump to chapter">{topics.map((item, index) => <button data-sound="select-small" key={item.id} aria-label={item.title} aria-current={selected === index ? 'page' : undefined} title={item.title} onClick={() => open(index)}>{String(index + 1).padStart(2, '0')}</button>)}</nav>
        </>}
      </div>
    </div>
  );
};

export default RulesView;
