import React from 'react';
import { createRoot } from 'react-dom/client';
import { CardReveal } from './src/components/game/CardReveal';
import { GameSidebar } from './src/components/game/GameSidebar';
import jet from './src/cards/pawns/j/JusticeJetBomber';
import { GameState } from './src/types';
import './src/styles/global.css';

const bomb = { ...jet.find(entry => entry.cardData.id === 'A_Jet_Explosive')!.cardData, instanceId: 'review-bomb', ownerId: 'player1' };
const gameState = { activePlayerIndex: 0, drawnBombs: [{ card: bomb, playerIndex: 0 }], log: ['Player drew and revealed "Jet Explosive"; the Bomb is destroyed.'] } as GameState;
createRoot(document.getElementById('root')!).render(<div className="review flex h-screen bg-slate-950 text-white">
    <style>{'.review .card-reveal {animation: card-reveal 3.1s cubic-bezier(.35,.05,.25,1) both paused; animation-delay: -1s;}'}</style>
    <div className="relative flex-1 overflow-hidden">
        <div className="absolute top-0 w-full flex justify-center"><div className="card-reveal-slot w-28 aspect-[2/3] -translate-y-[60%]"><CardReveal card={bomb} revealed={false} /></div></div>
        <div className="absolute bottom-0 w-full flex justify-center"><div className="card-reveal-slot card-reveal-slot--active w-28 aspect-[2/3] translate-y-[30%]"><CardReveal card={bomb} revealed={false} /></div></div>
    </div>
    <GameSidebar gameState={gameState} selectedCard={null} selectedFieldSlot={null} isOpen={false} setIsOpen={() => {}} />
</div>);
