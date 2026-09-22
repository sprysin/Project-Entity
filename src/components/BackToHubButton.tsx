import React from 'react';

export default function BackToHubButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button
    data-sound="cancellation"
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="px-10 py-3 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded-sm font-orbitron font-bold transition-all transform active:scale-95 border border-yellow-500/30 uppercase tracking-widest whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Back to Hub
  </button>;
}
