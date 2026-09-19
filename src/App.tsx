import React, { useState } from 'react';
import Hub from './components/Hub';
import GameView from './components/GameView';
import CardDatabase from './components/CardDatabase';
import RulesView from './components/RulesView';
import DeckCreator from './components/DeckCreator';
import PlaytestSetup from './components/PlaytestSetup';
import { SavedDeck } from './decks';

// Define the possible screens/views in the application
type View = 'HUB' | 'PLAYTEST_SETUP' | 'GAME' | 'CARDS' | 'RULES' | 'DECKS';

/**
 * Main App Component
 * Handles high-level navigation between the Hub, the Game session, and the Card Gallery.
 */
const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('HUB');
  const [playtestDecks, setPlaytestDecks] = useState<[SavedDeck | null, SavedDeck | null]>([null, null]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Main Menu / Hub View */}
      {currentView === 'HUB' && (
        <Hub
          onStartGame={() => setCurrentView('PLAYTEST_SETUP')}
          onViewCards={() => setCurrentView('CARDS')}
          onRules={() => setCurrentView('RULES')}
          onCreateDeck={() => setCurrentView('DECKS')}
        />
      )}

      {currentView === 'PLAYTEST_SETUP' && (
        <PlaytestSetup
          onBack={() => setCurrentView('HUB')}
          onStart={decks => { setPlaytestDecks(decks); setCurrentView('GAME'); }}
        />
      )}

      {/* Active Battle / Game View */}
      {currentView === 'GAME' && (
        <GameView onQuit={() => setCurrentView('HUB')} initialDecks={playtestDecks} />
      )}

      {/* Card Database / Gallery View */}
      {currentView === 'CARDS' && (
        <CardDatabase onBack={() => setCurrentView('HUB')} />
      )}

      {/* Rules View */}
      {currentView === 'DECKS' && <DeckCreator onBack={() => setCurrentView('HUB')} />}
      {currentView === 'RULES' && (
        <RulesView onBack={() => setCurrentView('HUB')} />
      )}
    </div>
  );
};

export default App;
