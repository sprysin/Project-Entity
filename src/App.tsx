import React, { useEffect, useState } from 'react';
import { setCloseReason } from './desktop/lifecycle';
import Hub from './components/hub/Hub';
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

type View = 'HOME' | 'DEBUG_HUB' | 'PLAYTEST_SETUP' | 'GAME' | 'CARDS' | 'RULES' | 'DECKS' | 'SETTINGS' | 'ACCOUNT' | 'PREVIEW' | 'SHOP';

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
  const [returnView, setReturnView] = useState<'HOME' | 'DEBUG_HUB'>('HOME');
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
        onTraining={() => { setReturnView('HOME'); setCurrentView('PLAYTEST_SETUP'); }}
        onDeckEditor={() => { setReturnView('HOME'); setCurrentView('DECKS'); }}
        onCardDatabase={() => { setReturnView('HOME'); setCurrentView('CARDS'); }}
        onRules={() => { setReturnView('HOME'); setCurrentView('RULES'); }}
        onSettings={() => { setReturnView('HOME'); setCurrentView('SETTINGS'); }}
        onAccount={() => setCurrentView('ACCOUNT')}
        onShop={() => setCurrentView('SHOP')}
        onPreview={feature => { setPreview(feature); setCurrentView('PREVIEW'); }}
      />}
      {currentView === 'PREVIEW' && <WorkInProgress feature={preview} onBack={() => setCurrentView('HOME')} />}
      {currentView === 'SHOP' && <Shop onBack={() => setCurrentView('HOME')} />}
      {currentView === 'DEBUG_HUB' && (
        <Hub
          onStartGame={() => { setReturnView('DEBUG_HUB'); setCurrentView('PLAYTEST_SETUP'); }}
          onViewCards={() => { setReturnView('DEBUG_HUB'); setCurrentView('CARDS'); }}
          onRules={() => { setReturnView('DEBUG_HUB'); setCurrentView('RULES'); }}
          onCreateDeck={() => { setReturnView('DEBUG_HUB'); setCurrentView('DECKS'); }}
          onSettings={() => { setReturnView('DEBUG_HUB'); setCurrentView('SETTINGS'); }}
          onExit={() => { setReturnView('HOME'); setCurrentView('HOME'); }}
        />
      )}

      {currentView === 'PLAYTEST_SETUP' && (
        <PlaytestSetup
          onBack={() => setCurrentView(returnView)}
          onStart={(decks, mode = 'ai', debug = {}) => { setOpponentMode(mode); setPlaytestDebug(debug); setPlaytestDecks(decks); setCurrentView('GAME'); }}
        />
      )}

      {currentView === 'GAME' && (
        <GameView onQuit={() => setCurrentView(returnView)} initialDecks={playtestDecks} opponentMode={opponentMode} debugSettings={playtestDebug} />
      )}

      {currentView === 'CARDS' && (
        <CardDatabase onBack={() => setCurrentView(returnView)} />
      )}

      {currentView === 'DECKS' && <DeckCreator onBack={() => setCurrentView(returnView)} />}
      {currentView === 'SETTINGS' && <Settings onBack={() => setCurrentView(returnView)} onDebugHub={() => setCurrentView('DEBUG_HUB')} />}
      {currentView === 'ACCOUNT' && <Account onBack={() => setCurrentView('HOME')} />}
      {currentView === 'RULES' && (
        <RulesView onBack={() => setCurrentView(returnView)} />
      )}
      </div>
    </div>
  );
};

export default App;
