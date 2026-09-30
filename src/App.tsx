import React, { useEffect, useState } from 'react';
import { setCloseReason } from './desktop/lifecycle';
import Hub from './components/hub/Hub';
import GameView from './components/game/GameView';
import CardDatabase from './components/catalog/CardDatabase';
import RulesView from './components/rules/RulesView';
import DeckCreator from './components/decks/DeckCreator';
import PlaytestSetup from './components/decks/PlaytestSetup';
import Settings from './components/settings/Settings';
import { OpponentMode, PlaytestDebugSettings } from './types';
import { SavedDeck } from './decks';
import { useUiSounds } from './hooks/useUiSounds';

type View = 'HUB' | 'PLAYTEST_SETUP' | 'GAME' | 'CARDS' | 'RULES' | 'DECKS' | 'SETTINGS';

const GAME_WIDTH = 2048;
const GAME_HEIGHT = 1152;

function viewportScale() {
  return Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
}

const App: React.FC = () => {
  useUiSounds();
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('self');
  const [playtestDebug, setPlaytestDebug] = useState<PlaytestDebugSettings>({});
  const [currentView, setCurrentView] = useState<View>('HUB');
  const [playtestDecks, setPlaytestDecks] = useState<[SavedDeck | null, SavedDeck | null]>([null, null]);
  const [scale, setScale] = useState(viewportScale);
  useEffect(() => {
    const resize = () => setScale(viewportScale());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    setCloseReason('match', currentView === 'GAME' ? 'The current match will be lost.' : null);
    return () => setCloseReason('match', null);
  }, [currentView]);

  return (
    <div className="game-viewport">
      <div className="game-surface overflow-hidden bg-slate-950 text-slate-100 flex flex-col" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
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
          onStart={(decks, mode = 'self', debug = {}) => { setOpponentMode(mode); setPlaytestDebug(debug); setPlaytestDecks(decks); setCurrentView('GAME'); }}
        />
      )}

      {currentView === 'GAME' && (
        <GameView onQuit={() => setCurrentView('HUB')} initialDecks={playtestDecks} opponentMode={opponentMode} debugSettings={playtestDebug} />
      )}

      {currentView === 'CARDS' && (
        <CardDatabase onBack={() => setCurrentView('HUB')} />
      )}

      {currentView === 'DECKS' && <DeckCreator onBack={() => setCurrentView('HUB')} />}
      {currentView === 'SETTINGS' && <Settings onBack={() => setCurrentView('HUB')} />}
      {currentView === 'RULES' && (
        <RulesView onBack={() => setCurrentView('HUB')} />
      )}
      </div>
    </div>
  );
};

export default App;
