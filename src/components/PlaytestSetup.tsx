import React, { useEffect, useState } from 'react';
import { deckSize, isDeckPlayable, loadDecks, SavedDeck } from '../decks';

interface PlaytestSetupProps {
  onBack: () => void;
  onStart: (decks: [SavedDeck | null, SavedDeck | null]) => void;
}

const RANDOM_DECK = '';

const PlaytestSetup: React.FC<PlaytestSetupProps> = ({ onBack, onStart }) => {
  const [library, setLibrary] = useState<SavedDeck[]>([]);
  const [selectedIds, setSelectedIds] = useState<[string, string]>([RANDOM_DECK, RANDOM_DECK]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    try {
      setLibrary(loadDecks(localStorage));
    } catch {
      setLoadError(true);
    }
  }, []);

  const choose = (playerIndex: number, id: string) => {
    setSelectedIds(current => current.map((value, index) => index === playerIndex ? id : value) as [string, string]);
  };

  const start = () => {
    const decks = selectedIds.map(id => id ? library.find(deck => deck.id === id) ?? null : null) as [SavedDeck | null, SavedDeck | null];
    onStart(decks);
  };

  return <main className="flex-1 overflow-y-auto bg-[#06080b] px-6 py-10 font-roboto retro-hash">
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex items-center justify-between border-b border-yellow-500/30 pb-7">
        <div>
          <span className="font-orbitron text-[10px] tracking-[.35em] text-slate-500">PLAYTEST CONFIGURATION</span>
          <h1 className="mt-3 font-orbitron text-4xl font-black text-yellow-500">CHOOSE YOUR DECKS</h1>
          <p className="mt-3 text-sm text-slate-400">Use a deck from your library or generate a random test deck.</p>
        </div>
        <button aria-label="Back to main menu" onClick={onBack} className="border border-slate-700 bg-slate-900 px-4 py-3 font-orbitron text-xs font-bold text-slate-300 hover:border-yellow-500 hover:text-yellow-400">
          <i className="fa-solid fa-arrow-left mr-2" aria-hidden="true" /> BACK
        </button>
      </header>

      {loadError && <div role="alert" className="mb-6 border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-200">Your saved deck library could not be read. Random test decks are still available.</div>}

      <div className="grid gap-8 lg:grid-cols-2">
        {[0, 1].map(playerIndex => <section key={playerIndex} aria-labelledby={`player-${playerIndex + 1}-deck-heading`}>
          <h2 id={`player-${playerIndex + 1}-deck-heading`} className="mb-4 font-orbitron text-lg font-bold text-slate-100">PLAYER {playerIndex + 1} DECK</h2>
          <div className="space-y-3">
            <button
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
        <button aria-label="Begin playtest" onClick={start} className="bg-yellow-600 px-8 py-4 font-orbitron text-sm font-black text-white shadow-[0_0_20px_rgba(202,138,4,0.3)] hover:bg-yellow-500">
          BEGIN PLAYTEST <i className="fa-solid fa-arrow-right ml-2" aria-hidden="true" />
        </button>
      </div>
    </div>
  </main>;
};

export default PlaytestSetup;
