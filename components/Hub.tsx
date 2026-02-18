import React from 'react';

interface HubProps {
  onStartGame: () => void;
  onViewCards: () => void;
  onRules: () => void;
}

/**
 * Hub Component
 * The landing page of the game. Features stylized buttons and the game title.
 */
const Hub: React.FC<HubProps> = ({ onStartGame, onViewCards, onRules }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 retro-hash relative">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none"></div>
      
      {/* Branding Header */}
      <div className="relative z-10 text-center space-y-4">
        <h1 className="text-8xl font-orbitron font-bold tracking-tighter text-yellow-500 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">
          PROJECT ENTITY
        </h1>
        <p className="text-xl text-slate-400 font-light tracking-[0.3em] uppercase">
          Tactical Card Framework
        </p>
      </div>

      {/* Navigation Buttons */}
      <div className="relative z-10 flex flex-col space-y-6 w-72 mt-8">
        <button 
          onClick={onStartGame}
          className="group relative py-4 px-8 bg-yellow-600 hover:bg-yellow-500 text-white rounded-sm font-orbitron font-bold transition-all transform active:scale-95 shadow-[0_0_20px_rgba(202,138,4,0.3)] border border-yellow-400/30 overflow-hidden"
        >
          {/* Shine effect on hover */}
          <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[-20deg]"></div>
          PLAY TEST GAME
        </button>
        <button 
          onClick={onViewCards}
          className="py-4 px-8 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-sm font-orbitron font-bold transition-all transform active:scale-95 border border-slate-700/50 backdrop-blur-md"
        >
          VIEW DATABASE
        </button>
        <button 
          onClick={onRules}
          className="py-4 px-8 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-sm font-orbitron font-bold transition-all transform active:scale-95 border border-slate-700/50 backdrop-blur-md"
        >
          GAME RULES
        </button>
      </div>

      {/* Footer / Version Info */}
      <div className="relative z-10 mt-24 text-slate-600 text-[10px] tracking-widest font-orbitron flex space-x-4 items-center">
        <div className="w-12 h-[1px] bg-slate-800"></div>
        <span>SYSTEM VERSION 0.1.1-ALPHA</span>
        <div className="w-12 h-[1px] bg-slate-800"></div>
      </div>
    </div>
  );
};

export default Hub;