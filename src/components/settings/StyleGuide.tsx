import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { cardRegistry } from '../../cards/CardRegistry';
import { rarityColor } from '../../cards/rarity';
import { createGame } from '../../game/engine';
import { Attribute, CARD_RARITIES, type Card, type GameState } from '../../types';
import { CardDetail, cardFrameClass } from '../cards/CardDetail';
import { CardPreview } from '../cards/CardPreview';
import { attributeColors } from '../cards/attributeColors';
import CatalogFilters, { useCatalogFilters } from '../catalog/CatalogFilters';
import CatalogPagination from '../catalog/CatalogPagination';
import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import ProfileAvatar from '../common/ProfileAvatar';
import { DeckViewModal, PileViewModal } from '../game/CollectionModals';
import { ContextMenu, ContextMenuButton } from '../game/ContextMenu';
import { DuelPrompt } from '../game/DuelPrompt';
import { HealthHud } from '../game/HealthHud';
import { LevelDiamonds } from '../game/LevelDiamonds';
import { QuitDuelDialog, WinnerModal } from '../game/MatchModals';
import { DuelReport } from '../game/DuelReport';
import AccountProgress from '../account/AccountProgress';
import { emptyDuelStats, getDuelReport } from '../../game/duelReport';
import { CardSelectionModal } from '../game/SelectionModals';
import { ActionCardIcon } from '../icons/ActionCardIcon';
import { LandCardIcon } from '../icons/LandCardIcon';
import { AttributeIcon } from '../icons/AttributeIcon';
import '../decks/DeckCreator.css';
import '../game/GameView.css';
import './StyleGuide.css';

const sections = ['Style guide breakdown', 'Typography', 'Colors', 'Buttons', 'Controls', 'Modals', 'Cards', 'Game UI', 'Duel Report'] as const;
const interfacePalette = [
  { label: 'Black', color: '#06080c', use: 'Use for backgrounds. Separate panels with charcoal rather than a new accent color.' },
  { label: 'Gold', color: '#eab308', use: 'Use for primary actions and emphasis. Keep secondary controls less prominent.' },
  { label: 'Silver', color: '#8a8a8a', use: 'Use for metallic framing. Build the finish with neutral gray-to-white highlights.' },
  { label: 'White', color: '#f8fafc', use: 'Use for readable text and strong contrast, including light checkerboard squares.' },
];
const cardAccentPalette = [
  { label: 'Main Deck Pawn', color: '#eebb4f' },
  { label: 'Action', color: '#20965b' },
  { label: 'Condition', color: '#d94571' },
];
const frames = ['card-pawn', 'card-vassal', 'card-merge', 'card-action', 'card-condition', 'card-token'];
const cards: Card[] = frames.flatMap(frame => {
  const definition = cardRegistry.getAllCards().find(card => cardFrameClass(card) === frame);
  return definition ? [{ ...definition, instanceId: `style-guide-${frame}`, ownerId: 'guide' }] : [];
});
const sampleGame = createGame([
  { id: 'guide', name: 'Sample player', deck: cards },
  { id: 'guide-opponent', name: 'Sample opponent', deck: cards },
]);
sampleGame.players[0].discard = cards;

const modalExamples = [
  { id: 'prompt', title: 'Effect prompt', detail: 'Shared duel prompt · primary and secondary actions', source: 'game/DuelPrompt.tsx' },
  { id: 'selection', title: 'Card selection', detail: 'Single selection · preview and confirm', source: 'game/SelectionModals.tsx' },
  { id: 'multi', title: 'Multiple cards', detail: 'Shared selection · choose two cards', source: 'game/SelectionModals.tsx' },
  { id: 'empty', title: 'Empty selection', detail: 'Shared selection · no available cards', source: 'game/SelectionModals.tsx' },
  { id: 'deck', title: 'Deck viewer', detail: 'Card grid and detailed inspection', source: 'game/CollectionModals.tsx' },
  { id: 'pile', title: 'Pile drawer', detail: 'Discard, Void, Reserve, and Land share this drawer', source: 'game/CollectionModals.tsx' },
  { id: 'quit', title: 'Quit confirmation', detail: 'Destructive action · cancel and confirm', source: 'game/MatchModals.tsx' },
  { id: 'victory', title: 'Victory', detail: 'Result screen · MVP reveal', source: 'game/MatchModals.tsx' },
  { id: 'defeat', title: 'Defeat', detail: 'Result screen · alternate tone', source: 'game/MatchModals.tsx' },
  { id: 'draw', title: 'Draw', detail: 'Result screen · tied life points', source: 'game/MatchModals.tsx' },
] as const;
const reportExamples = [
  { id: 'report', title: 'Victory', detail: 'MVP · level up' },
  { id: 'report-defeat', title: 'Defeat', detail: 'No victory bonus' },
  { id: 'report-combo', title: 'Combo', detail: 'Overkill · multi-level XP' },
] as const;
type Preview = typeof modalExamples[number]['id'] | typeof reportExamples[number]['id'] | null;

