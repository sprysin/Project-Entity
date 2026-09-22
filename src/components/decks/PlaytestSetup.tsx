import BackToHubButton from '../common/BackToHubButton';
import { OpponentMode } from '../../types';
import React, { useEffect, useState } from 'react';
import { deckSize, isDeckPlayable, SavedDeck } from '../../decks';
import { getSavedDecks, getSettings } from '../../desktop/storage';

interface PlaytestSetupProps {
  onBack: () => void;
  onStart: (decks: [SavedDeck | null, SavedDeck | null], mode?: OpponentMode) => void;
}

const RANDOM_DECK = '';

const PlaytestSetup: React.FC<PlaytestSetupProps> = ({ onBack, onStart }) => {
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('self');
  const [library, setLibrary] = useState<SavedDeck[]>([]);
  const [selectedIds, setSelectedIds] = useState<[string, string]>([RANDOM_DECK, RANDOM_DECK]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    try {
      setLibrary(getSavedDecks());
    } catch {
      setLoadError(true);
    }
  }, []);

  const choose = (playerIndex: number, id: string) => {
    setSelectedIds(current => current.map((value, index) => index === playerIndex ? id : value) as [string, string]);
  };

  const start = () => {
    const decks = selectedIds.map(id => id ? library.find(deck => deck.id === id) ?? null : null) as [SavedDeck | null, SavedDeck | null];
    opponentMode === 'self' ? onStart(decks) : onStart(decks, opponentMode);
  };

  return <main className="flex-1 overflow-y-auto bg-[#06080b] px-6 py-10 font-roboto retro-hash">
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex items-center justify-between border-b border-yellow-500/30 pb-7">
        <div>
          <span className="font-orbitron text-[10px] tracking-[.35em] text-slate-500">PLAYTEST CONFIGURATION</span>
          <h1 className="mt-3 font-orbitron text-4xl font-black text-yellow-500">CHOOSE YOUR DECKS</h1>
          <p className="mt-3 text-sm text-slate-400">Use a deck from your library or generate a random test deck.</p>
        </div>
        <BackToHubButton onClick={onBack} />
      </header>

      <fieldset className="mb-8 border border-slate-700 bg-slate-900/80 p-5 backdrop-blur-sm shadow-md">
        <legend className="px-3 py-1 font-orbitron text-xs font-bold tracking-[0.2em] text-yellow-400 border border-yellow-500/30 bg-slate-950 uppercase shadow-[0_0_10px_rgba(234,179,8,0.15)] flex items-center gap-2">
          SELECT OPPONENT
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label
            data-sound="toggle"
            aria-pressed={opponentMode === 'self'}
            className={`group relative flex cursor-pointer items-center justify-between border p-4 text-left transition-all duration-200 ${opponentMode === 'self'
              ? 'border-yellow-500 bg-yellow-950/30 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
              : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60'
              }`}
          >
            <input
              type="radio"
              name="opponent"
              checked={opponentMode === 'self'}
              onChange={() => setOpponentMode('self')}
              className="sr-only"
            />
            <div className="flex items-center gap-3.5 min-w-0">
              {/* ICON: Self-Play Button Icon (currently FontAwesome 'fa-users') */}
              <i className={`fa-solid fa-users w-7 text-center text-xl transition-colors ${opponentMode === 'self' ? 'text-yellow-500' : 'text-slate-500 group-hover:text-slate-400'}`} aria-hidden="true" />
              <span className="font-orbitron text-sm font-semibold tracking-wide">Self-play · control both players</span>
            </div>
            {/* ICON: Self-Play Radio Checkmark Indicator (Checked: 'fa-circle-check', Unchecked: 'fa-circle') */}
            {opponentMode === 'self' ? (
              <i className="fa-solid fa-circle-check text-yellow-500 text-lg shadow-[0_0_10px_rgba(234,179,8,0.5)]" aria-hidden="true" />
            ) : (
              <i className="fa-regular fa-circle text-slate-600 text-lg group-hover:text-slate-500" aria-hidden="true" />
            )}
          </label>

          <label
            data-sound="toggle"
            aria-pressed={opponentMode === 'ai'}
            className={`group relative flex cursor-pointer items-center justify-between border p-4 text-left transition-all duration-200 ${opponentMode === 'ai'
              ? 'border-yellow-500 bg-yellow-950/30 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
              : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60'
              }`}
          >
            <input
              type="radio"
              name="opponent"
              checked={opponentMode === 'ai'}
              onChange={() => setOpponentMode('ai')}
              className="sr-only"
            />
            <div className="flex items-center gap-3.5 min-w-0">
              {/* ICON: Play against AI Button Icon (currently FontAwesome 'fa-robot') */}
              <i className={`fa-solid fa-robot w-7 text-center text-xl transition-colors ${opponentMode === 'ai' ? 'text-yellow-500' : 'text-slate-500 group-hover:text-slate-400'}`} aria-hidden="true" />
              <span className="font-orbitron text-sm font-semibold tracking-wide">Play against AI</span>
            </div>
            {/* ICON: Play against AI Radio Checkmark Indicator (Checked: 'fa-circle-check', Unchecked: 'fa-circle') */}
            {opponentMode === 'ai' ? (
              <i className="fa-solid fa-circle-check text-yellow-500 text-lg shadow-[0_0_10px_rgba(234,179,8,0.5)]" aria-hidden="true" />
            ) : (
              <i className="fa-regular fa-circle text-slate-600 text-lg group-hover:text-slate-500" aria-hidden="true" />
            )}
          </label>
        </div>
        <p className="mt-4 text-sm text-slate-400">{opponentMode === 'ai' ? 'Select Deck for you and the AI below.' : 'Play both sides. Response windows and chains are enabled.'}</p>
      </fieldset>

      {loadError && <div role="alert" className="mb-6 border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-200">Your saved deck library could not be read. Random test decks are still available.</div>}

      <div className="grid gap-8 lg:grid-cols-2">
        {[0, 1].map(playerIndex => <section key={playerIndex} aria-labelledby={`player-${playerIndex + 1}-deck-heading`}>
          <h2 id={`player-${playerIndex + 1}-deck-heading`} className="mb-4 break-words font-orbitron text-lg font-bold text-slate-100">{playerIndex === 0 ? getSettings().username : opponentMode === 'ai' ? 'AI' : 'PLAYER 2'} DECK</h2>
          <div className="space-y-3">
            <button
              data-sound="select"
              aria-pressed={selectedIds[playerIndex] === RANDOM_DECK}
              onClick={() => choose(playerIndex, RANDOM_DECK)}
              className={`flex w-full items-center gap-4 border p-4 text-left transition-colors ${selectedIds[playerIndex] === RANDOM_DECK ? 'border-yellow-500 bg-yellow-950/30' : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'}`}
            >
              <i className="fa-solid fa-shuffle w-8 text-center text-xl text-yellow-500" aria-hidden="true" />
              <span className="flex-1"><strong className="block font-orbitron text-sm text-slate-100">Random test deck</strong><small className="mt-1 block text-slate-400">A shuffled 40-card deck generated from the card pool</small></span>
              {selectedIds[playerIndex] === RANDOM_DECK && <i className="fa-solid fa-circle-check text-yellow-500" aria-hidden="true" />}
            </button>

            {library.map(deck => {
              const playable = isDeckPlayable(deck);
              const selected = selectedIds[playerIndex] === deck.id;
              return <button
                data-sound="select"
                key={deck.id}
                disabled={!playable}
                aria-pressed={selected}
                aria-label={`${deck.name}, ${deckSize(deck)} cards${playable ? '' : ', not playable'}`}
                onClick={() => choose(playerIndex, deck.id)}
                className={`flex w-full items-center gap-4 border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-yellow-500 bg-yellow-950/30' : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'}`}
              >
                <i className="fa-solid fa-layer-group w-8 text-center text-xl text-yellow-500" aria-hidden="true" />
                <span className="min-w-0 flex-1"><strong className="block truncate font-orbitron text-sm text-slate-100">{deck.name}</strong><small className="mt-1 block text-slate-400">{deckSize(deck)} cards · {playable ? 'Ready to play' : 'Needs 40–60 cards'}</small></span>
                {selected && <i className="fa-solid fa-circle-check text-yellow-500" aria-hidden="true" />}
              </button>;
            })}

            {!library.length && <div className="border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No saved decks yet. Build one in the Deck Creator to use it here.</div>}
          </div>
        </section>)}
      </div>

      <div className="mt-10 flex justify-end border-t border-slate-800 pt-7">
        <button data-sound="select" aria-label="Begin playtest" onClick={start} className="bg-yellow-600 px-8 py-4 font-orbitron text-sm font-black text-white shadow-[0_0_20px_rgba(202,138,4,0.3)] hover:bg-yellow-500">
          BEGIN PLAYTEST <i className="fa-solid fa-arrow-right ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  </main>;
};

export default PlaytestSetup;
