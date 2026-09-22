import React, { useEffect, useState } from 'react';
import { setCloseReason } from './desktop/lifecycle';
import Hub from './components/hub/Hub';
import GameView from './components/game/GameView';
import CardDatabase from './components/catalog/CardDatabase';
import RulesView from './components/rules/RulesView';
import DeckCreator from './components/decks/DeckCreator';
import PlaytestSetup from './components/decks/PlaytestSetup';
import Settings from './components/settings/Settings';
import { OpponentMode } from './types';
import { SavedDeck } from './decks';
import { useUiSounds } from './hooks/useUiSounds';

// Define the possible screens/views in the application
type View = 'HUB' | 'PLAYTEST_SETUP' | 'GAME' | 'CARDS' | 'RULES' | 'DECKS' | 'SETTINGS';

/**
 * Main App Component
 * Handles high-level navigation between the Hub, the Game session, and the Card Gallery.
 */
const App: React.FC = () => {
  useUiSounds();
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('self');
  const [currentView, setCurrentView] = useState<View>('HUB');
  const [playtestDecks, setPlaytestDecks] = useState<[SavedDeck | null, SavedDeck | null]>([null, null]);
  useEffect(() => {
    setCloseReason('match', currentView === 'GAME' ? 'The current match will be lost.' : null);
    return () => setCloseReason('match', null);
  }, [currentView]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Main Menu / Hub View */}
      {currentView === 'HUB' && (
        <Hub
          onStartGame={() => setCurrentView('PLAYTEST_SETUP')}
          onViewCards={() => setCurrentView('CARDS')}
          onRules={() => setCurrentView('RULES')}
          onCreateDeck={() => setCurrentView('DECKS')}
          onSettings={() => setCurrentView('SETTINGS')}
        />
      )}

      {currentView === 'PLAYTEST_SETUP' && (
        <PlaytestSetup
          onBack={() => setCurrentView('HUB')}
          onStart={(decks, mode = 'self') => { setOpponentMode(mode); setPlaytestDecks(decks); setCurrentView('GAME'); }}
        />
      )}

      {/* Active Battle / Game View */}
      {currentView === 'GAME' && (
        <GameView onQuit={() => setCurrentView('HUB')} initialDecks={playtestDecks} opponentMode={opponentMode} />
      )}

      {/* Card Database / Gallery View */}
      {currentView === 'CARDS' && (
        <CardDatabase onBack={() => setCurrentView('HUB')} />
      )}

      {/* Rules View */}
      {currentView === 'DECKS' && <DeckCreator onBack={() => setCurrentView('HUB')} />}
      {currentView === 'SETTINGS' && <Settings onBack={() => setCurrentView('HUB')} />}
      {currentView === 'RULES' && (
        <RulesView onBack={() => setCurrentView('HUB')} />
      )}
    </div>
  );
};

export default App;
