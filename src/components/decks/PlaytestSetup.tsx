import React, { useEffect, useState } from 'react';
import { deckSize, isDeckPlayable, SavedDeck } from '../../decks';
import { getSavedDecks, getSettings } from '../../desktop/storage';
import { OpponentMode, PlaytestDebugSettings } from '../../types';
import ProfileAvatar from '../common/ProfileAvatar';
import './PlaytestSetup.css';

interface PlaytestSetupProps {
  onBack: () => void;
  onStart: (decks: [SavedDeck | null, SavedDeck | null], mode?: OpponentMode, debug?: PlaytestDebugSettings) => void;
}

const RANDOM_DECK = '';
const debugOptions = [
  ['alwaysGoFirst', 'Always go first', 'Take the first turn.'],
  ['chooseStartingHand', 'Choose starting hand', 'Pick your opening five cards.'],
  ['xray', 'Xray', 'Reveal the AI’s hidden information.'],
] as const;

// CC0 icon: https://www.svgrepo.com/svg/324471/robot-artificial-intelligence-android
function TrainingRobotIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9 15a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1Z" />
    <path d="M15 15a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1Z" />
    <path d="M6 8a1 1 0 0 1-.71-.29l-3-3a1 1 0 0 1 1.42-1.42l3 3A1 1 0 0 1 6 8Z" />
    <path d="M18 8a1 1 0 0 1-.71-.29 1 1 0 0 1 0-1.42l3-3a1 1 0 1 1 1.42 1.42l-3 3A1 1 0 0 1 18 8Z" />
    <path d="M21 20H3a1 1 0 0 1-1-1v-4.5a10 10 0 0 1 20 0V19a1 1 0 0 1-1 1ZM4 18h16v-3.5a8 8 0 0 0-16 0Z" />
  </svg>;
}

export default function PlaytestSetup({ onBack, onStart }: PlaytestSetupProps) {
  const [library, setLibrary] = useState<SavedDeck[]>([]);
  const [selectedIds, setSelectedIds] = useState<[string, string]>([RANDOM_DECK, RANDOM_DECK]);
  const [loadError, setLoadError] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState<PlaytestDebugSettings>({});

  useEffect(() => {
    // Saving appends the edited deck to the library; show the newest save first.
    try { setLibrary([...getSavedDecks()].reverse()); }
    catch { setLoadError(true); }
  }, []);

  const choose = (playerIndex: number, id: string) => {
    setSelectedIds(current => current.map((value, index) => index === playerIndex ? id : value) as [string, string]);
  };
  const selectedDeckName = (playerIndex: number) => {
    const id = selectedIds[playerIndex];
    return id ? library.find(deck => deck.id === id)?.name ?? 'Random test deck' : 'Random test deck';
  };
  const start = () => {
    const decks = selectedIds.map(id => id ? library.find(deck => deck.id === id) ?? null : null) as [SavedDeck | null, SavedDeck | null];
    onStart(decks, 'ai', debug);
  };

  return <main className="training-screen">
    <div className="training-shell">
      <header className="training-header">
        <div>
          <span className="training-eyebrow">PROJECT ENTITY / TRAINING</span>
          <h1>SINGLEPLAYER <em>TRAINING</em></h1>
        </div>
        <button type="button" data-sound="cancellation" className="training-back" onClick={onBack}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> BACK TO HOME</button>
      </header>

      <div className="training-status"><span className="training-status__light" />
        <span>DECK SELECTION</span></div>
      {loadError && <div role="alert" className="training-error">Your saved deck library could not be read. Random test decks are still available.</div>}

      <div className="training-decks">
        {[0, 1].map(playerIndex => <section key={playerIndex} className="training-deck" aria-labelledby={`player-${playerIndex + 1}-deck-heading`}>
          <div className="training-deck__header">
            <span className={`training-deck__side-icon${playerIndex === 0 ? ' training-deck__side-icon--player' : ''}`}>{playerIndex === 0 ? <ProfileAvatar image={getSettings().profileImage} /> : <TrainingRobotIcon />}</span>
            <div><small>{playerIndex === 0 ? getSettings().username : 'AI'}</small><h2 id={`player-${playerIndex + 1}-deck-heading`}>{selectedDeckName(playerIndex)}</h2></div>
          </div>
          <div className="training-deck__list">
            <button type="button" data-sound="select" aria-pressed={selectedIds[playerIndex] === RANDOM_DECK} className={`training-choice${selectedIds[playerIndex] === RANDOM_DECK ? ' is-selected' : ''}`} onClick={() => choose(playerIndex, RANDOM_DECK)}>
              <span className="training-choice__icon"><i className="fa-solid fa-shuffle" aria-hidden="true" /></span>
              <span className="training-choice__copy"><strong>RANDOM TEST DECK</strong><small>A shuffled 40-card deck from the card pool</small></span>
              <i className={`fa-solid ${selectedIds[playerIndex] === RANDOM_DECK ? 'fa-circle-check' : 'fa-arrow-up-right'}`} aria-hidden="true" />
            </button>
            {library.map(deck => {
              const playable = isDeckPlayable(deck);
              const selected = selectedIds[playerIndex] === deck.id;
              return <button type="button" data-sound="select" key={deck.id} disabled={!playable} aria-pressed={selected} aria-label={`${deck.name}, ${deckSize(deck)} cards${playable ? '' : ', not playable'}`} className={`training-choice${selected ? ' is-selected' : ''}`} onClick={() => choose(playerIndex, deck.id)}>
                <span className="training-choice__icon"><i className="fa-solid fa-layer-group" aria-hidden="true" /></span>
                <span className="training-choice__copy"><strong>{deck.name}</strong><small>{deckSize(deck)} cards{!playable && ' · Invalid'}</small></span>
                <i className={`fa-solid ${!playable ? 'fa-ban' : selected ? 'fa-circle-check' : 'fa-arrow-up-right'}`} aria-hidden="true" />
              </button>;
            })}
            {!library.length && <p className="training-empty">No decks saved.</p>}
          </div>
        </section>)}
      </div>

      <section className="training-debug">
        <button type="button" data-sound="toggle" aria-label="Debug settings" aria-expanded={debugOpen} aria-controls="playtest-debug-settings" className="training-debug__toggle" onClick={() => setDebugOpen(open => !open)}>
          <i className="fa-solid fa-sliders" aria-hidden="true" /><span><strong>PRACTICE MODIFIERS</strong><small>Optional debug controls for AI matches</small></span><i className={`fa-solid ${debugOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true" />
        </button>
        {debugOpen && <div id="playtest-debug-settings" className="training-debug__options">
          {debugOptions.map(([key, label, description]) => <label key={key} className="training-debug__option">
            <input type="checkbox" data-sound="toggle" checked={!!debug[key]} onChange={event => setDebug(current => ({ ...current, [key]: event.target.checked }))} />
            <span><strong>{label}</strong><small>{description}</small></span>
          </label>)}
        </div>}
      </section>

      <footer className="training-footer"><span></span><button type="button" data-sound="select" aria-label="Begin playtest" onClick={start}>BEGIN TRAINING <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button></footer>
    </div>
  </main>;
}