function sampleResult(preview: Preview): GameState {
  return {
    ...sampleGame, winner: preview?.includes('defeat') ? 'Sample opponent' : 'Sample player', resultReason: 'lp', turnNumber: 8, isDraw: preview === 'draw',
    duelStats: [preview === 'report-combo'
      ? { battleDestructions: 4, actionDestructions: 2, effectDestructions: 1, tributeSummons: 6, vassalSummons: 1, mergeSummons: 1 }
      : { ...emptyDuelStats(), battleDestructions: 4, tributeSummons: 1 }, emptyDuelStats()],
    damageEvents: cards[0] ? [
      { card: cards[0], playerIndex: 0, amount: preview === 'report-combo' ? 20000 : 810, kind: 'battle' },
      { card: cards[0], playerIndex: 0, amount: preview === 'report-combo' ? 20000 : 0, kind: 'effect' },
      { card: cards[1] ?? cards[0], playerIndex: 1, amount: 900, kind: 'battle' },
    ] : [],
  };
}

function GuideSection({ title, description, active, children }: { title: string; description?: string; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return <section className="style-guide__section" aria-label={title}>
    <header><h2>{title}</h2>{description && <p>{description}</p>}</header>
    {children}
  </section>;
}

export default function StyleGuide({ onBack }: { onBack: () => void }) {
  const [activeSection, setActiveSection] = useState<typeof sections[number]>('Style guide breakdown');
  const [preview, setPreview] = useState<Preview>(null);
  const [inspected, setInspected] = useState<Card | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [multi, setMulti] = useState<number[]>([]);
  const [peeking, setPeeking] = useState(false);
  const [text, setText] = useState('Sample player');
  const [volume, setVolume] = useState(65);
  const [enabled, setEnabled] = useState(true);
  const [page, setPage] = useState(0);
  const [feedback, setFeedback] = useState('Interact with an example to see its response here.');
  const filters = useCatalogFilters();
  const previewHost = useRef<HTMLDivElement>(null);
  const close = () => { setPreview(null); setPeeking(false); };
  const finish = (message: string) => { setFeedback(message); close(); };

  // The examples use real overlays; keep keyboard navigation inside the preview.
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement as HTMLElement | null;
    const host = previewHost.current;
    host?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    return () => previous?.focus();
  }, [preview]);

  const handlePreviewKeyDown = (event: ReactKeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (peeking) setPeeking(false);
      else setPreview(null);
    }
    if (event.key === 'Tab') {
      const buttons = [...(previewHost.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])]
        .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      if (buttons.length) {
        event.preventDefault();
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
    }
  };

  return <>
    <main className="style-guide entity-page flex-1 min-h-0 font-mono" inert={preview !== null}>
      <div className="entity-topbar"><PageBrand section="SETTINGS / UI STYLE GUIDE" /><BackToHubButton label="Back to settings" onClick={onBack} /></div>
      <div className="style-guide__body">
        <header className="settings-header">
          <div className="settings-heading"><h1>UI <em>STYLE GUIDE</em></h1></div>
        </header>
        <div className="style-guide__layout">
          <div className="style-guide__nav" role="tablist" aria-label="Style guide sections" aria-orientation="vertical">
            {sections.map((section, index) => <button key={section} type="button" role="tab" id={`guide-tab-${index}`}
              aria-selected={activeSection === section} aria-controls="guide-panel" tabIndex={activeSection === section ? 0 : -1}
              onClick={() => setActiveSection(section)}
              onKeyDown={event => {
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
                  : event.key === 'ArrowDown' ? (index + 1) % sections.length
                    : event.key === 'ArrowUp' ? (index + sections.length - 1) % sections.length : null;
                if (next === null) return;
                event.preventDefault();
                setActiveSection(sections[next]);
                document.getElementById(`guide-tab-${next}`)?.focus();
              }}>{section}</button>)}
          </div>
          <div key={activeSection} id="guide-panel" className="style-guide__content" role="tabpanel" aria-labelledby={`guide-tab-${sections.indexOf(activeSection)}`} tabIndex={0}>
            <GuideSection title="Style guide breakdown" active={activeSection === 'Style guide breakdown'}>
              <div className="style-guide__direction">
                <h3>Neon Punk</h3>
                <p>Project Entity is a tactical card game with a bold Neon Punk style. The main colors are black, gold, silver, and white.</p>
                <p>Give new UI a sense of strategy and confidence. Chess motifs and metallic details are ways to express that style, with room to vary the composition for each feature. Keep the player's choices easy to read.</p>
              </div>
              <h3>Main interface palette</h3>
              <div className="style-guide__swatches style-guide__palette">{interfacePalette.map(({ label, color, use }) => <figure key={label}>
                <span style={{ background: color }} /><figcaption>{label}<code>{color}</code><p>{use}</p></figcaption>
              </figure>)}</div>
              <h3>Card accents</h3>
              <div className="style-guide__swatches">{cardAccentPalette.map(({ label, color }) => <figure key={label}>
                <span style={{ background: color }} /><figcaption>{label}<code>{color}</code></figcaption>
              </figure>)}</div>
              <p className="style-guide__note">Bring these colors into UI that relates to the matching card type. An accent can help a player recognize a category without changing the whole screen's palette. Use purple for Void-related UI, paired with a label or icon to make its meaning clear.</p>
              <div className="style-guide__rules">
                <section>
                  <div>
                  <h3>Project Entity logo</h3>
                  <p>The Project Entity logo is the mark shown here, paired with the PROJECT ENTITY wordmark. Use the existing logo asset at src/styles/Logo/ProjEntityLogo.svg and the shared PageBrand component when adding branding to a screen.</p>
                  <p>Keep the logo's proportions intact. The gold square diamond frames the white mark in page headers; the home screen also uses the mark on its own.</p>
                  </div>
                  <div className="style-guide__reference">
                    <PageBrand section="Logo reference" />
                  </div>
                </section>
                <section>
                  <div>
                  <h3>Chess and checkers</h3>
                  <p>Use the chess influence to suggest planning, opposition, or ownership. Checkers can give a surface character; chess symbols can connect a control to its role in play. Choose whichever supports the feature, and allow the motif to take a different form in a new layout.</p>
                  <p>Keep patterns quiet enough for text to read. Avoid adding chess pieces to unrelated controls or filling every available space with checks.</p>
                  </div>
                  <div className="style-guide__reference style-guide__chess-example" role="img" aria-label="Opposing light and dark checkered Pawn tiles">
                    <div className="style-guide__pawn-tile style-guide__pawn-tile--light"><i className="fa-solid fa-chess-pawn" aria-hidden="true" /></div>
                    <div className="style-guide__pawn-tile style-guide__pawn-tile--dark"><i className="fa-solid fa-chess-pawn" aria-hidden="true" /></div>
                  </div>
                </section>
                <section>
                  <div>
                  <h3>Metallic framing</h3>
                  <p>Use gold and silver to give an element weight or importance. Metal can be a small detail, a divider, or the frame of a larger surface. Its shape and prominence should suit the content rather than follow one standard panel design.</p>
                  <p>Let simpler elements sit alongside the more elaborate ones. If every border demands attention, the framing stops helping. Keep silver neutral and avoid bulky bevels that crowd the content.</p>
                  </div>
                  <div className="style-guide__reference" role="img" aria-label="Angular silver frame with a gold diamond and deck count">
                    <div className="style-guide__metal-example"><div><i className="fa-solid fa-layer-group" aria-hidden="true" /><span><small>DECK</small><strong>40 <span>/ 40</span></strong></span></div></div>
                  </div>
                </section>
                <section>
                  <div>
                  <h3>Square diamonds and glow</h3>
                  <p>The square diamond is our main design shape: a square rotated 45 degrees, with equal sides and right angles. Repeat it in brand framing, action emblems, and tribute indicators so new screens feel part of Project Entity.</p>
                  <p>Keep standalone diamonds square rather than stretching them into narrow rhombuses. Clipped corners and angular panels carry the same shape into larger controls. Avoid soft, rounded shapes becoming the dominant visual language.</p>
                  <p>Use glow to draw attention to something the player can act on or needs to notice. Leave quieter areas around it, and keep the lettering sharp.</p>
                  </div>
                  <div className="style-guide__reference" role="img" aria-label="Gold angular Settings control with a white diamond inside an outlined diamond">
                    <div className="style-guide__glow-example"><span className="style-guide__action-emblem" aria-hidden="true" /><span>SETTINGS</span><i className="fa-solid fa-chevron-right" aria-hidden="true" /></div>
                  </div>
                </section>
              </div>
              <h3>When building a new screen</h3>
              <p className="style-guide__note">Reuse the closest component shown in this guide before adding a new one. Compare duel elements against the field and menu elements against the account screen. Check the result with keyboard navigation and long text, including disabled states.</p>
              <p className="style-guide__source">Visual references: common/PageChrome.css · hub/Home.css · settings/Settings.css · styles/global.css · styles/game.css. Component examples in this guide remain the implementation reference.</p>
            </GuideSection>

            <GuideSection title="Typography" active={activeSection === 'Typography'} description="Orbitron gives the interface its identity. Monospace keeps rules, labels, and card text readable.">
              <div className="style-guide__type-row"><code>Orbitron · display</code><div className="settings-heading"><h1>PROJECT <em>ENTITY</em></h1></div></div>
              <div className="style-guide__type-row"><code>Orbitron · heading</code><h3 className="font-orbitron text-2xl font-bold">Your next move starts here.</h3></div>
              <div className="style-guide__type-row"><code>Monospace · body</code><p>Draw a card, plan your turn, and build your strategy.<br />ABCDEFGHIJKLMNOPQRSTUVWXYZ · 0123456789</p></div>
              <div className="style-guide__type-row"><code>Card text · CSS variable</code><p className="font-card-text">Once per turn: You can activate this effect.<br />ATK 120 / DEF 100</p></div>
              <p className="style-guide__source">Fonts: styles/global.css · shared headings: settings/Settings.css</p>
            </GuideSection>

            <GuideSection title="Colors" active={activeSection === 'Colors'} description="Attribute and rarity swatches read directly from the shared palettes.">
              <h3>Attributes</h3><div className="style-guide__swatches">{Object.entries(attributeColors).map(([label, color]) => <figure key={label}><span style={{ background: color }} /><figcaption>{label}<code>{color}</code></figcaption></figure>)}</div>
              <h3>Rarities</h3><div className="style-guide__swatches">{CARD_RARITIES.map(rarity => <figure key={rarity}><span style={{ background: rarityColor(rarity) }} /><figcaption>{rarity}<code>{rarityColor(rarity)}</code></figcaption></figure>)}</div>
              <p className="style-guide__source">cards/attributeColors.ts · cards/rarity.ts</p>
            </GuideSection>

            <GuideSection title="Buttons" active={activeSection === 'Buttons'} description="Existing button families, with enabled and disabled states. Hover or tab through to inspect feedback.">
              <div className="style-guide__button-row"><code>Deck primary / secondary</code><button className="deck-primary" onClick={() => setFeedback('Primary action selected.')}>Primary action</button><button className="deck-secondary" onClick={() => setFeedback('Secondary action selected.')}>Secondary action</button><button className="deck-primary" disabled>Unavailable</button></div>
              <div className="style-guide__button-row"><code>Page navigation</code><BackToHubButton label="Navigation example" onClick={() => setFeedback('Navigation example selected.')} /><BackToHubButton label="Disabled navigation" onClick={() => { }} disabled /></div>
              <div className="style-guide__button-row settings-actions"><code>Settings action</code><button className="settings-save" onClick={() => setFeedback('Save example completed. No settings were changed.')}>Save settings</button><button className="settings-save" disabled>Saving…</button></div>
              <div className="style-guide__button-row"><code>Icon control</code><button className="deck-icon-button" aria-label="Add example" onClick={() => setFeedback('Add example selected.')}><i className="fa-solid fa-plus" aria-hidden="true" /></button><button className="deck-icon-button" aria-label="Disabled delete" disabled><i className="fa-solid fa-trash" aria-hidden="true" /></button></div>
              <p className="style-guide__feedback" role="status">{feedback}</p>
              <p className="style-guide__source">decks/DeckCreator.css · common/BackToHubButton.tsx · settings/Settings.css</p>
            </GuideSection>

            <GuideSection title="Controls" active={activeSection === 'Controls'} description="Try the shared settings controls, catalog filters, and pagination. Values reset when you leave.">
              <div className="settings-panel">
                <div className="settings-row"><div className="settings-copy"><label htmlFor="guide-name">Text input</label><p>Editable sample · 24 characters</p></div><input id="guide-name" className="settings-text-input" maxLength={24} value={text} onChange={event => setText(event.target.value)} /></div>
                <div className="settings-row"><div className="settings-copy"><label htmlFor="guide-volume">Range input</label><p>Sample volume</p></div><div className="settings-volume"><input id="guide-volume" type="range" min={0} max={100} value={volume} onChange={event => setVolume(Number(event.target.value))} /><output htmlFor="guide-volume">{volume}%</output></div></div>
                <div className="settings-row"><div className="settings-copy"><label htmlFor="guide-toggle">Toggle</label><p>{enabled ? 'Enabled' : 'Disabled'}</p></div><input id="guide-toggle" className="settings-toggle" type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /></div>
              </div>
              <div className="style-guide__button-row"><code>Filter dialog / page navigation</code><CatalogFilters {...filters} /><CatalogPagination page={page} pages={3} total={145} onPage={setPage} /></div>
              <h3>Scrollbars</h3>
              <p className="style-guide__note">Silver handles sit inside a dark track, with gold feedback on hover and drag. Scroll, drag the handles, or focus an example and use the arrow keys.</p>
              <div className="style-guide__scroll-examples">
                <div className="style-guide__scroll-vertical" role="region" aria-label="Vertical scrollbar example" tabIndex={0}>
                  {interfacePalette.map(({ label, use }) => <p key={label}><strong>{label}</strong>{use}</p>)}
                </div>
                <div className="style-guide__scroll-horizontal" role="region" aria-label="Horizontal scrollbar example" tabIndex={0}>
                  <div>{interfacePalette.map(({ label, color }) => <span key={label}><i style={{ background: color }} aria-hidden="true" />{label}</span>)}</div>
                </div>
              </div>
              <div className="style-guide__feedback"><p className="settings-error">Error example: Settings could not be saved. Please try again.</p><p className="text-yellow-300">Success example: Settings saved.</p></div>
              <p className="style-guide__source">settings/Settings.css · catalog/CatalogFilters.tsx · catalog/CatalogPagination.tsx</p>
            </GuideSection>

            <GuideSection title="Modals" active={activeSection === 'Modals'} description="Open a real component at full size. Confirmations only close the example; Escape returns to the guide.">
              <div className="style-guide__modal-grid">{modalExamples.map(example => <div key={example.id}>
                <div><h3>{example.title}</h3><p>{example.detail}</p><code>{example.source}</code></div>
                <button className="deck-secondary" aria-label={`Preview ${example.title.toLowerCase()}`} onClick={() => { setSelected(null); setMulti([]); setPeeking(false); setPreview(example.id); }}>Preview <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></button>
              </div>)}</div>
              <p className="style-guide__source">The filter dialog is under Controls. Card inspection is under Cards. Selection variants share the same prompt shell.</p>
            </GuideSection>

            <GuideSection title="Cards" active={activeSection === 'Cards'} description="Current card frames and typography, rendered with CardDetail. Select a card to open its inspection dialog.">
              <div className="style-guide__cards">{cards.map(card => <button key={card.id} aria-label={`Inspect ${card.name}`} onClick={() => setInspected(card)}><CardDetail card={card} className="w-full aspect-[2/3]" /><span>{cardFrameClass(card) === 'card-token' ? 'Token/Bomb' : cardFrameClass(card).replace('card-', '')}</span></button>)}</div>
              <p className="style-guide__source">cards/CardDetail.tsx · cards/CardPreview.tsx · styles/game.css. Use Card color test in Settings to experiment with frame colors.</p>
            </GuideSection>

            <GuideSection title="Game UI" active={activeSection === 'Game UI'} description="Player identity, life points, tribute progress, context actions, and the app’s icon vocabulary.">
              <div className="style-guide__hud"><HealthHud player={sampleGame.players[0]} flash={null} position="active" /><HealthHud player={sampleGame.players[1]} flash={null} position="opponent" /></div>
              <div className="style-guide__button-row"><code>Tribute progress · 3 / 5</code><LevelDiamonds required={5} selected={3} /></div>
              <div className="style-guide__context"><ContextMenu title="Card actions"><ContextMenuButton label="Activate" tone="gold" onClick={() => setFeedback('Context action selected.')} /><ContextMenuButton label="Set" onClick={() => setFeedback('Set example selected.')} /><ContextMenuButton label="Unavailable" disabled onClick={() => { }} /></ContextMenu></div>
              <div className="style-guide__icons">
                <span><ActionCardIcon />Action</span><span><LandCardIcon />Land</span><span><AttributeIcon attribute={Attribute.NORMAL} />Normal</span><span><AttributeIcon attribute={Attribute.DARK} />Dark</span><span><AttributeIcon attribute={Attribute.LIGHT} />Light</span><span><AttributeIcon attribute={Attribute.EARTH} />Earth</span><span><AttributeIcon attribute={Attribute.AIR} />Air</span><span><ProfileAvatar image={null} />Profile</span>
                {['gear', 'magnifying-glass', 'layer-group', 'plus', 'trash', 'xmark', 'arrow-left', 'power-off'].map(icon => <span key={icon}><i className={`fa-solid fa-${icon}`} aria-hidden="true" />{icon}</span>)}
              </div>
              <p className="style-guide__source">game/HealthHud.tsx · game/LevelDiamonds.tsx · game/ContextMenu.tsx · icons/ · Font Awesome Solid</p>
            </GuideSection>
            <GuideSection title="Duel Report" active={activeSection === 'Duel Report'}>
              <div className="style-guide__reports">
                <div className="style-guide__report-previews">{reportExamples.map(example => <button key={example.id}
                  className="deck-secondary" aria-label={`Preview ${example.title.toLowerCase()} report`} onClick={() => setPreview(example.id)}>
                  <strong>{example.title}</strong><span>{example.detail}</span><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                </button>)}</div>
                <div className="style-guide__progress-sample">
                  <h3>Account progress</h3>
                  <AccountProgress totalXp={475} />
                </div>
              </div>
            </GuideSection>
          </div>
        </div>
      </div>
    </main>
    {inspected && <CardPreview card={inspected} onClose={() => setInspected(null)} />}
    {preview && <div ref={previewHost} className="style-guide__preview duel-screen font-mono" onKeyDown={handlePreviewKeyDown}>
      {(reportExamples.some(example => example.id === preview) || ['victory', 'defeat', 'draw'].includes(preview)) && <WinnerModal gameState={sampleResult(preview)} isDefeat={preview.includes('defeat')} onQuit={() => finish('Result preview completed. Account XP was not changed.')}>
        <DuelReport report={getDuelReport(sampleResult(preview), 0)} beforeXp={280} />
      </WinnerModal>}
      {preview === 'quit' && <QuitDuelDialog onCancel={close} onConfirm={() => finish('Quit confirmation preview completed.')} />}
      {preview === 'prompt' && <DuelPrompt ariaLabel="Style guide effect prompt" title={<>Activate this card’s <strong>effect</strong>?</>} peeking={peeking} setPeeking={setPeeking} onBackdropClick={close} actions={[{ label: 'Cancel', onClick: close }, { label: 'Activate effect', variant: 'primary', onClick: () => finish('Effect prompt preview completed.') }]} />}
      {['selection', 'multi', 'empty'].includes(preview) && <CardSelectionModal title={preview === 'multi' ? 'Select two cards' : 'Select a card'} cards={preview === 'empty' ? [] : cards} selectedIndex={selected} onSelect={index => { if (preview === 'multi' && index !== null) setMulti(current => current.includes(index) ? current.filter(value => value !== index) : current.length < 2 ? [...current, index] : current); else setSelected(index); }} selectedIndices={preview === 'multi' ? multi : undefined} requiredCount={preview === 'multi' ? 2 : undefined} onConfirmMulti={preview === 'multi' ? () => finish('Multiple card selection preview completed.') : undefined} onCancel={close} onConfirm={() => finish('Card selection preview completed.')} emptyLabel="No cards available." confirmLabel="Confirm selection" />}
      {preview === 'deck' && <DeckViewModal isOpen onClose={close} deck={cards} playerName="Sample player" deckName="Style guide sample deck" />}
      {preview === 'pile' && <PileViewModal viewingDiscardIdx={0} viewingVoidIdx={null} gameState={sampleGame} setViewingDiscardIdx={close} setViewingVoidIdx={close} onSelectCard={card => { close(); setInspected(card); }} />}
    </div>}
  </>;
}
