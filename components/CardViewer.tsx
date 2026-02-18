
import React from 'react';
import { BASE_CARDS } from '../constants';
import { CardDetail } from './CardDetail';

interface CardViewerProps {
  onBack: () => void;
}

/**
 * CardViewer Component
 * Displays a catalog of all available cards in the game database.
 * Uses the standard CardDetail component for consistent visual representation.
 */
const CardViewer: React.FC<CardViewerProps> = ({ onBack }) => {
  return (
    <div className="flex-1 p-8 overflow-y-auto retro-hash">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="flex justify-between items-center border-b-4 border-yellow-500/50 pb-6">
          <div className="space-y-1">
            <h2 className="text-6xl font-orbitron font-bold text-yellow-500 tracking-tighter drop-shadow-[0_0_20px_rgba(234,179,8,0.3)] uppercase">Database</h2>
            <p className="text-slate-400 font-orbitron text-xs tracking-[0.4em] uppercase">Central Entity Index</p>
          </div>
          <button
            onClick={onBack}
            className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded-sm font-orbitron font-bold transition-all transform active:scale-95 border border-yellow-500/30 uppercase tracking-widest"
          >
            Back to Hub
          </button>
        </div>

        {/* Card Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
          {BASE_CARDS.map(card => (
            <CardDetail key={card.id} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CardViewer;
