import React, { useState, type CSSProperties } from 'react';
import { cardRegistry } from '../../cards/CardRegistry';
import type { CardDefinition } from '../../cards/CardRegistry';
import { getDraftDeckEdits, type createDraftDuel } from '../../game/draftDuel';
import { CardDetail } from '../cards/CardDetail';

export default function StandbyDeck({ run, onEdit, onInspect }: { run: ReturnType<typeof createDraftDuel>; onEdit: () => void; onInspect: (card: CardDefinition) => void }) {
  const [selectedId, setSelectedId] = useState(run.deck.cards[0]?.cardId);
  const [selectedCopy, setSelectedCopy] = useState(0);
  const [edits, setEdits] = useState(false);
  const selected = selectedId ? cardRegistry.getCard(selectedId) : undefined;
  const allChanges = getDraftDeckEdits(run);
  const changes = allChanges.filter(group => !group.removed);
  const original = new Map([...run.opponentDeck.cards, ...run.opponentDeck.reserve ?? []].map(entry => [entry.cardId, entry.quantity]));
  const sources = new Map<string, string[]>();
  for (const group of changes) for (const entry of group.entries) sources.set(entry.cardId, [...sources.get(entry.cardId) ?? [], ...Array.from({ length: entry.quantity }, () => group.color)]);
  const groups = [
    { label: run.deck.name, color: '#8a929e', entries: run.deck.cards, removed: false },
    { label: 'Reserve', color: '#8a929e', entries: run.deck.reserve ?? [], removed: false },
  ];
  return <div className="standby-deck-workspace">
    <aside className="deck-preview standby-card-viewer" aria-label="Card viewer">
      <div className="deck-preview-nav"><span>CARD VIEWER</span><i className="fa-solid fa-chess-pawn text-yellow-500" aria-hidden="true" /></div>
      {selected && <button type="button" data-sound="select-small" className="deck-preview-face" aria-label={`Inspect ${selected.name}`} aria-haspopup="dialog" onClick={() => onInspect(selected)}><CardDetail card={{ ...selected, instanceId: 'standby-viewer', ownerId: '' }} /></button>}
      <div className="deck-preview-controls"><button className="page-back-button" data-sound="select-small" aria-pressed={edits} onClick={() => setEdits(current => !current)}>View Edits</button></div>
      <ul className="standby-pack-stats" style={{ visibility: edits ? 'visible' : 'hidden' }} aria-hidden={!edits}>{allChanges.map(group => <li key={group.label} style={{ '--source-color': group.removed ? '#fff' : group.color } as CSSProperties}>{group.removed ? 'Removed from Original' : group.label} ({group.removed ? '−' : '+'}{group.entries.reduce((sum, entry) => sum + entry.quantity, 0)})</li>)}</ul>
    </aside>
    <section className="draft-standby-deck" aria-label="Current deck">
      <h2>{run.deck.name}</h2>
      <div className="draft-standby-deck__contents">
        {groups.filter(group => group.entries.length).map((group, index) => <section key={index}>
          {index > 0 && <h3>{group.label}</h3>}
          <div className="draft-standby-deck__grid">{group.entries.flatMap(entry => {
            const card = cardRegistry.getCard(entry.cardId);
            return card ? Array.from({ length: entry.quantity }, (_, copy) => {
              const color = edits ? sources.get(card.id)?.[copy - (original.get(card.id) ?? 0)] : undefined;
              return <button type="button" key={`${entry.cardId}-${copy}`} className={`${selectedId === card.id && selectedCopy === copy ? 'is-selected' : ''}${color ? ' is-added' : ''}`} style={color ? { '--source-color': color } as CSSProperties : undefined} data-sound="select-small" aria-label={`View ${card.name}, copy ${copy + 1}`} aria-pressed={selectedId === card.id && selectedCopy === copy} onClick={() => { setSelectedId(card.id); setSelectedCopy(copy); }}>
              <CardDetail card={{ ...card, instanceId: `standby-${entry.cardId}-${copy}`, ownerId: '' }} />
            </button>;
            }) : [];
          })}</div>
        </section>)}
      </div>
      <button className="page-back-button" data-sound="select-small" onClick={onEdit}>Edit deck</button>
    </section>
  </div>;
}
