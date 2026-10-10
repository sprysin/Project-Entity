import React, { useEffect, useState } from 'react';
import { setCloseReason } from './desktop/lifecycle';
import Home, { HomePreview, WorkInProgress } from './components/hub/Home';
import GameView from './components/game/GameView';
import CardDatabase from './components/catalog/CardDatabase';
import RulesView from './components/rules/RulesView';
import DeckCreator from './components/decks/DeckCreator';
import PlaytestSetup from './components/decks/PlaytestSetup';
import Settings from './components/settings/Settings';
import Account from './components/account/Account';
import Shop from './components/shop/Shop';
import { OpponentMode, PlaytestDebugSettings } from './types';
import { SavedDeck } from './decks';
import { useUiSounds } from './hooks/useUiSounds';

type View = 'HOME' | 'PLAYTEST_SETUP' | 'GAME' | 'CARDS' | 'RULES' | 'DECKS' | 'SETTINGS' | 'ACCOUNT' | 'PREVIEW' | 'SHOP';

const GAME_WIDTH = 2048;
const GAME_HEIGHT = 1152;

function viewportScale() {
  return Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
}

const App: React.FC = () => {
  useUiSounds();
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('ai');
  const [playtestDebug, setPlaytestDebug] = useState<PlaytestDebugSettings>({});
  const [currentView, setCurrentView] = useState<View>('HOME');
  const [preview, setPreview] = useState<HomePreview>('multiplayer');
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
      {currentView === 'HOME' && <Home
        onTraining={() => setCurrentView('PLAYTEST_SETUP')}
        onDeckEditor={() => setCurrentView('DECKS')}
        onCardDatabase={() => setCurrentView('CARDS')}
        onRules={() => setCurrentView('RULES')}
        onSettings={() => setCurrentView('SETTINGS')}
        onAccount={() => setCurrentView('ACCOUNT')}
        onShop={() => setCurrentView('SHOP')}
        onPreview={feature => { setPreview(feature); setCurrentView('PREVIEW'); }}
      />}
      {currentView === 'PREVIEW' && <WorkInProgress feature={preview} onBack={() => setCurrentView('HOME')} />}
      {currentView === 'SHOP' && <Shop onBack={() => setCurrentView('HOME')} />}

      {currentView === 'PLAYTEST_SETUP' && (
        <PlaytestSetup
          onBack={() => setCurrentView('HOME')}
          onStart={(decks, mode = 'ai', debug = {}) => { setOpponentMode(mode); setPlaytestDebug(debug); setPlaytestDecks(decks); setCurrentView('GAME'); }}
        />
      )}

      {currentView === 'GAME' && (
        <GameView onQuit={() => setCurrentView('HOME')} initialDecks={playtestDecks} opponentMode={opponentMode} debugSettings={playtestDebug} />
      )}

      {currentView === 'CARDS' && (
        <CardDatabase onBack={() => setCurrentView('HOME')} />
      )}

      {currentView === 'DECKS' && <DeckCreator onBack={() => setCurrentView('HOME')} />}
      {currentView === 'SETTINGS' && <Settings onBack={() => setCurrentView('HOME')} />}
      {currentView === 'ACCOUNT' && <Account onBack={() => setCurrentView('HOME')} />}
      {currentView === 'RULES' && (
        <RulesView onBack={() => setCurrentView('HOME')} />
      )}
      </div>
    </div>
  );
};

export default App;
