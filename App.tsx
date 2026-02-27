import React, { useState } from 'react';
import Hub from './components/Hub';
import GameView from './components/GameView';
import CardDatabase from './components/CardDatabase';
import RulesView from './components/RulesView';

// Define the possible screens/views in the application
type View = 'HUB' | 'GAME' | 'CARDS' | 'RULES';

/**
 * Main App Component
 * Handles high-level navigation between the Hub, the Game session, and the Card Gallery.
 */
const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('HUB');

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Main Menu / Hub View */}
      {currentView === 'HUB' && (
        <Hub
          onStartGame={() => setCurrentView('GAME')}
          onViewCards={() => setCurrentView('CARDS')}
          onRules={() => setCurrentView('RULES')}
        />
      )}

      {/* Active Battle / Game View */}
      {currentView === 'GAME' && (
        <GameView onQuit={() => setCurrentView('HUB')} />
      )}

      {/* Card Database / Gallery View */}
      {currentView === 'CARDS' && (
        <CardDatabase onBack={() => setCurrentView('HUB')} />
      )}

      {/* Rules View */}
      {currentView === 'RULES' && (
        <RulesView onBack={() => setCurrentView('HUB')} />
      )}
    </div>
  );
};

export default App;