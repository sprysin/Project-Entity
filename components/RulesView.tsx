import React from 'react';

interface RulesViewProps {
  onBack: () => void;
}

/**
 * RulesView Component
 * Displays the rules of the game. Currently a placeholder for future content.
 */
const RulesView: React.FC<RulesViewProps> = ({ onBack }) => {
  return (
    <div className="flex-1 p-8 overflow-y-auto retro-hash relative">
       <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-slate-900/80 pointer-events-none"></div>
       
       <div className="max-w-5xl mx-auto space-y-12 relative z-10">
        {/* Header Section */}
        <div className="flex justify-between items-center border-b-4 border-yellow-500/50 pb-6">
          <div className="space-y-1">
            <h2 className="text-6xl font-orbitron font-bold text-yellow-500 tracking-tighter drop-shadow-[0_0_20px_rgba(234,179,8,0.3)] uppercase">Rules</h2>
            <p className="text-slate-400 font-orbitron text-xs tracking-[0.4em] uppercase">How to play Project Entity</p>
          </div>
          <button 
            onClick={onBack}
            className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded-sm font-orbitron font-bold transition-all transform active:scale-95 border border-yellow-500/30 uppercase tracking-widest"
          >
            Back to Hub
          </button>
        </div>

        {/* Placeholder Content */}
        <div className="bg-black/50 border border-white/10 p-12 text-center rounded-lg backdrop-blur-sm">
            <div className="w-32 h-32 rounded-full border-4 border-yellow-500/20 flex items-center justify-center mx-auto mb-8 animate-pulse">
                <i className="fa-solid fa-book-journal-whills text-5xl text-yellow-600"></i>
            </div>
            <h3 className="text-3xl font-orbitron font-bold text-white mb-4 uppercase tracking-widest">Data Unavailable</h3>
            <p className="text-slate-400 font-mono text-lg max-w-lg mx-auto">
                The comprehensive rulebook module is currently under development. Please consult the field manual or experiment in Test Mode.
            </p>
        </div>
      </div>
    </div>
  );
};

export default RulesView;