import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import React, { useRef, useState } from 'react';
import { CardDetail } from '../cards/CardDetail';
import { NormalAttributeIcon } from '../icons/NormalAttributeIcon';
import { attributeColors } from '../cards/attributeColors';
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
    id: 'basics', title: 'Starting Info', subtitle: 'Your objective & your deck', icon: 'fa-flag-checkered', rules: [
      'Start with 800 Life Points (LP). Reduce your opponent’s LP to 0 or below to win, through combat or card effects.',
      'A deck contains 40–60 cards, with no more than 3 copies of any one card.',
      'The three card types are Pawns, Actions and Conditions. Actions and Conditions have Normal, Lingering and Attach subtypes; Actions also have Contract, Land and Bomb subtypes.',
    ]
  },
  {
    id: 'draw-phase', title: 'Drawing each turn', subtitle: 'Draw according to your hand size', icon: 'fa-layer-group',
    table: {
      headings: ['Draw Phase', 'What to draw'], rows: [
        ['First turn of the game', 'The starting player skips drawing.'],
        ['Later turns: fewer than 5 cards in hand', 'Draw the number of cards needed to reach 5, based on your starting hand size.'],
        ['Later turns: 5 or more cards in hand', 'Draw 1 card.'],
      ]
    }, note: 'Bombs are generated Action cards with grey borders, shuffled into a deck by card effects. When drawn, a Bomb applies its ON DRAW effect, is revealed, then destroyed and disappears. It consumes one draw and does not enter your hand or Discard; you do not draw a replacement.'
  },
  {
    id: 'turn', title: 'The turn', subtitle: 'Breakdown of all six phases', icon: 'fa-repeat',
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
    id: 'chains', title: 'Responses & chains', subtitle: 'The flow of compounding effects', icon: 'fa-link', rules: [
      'Simultaneous triggered effects form one chain in this order: turn player mandatory effects, opponent mandatory effects, turn player optional effects, opponent optional effects. Optional effects are included only if activated. Build the entire chain before resolving it in reverse order.',
      'Before an attack, phase change or effect resolves, the other player gets a response opportunity. A window appears only if that player has an eligible card, and shows the number of activatable cards.',
      'Eligible responses are Conditions set on an earlier turn and face-up Pawns with an explicitly designated quick effect. Ordinary Pawn effects and Actions cannot join a chain as responses.',
      'After a card is added to a chain, the other player may respond. A player with no eligible effects doesnt get a response opportunity.',
      'Resolve the last effect in the chain first, then work backward. Removing an effect’s source does not itself negate that effect.',
      'Once the chain finishes, the pending attack or phase change continues if still legal. No new links are added while a chain is resolving.',
    ]
  },
  {
    id: 'field', title: 'The field', subtitle: 'Field layout and zone rules', icon: 'fa-border-all', rules: [
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
    ]
  },
  {
    id: 'reserve', title: 'The Reserve', subtitle: 'An additional deck toolbox', icon: 'fa-layer-group', rules: [
      'Your Reserve is separate from your deck and holds up to 10 extra Pawns. A Reserve can hold either Vassal or Merge Pawns.',
      'Vassal Pawns are cards known for there red frame. To summon a Vassal from the Reserve you must use a Contract Action.',
      'When you use a Contract Action to Vassal summon you place the pawn in face-up Attack or Defense Position. This is counted as a special summon.'
    ]
  },
  {
    id: 'pawn-info', title: 'Pawn Information', subtitle: 'Pawn card breakdown', icon: 'fa-address-card', rules: [
      'During either Main Phase, each Pawn may manually change between Attack and Defense Position once per turn.',
      'A Pawn cannot manually change position on the turn it was summoned or set, or after it has attacked that turn.',
      'Manually turning a face-down Pawn face-up is a Switch Summon. It enters Attack Position and uses its manual position change for that turn.',
      'A Switch Pawn has [Type/Switch/Pawn] on its card. Its Switch effect triggers when it turns from face-down to face-up, including when attacked.',
      'Position changes caused by card effects do not use the manual position change allowance.',
    ]
  },
  {
    id: 'combat', title: 'Attacking & combat', subtitle: 'How to fight in the Battle Phase', icon: 'fa-burst', rules: [
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
    }
  },
  {
    id: 'actions', title: 'Actions & Conditions', subtitle: 'Card type breakdown', icon: 'fa-bolt',
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
      'Use an empty Action/Condition zone to play or set a card, except Lands, which use the shared Land Zone.',
      'There is no general per-turn limit on playing Actions or setting and activating Conditions. Individual cards may impose limits.',
      'Every activation must meet the card’s requirements and pay its costs.',
    ]
  },
  {
    id: 'land', title: 'Land cards', subtitle: 'One shared active Land', icon: 'fa-mountain-sun', rules: [
      'Lands are Action Cards. Play them face-up during your Main Phase into the Land Zone above the Reserve, left of Draw. Lands can never be set.',
      'Each new Land covers the previous Land. Only the top card is active; covered Lands keep their place and their effects stop applying.',
      'A Land name may appear only once anywhere in the stack. Different Lands have no stack limit.',
      'Removing or destroying the active Land removes only that card. The Land underneath immediately becomes active again.',
      'Either player can activate the active Land during their own Main Phase when its requirements are met. Its original owner does not have exclusive use.',
      'Once means once for that copy while it remains in the stack, shared by both players. Covering it does not reset its use.',
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

const attributes: { value: Attribute; icon?: string; glyph?: string; color: string }[] = [
  { value: Attribute.FIRE, icon: 'fa-fire', color: attributeColors[Attribute.FIRE] },
  { value: Attribute.WATER, icon: 'fa-droplet', color: attributeColors[Attribute.WATER] },
  { value: Attribute.EARTH, icon: 'fa-mountain', color: attributeColors[Attribute.EARTH] },
  { value: Attribute.AIR, icon: 'fa-wind', color: attributeColors[Attribute.AIR] },
  { value: Attribute.ELECTRIC, icon: 'fa-bolt', color: attributeColors[Attribute.ELECTRIC] },
  { value: Attribute.NORMAL, glyph: <NormalAttributeIcon />, color: attributeColors[Attribute.NORMAL] },
  { value: Attribute.DARK, icon: 'fa-moon', color: attributeColors[Attribute.DARK] },
  { value: Attribute.LIGHT, icon: 'fa-sun', color: attributeColors[Attribute.LIGHT] },
];

type RuleSection = Partial<Topic> & {
  id: string; title: string; content?: 'pawn-card' | 'types' | 'attributes';
  collapsible?: boolean; examples?: { id: string; label: string }[];
};
type Chapter = { id: string; title: string; subtitle: string; icon: string; sections: RuleSection[] };

// Keep the authored rule text above intact. Chapters only organize that content.
const topicById = Object.fromEntries(topics.map(topic => [topic.id, topic]));
const referenceSections: RuleSection[] = [
  { id: 'types', title: 'Pawn Types', content: 'types' },
  { id: 'attributes', title: 'Pawn Attributes', content: 'attributes' },
];
const chapterGroups: { title: string; description: string; chapters: Chapter[] }[] = [
  {
    title: 'Duel Basics', description: 'Know your cards, your field and how to begin.', chapters: [
      {
        ...topicById.basics, title: 'Goal & deck', sections: [
          { ...topicById.basics, title: 'Your objective & your deck' },
        ]
      },
      {
        ...topicById['pawn-info'], title: 'Pawns', sections: [
          { id: 'pawn-card', title: 'Read a Pawn card', content: 'pawn-card' },
          ...referenceSections,
        ]
      },
      {
        ...topicById.actions, sections: [
          {
            ...topicById.actions, title: 'Playing Actions & Conditions', examples: [
              { id: 'A_Void_Blast', label: 'Normal Action' }, { id: 'C_Dark_Draw', label: 'Normal Condition' },
            ]
          },
          { ...topicById.lingering, collapsible: true, examples: [{ id: 'A_Call_To_Arms', label: 'Lingering Action' }] },
          { ...topicById.attach, collapsible: true, examples: [{ id: 'A_Withering_Sword', label: 'Attach Action' }] },
          { ...topicById.land, collapsible: true, examples: [{ id: 'A_Shrouded_Kingdom', label: 'Land Action' }] },
        ]
      },
      { ...topicById.field, sections: [topicById.field] },
    ],
  },
  {
    title: 'Play a turn', description: 'Understand the turn phases, Pawn summons, and battle rules.', chapters: [
      {
        ...topicById.turn, title: 'Turn sequence & drawing', sections: [
          topicById.turn,
          topicById['draw-phase'],
        ]
      },
      {
        ...topicById.summoning, title: 'Summon & position Pawns', sections: [
          topicById.summoning,
          { ...topicById['pawn-info'], id: 'position', title: 'Changing position & Switch Summons' },
        ]
      },
      { ...topicById.combat, sections: [topicById.combat] },
    ],
  },
  {
    title: 'Effects & special mechanics', description: 'Understand costs, responses and Reserve summons.', chapters: [
      { ...topicById.effects, sections: [topicById.effects] },
      {
        ...topicById.chains, sections: [
          { id: 'responses', title: 'Who can respond', rules: topicById.chains.rules!.slice(1, 4) },
          { id: 'resolution', title: 'Resolving a chain', rules: topicById.chains.rules!.slice(4) },
          { id: 'simultaneous', title: 'Simultaneous triggered effects', rules: topicById.chains.rules!.slice(0, 1) },
        ]
      },
      {
        ...topicById.reserve, sections: [
          { ...topicById.reserve, rules: topicById.reserve.rules!.slice(0, 1) },
          {
            id: 'vassal', title: 'Vassal cards', rules: topicById.reserve.rules!.slice(1), examples: [
              { id: 'P_Patron_Of_Judgement', label: 'Vassal Pawn' }, { id: 'A_Scripture_Of_Faith', label: 'Contract Action' },
            ]
          },
        ]
      },
    ],
  },
];
const quickReference: Chapter = {
  id: 'reference', title: 'Quick reference', subtitle: 'Tables, Types & Attributes', icon: 'fa-book-open',
  sections: [
    ...[topicById.turn, topicById['draw-phase'], topicById.summoning, topicById.combat, topicById.actions, topicById.effects]
      .map(topic => ({ id: `reference-${topic.id}`, title: topic.title, table: topic.table })),
    ...referenceSections,
  ],
};
const chapters = [...chapterGroups.flatMap(group => group.chapters), quickReference];


const examples = [
  { id: 'P_Solstice_Sentinel', label: 'Pawn', color: '#f5bd48' },
  { id: 'A_Void_Blast', label: 'Action', color: '#48e0ad' },
  { id: 'C_Dark_Draw', label: 'Condition', color: '#f181ce' },
];

function ExampleCard({ id, decorative = false }: { id: string; decorative?: boolean }) {
  const definition = cardRegistry.getCard(id);
  if (!definition) return null;
  const card: Card = { ...definition, instanceId: `rules-${definition.id}`, ownerId: 'rulebook' };
  return <div className={decorative ? 'rule-cover-card' : 'rule-example-card'}><CardDetail card={card} /></div>;
}

function SectionContent({ section }: { section: RuleSection }) {
  if (section.content === 'pawn-card') return <div className="rulebook-pawn-fields">
    <p className="rulebook-page-intro">Every Pawn card shows the information below. Read these fields together to understand how the Pawn enters play, what effects can interact with it, and how it performs in combat.</p>
    <div className="rulebook-pawn-example"><ExampleCard id={examples[0].id} /><dl>{pawnCardFields.map(([label, description]) => <div key={label}><dt>{label}</dt><dd>{description}</dd></div>)}</dl></div>
  </div>;
  if (section.content === 'types') return <>
    <p className="rulebook-page-intro">A Pawn’s Type appears beneath its name as <strong>[Type/Pawn]</strong>, or <strong>[Type/Switch/Pawn]</strong> for a Switch Pawn. Types do not have inherent abilities of their own, however cards of the same type may have stronger synergies when played together.</p>
    <div className="rulebook-type-grid">{pawnTypes.map(type => <div key={type}>{type}</div>)}</div>
  </>;
  if (section.content === 'attributes') return <>
    <p className="rulebook-page-intro">The circular icon beside a Pawn’s Type shows its Attribute. Like Types, Attributes are classifications used by card effects.</p>
    <div className="rulebook-attribute-grid">{attributes.map(attribute => <article key={attribute.value} style={{ '--attribute-color': attribute.color } as React.CSSProperties}>{attribute.icon ? <i className={`fa-solid ${attribute.icon}`} aria-hidden="true" /> : <span className="rulebook-attribute-glyph" aria-hidden="true">{attribute.glyph}</span>}<h3>{attribute.value}</h3></article>)}</div>
  </>;
  return <div className={section.examples?.length === 1 ? 'rulebook-illustrated-section' : undefined}>
    {section.examples && <div className="rulebook-section-examples">{section.examples.map(example => <figure key={example.id}><ExampleCard id={example.id} /><figcaption>{example.label}</figcaption></figure>)}</div>}
    <div>
      {section.rules && <ol className="rulebook-rule-list">{section.rules.map(rule => <li key={rule}><p>{rule}</p></li>)}</ol>}
      {section.table && <div className="rulebook-table-wrap" tabIndex={0} role="region" aria-label={`${section.title} reference table`}><table><caption className="sr-only">{section.title} reference</caption><thead><tr>{section.table.headings.map(value => <th key={value} scope="col">{value}</th>)}</tr></thead><tbody>{section.table.rows.map(row => <tr key={row[0]}>{row.map((value, index) => index === 0 ? <th key={index} scope="row">{value}</th> : <td key={index}>{value}</td>)}</tr>)}</tbody></table></div>}
      {section.note && <div className="rulebook-important"><i className="fa-solid fa-star" aria-hidden="true" /><p>{section.note}</p></div>}
    </div>
  </div>;
}

const RulesView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sectionHeadings = useRef<Record<string, HTMLHeadingElement | null>>({});
  const contents = useRef<HTMLDetailsElement>(null);
  const chapter = selected === null ? null : chapters[selected];
  const group = chapterGroups.find(group => group.chapters.some(item => item.id === chapter?.id));
  const open = (index: number | null, section: string | null = null) => {
    setSelected(index);
    setSectionId(section);
    if (contents.current && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) contents.current.open = false;
    requestAnimationFrame(() => {
      if (section) {
        const target = sectionHeadings.current[section];
        const disclosure = target?.closest('details');
        if (disclosure) disclosure.open = true;
        target?.scrollIntoView({ block: 'start' });
      }
      else scroller.current?.scrollTo({ top: 0 });
      (section ? sectionHeadings.current[section] : heading.current)?.focus({ preventScroll: true });
    });
  };
  const chapterButton = (item: Chapter, compact = false) => <button key={item.id} data-sound="select-small" className={compact ? 'rulebook-contents-chapter' : 'rulebook-chapter'} aria-current={chapter?.id === item.id ? 'page' : undefined} onClick={() => open(chapters.indexOf(item))}>
    {!compact && <i className={`fa-solid ${item.icon}`} aria-hidden="true" />}
    <span><strong>{item.title}</strong>{!compact && <small>{item.subtitle}</small>}</span>
    {!compact && <i className="fa-solid fa-arrow-right" aria-hidden="true" />}
  </button>;
  return <div ref={scroller} className="rulebook entity-page">
    <header className="rulebook-topbar entity-topbar"><PageBrand section="THE RULEBOOK" /><BackToHubButton onClick={onBack} /></header>
    <div className="rulebook-shell">
      {chapter === null ? <>
        <section className="rulebook-cover">
          <div>
            <h1 ref={heading} tabIndex={-1}>THE <em>RULEBOOK</em></h1>
            <p>Covers all the major rules and mechanics of standard play.<br />These are subject to change as the game receives balance updates.</p>
            <div className="rulebook-cover-actions"><button data-sound="select-small" className="rulebook-primary" onClick={() => open(0)}>Start with the basics <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button><button className="rulebook-reference-link" onClick={() => open(chapters.length - 1)}>Quick reference <i className="fa-solid fa-book-open" aria-hidden="true" /></button></div>
          </div>
          <div className="rulebook-card-fan" aria-label="Example Pawn, Action and Condition cards">{examples.map((example, index) => <div key={example.id} className={`rulebook-fan-item rulebook-fan-${index}`}><ExampleCard id={example.id} decorative /><span style={{ color: example.color }}>{example.label}</span></div>)}</div>
        </section>
        <nav className="rulebook-chapters" aria-label="Rulebook chapters">
          {chapterGroups.map((group, index) => <section key={group.title} className={`rulebook-chapter-group chapter-tone-${index}`} aria-label={group.title}>
            <div className="rulebook-group-heading"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h2>{group.title}</h2><p>{group.description}</p></div></div>
            <div>{group.chapters.map(item => chapterButton(item))}</div>
          </section>)}
          <section className="rulebook-quick-reference" aria-label="Reference">{chapterButton(quickReference)}</section>
        </nav>
      </> : <>
        <div className="rulebook-breadcrumb"><button data-sound="select-small" onClick={() => open(null)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> All chapters</button><span>{group?.title ?? 'Reference'}</span></div>
        <div className="rulebook-reading-grid">
          <aside className="rulebook-contents">
            <details ref={contents} open={typeof window !== 'undefined' && window.matchMedia?.('(min-width: 901px)').matches}><summary>Contents <i className="fa-solid fa-chevron-down" aria-hidden="true" /></summary>
              <nav aria-label="Rulebook contents">{chapterGroups.map((group, index) => <section key={group.title} className={`chapter-tone-${index}`}><h2>{group.title}</h2>{group.chapters.map(item => <React.Fragment key={item.id}>{chapterButton(item, true)}{chapter.id === item.id && <div className="rulebook-contents-sections">{item.sections.map(section => <button key={section.id} aria-current={sectionId === section.id ? 'location' : undefined} onClick={() => open(selected, section.id)}>{section.title}</button>)}</div>}</React.Fragment>)}</section>)}{chapterButton(quickReference, true)}{chapter.id === quickReference.id && <div className="rulebook-contents-sections">{chapter.sections.map(section => <button key={section.id} aria-current={sectionId === section.id ? 'location' : undefined} onClick={() => open(selected, section.id)}>{section.title}</button>)}</div>}</nav>
            </details>
          </aside>
          <main className="rulebook-reading" key={chapter.id}>
            <div className="rulebook-topic-heading"><h1 ref={heading} tabIndex={-1}>{chapter.title}</h1><p>{chapter.subtitle}</p></div>
            <nav className="rulebook-section-links" aria-label="In this chapter">{chapter.sections.map(section => <button key={section.id} aria-current={sectionId === section.id ? 'location' : undefined} onClick={() => open(selected, section.id)}>{section.title}</button>)}</nav>
            {chapter.sections.map(section => {
              const title = <h2 id={`rule-heading-${section.id}`} tabIndex={-1} ref={(element: HTMLHeadingElement | null) => { sectionHeadings.current[section.id] = element; }}>{section.title}{section.collapsible && <i className="fa-solid fa-chevron-down" aria-hidden="true" />}</h2>;
              return section.collapsible
                ? <details key={section.id} className="rulebook-section rulebook-disclosure" aria-labelledby={`rule-heading-${section.id}`}><summary>{title}</summary><SectionContent section={section} /></details>
                : <section key={section.id} className="rulebook-section" aria-labelledby={`rule-heading-${section.id}`}>{title}<SectionContent section={section} /></section>;
            })}
            <footer className="rulebook-pagination">
              {selected! > 0 ? <button data-sound="select-small" onClick={() => open(selected! - 1)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Previous: {chapters[selected! - 1].title}</button> : <button onClick={() => open(null)}>All chapters</button>}
              {selected! < chapters.length - 1 ? <button data-sound="select-small" onClick={() => open(selected! + 1)}>Next: {chapters[selected! + 1].title} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button> : <button onClick={() => open(null)}>All chapters <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>}
            </footer>
          </main>
        </div>
      </>}
    </div>
  </div>;
};

export default RulesView;
