import React from 'react';

type MenuTone = 'gold' | 'slate' | 'green' | 'purple' | 'red';

const tones: Record<MenuTone, string> = {
    gold: 'border-yellow-500 bg-yellow-600 hover:bg-yellow-500',
    slate: 'border-slate-500 bg-slate-800 hover:bg-slate-700',
    green: 'border-green-500 bg-green-700 hover:bg-green-600',
    purple: 'border-purple-500 bg-purple-700 hover:bg-purple-600',
    red: 'border-red-500 bg-red-900 hover:bg-red-800'
};

export const ContextMenu: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="w-64 max-w-[calc(100vw-1rem)] rounded border border-yellow-400/60 bg-slate-950/95 p-2 text-white shadow-[0_0_28px_rgba(0,0,0,0.85)] backdrop-blur-md">
        <div className="overflow-hidden whitespace-nowrap px-2 pb-2 text-center font-orbitron text-[9px] font-black uppercase tracking-[0.18em] text-yellow-400">
            <span className="inline-block whitespace-nowrap" style={{ transform: `scaleX(${Math.max(.58, Math.min(1, 22 / title.length))})` }}>{title}</span>
        </div>
        <div className="flex gap-2">{children}</div>
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-yellow-400/60" />
    </div>
);

export const ContextMenuButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean; tone?: MenuTone }> = ({ label, onClick, disabled = false, tone = 'slate' }) => (
    <button disabled={disabled} onClick={onClick} className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap border px-2 py-2 font-orbitron text-[9px] font-black uppercase tracking-wider transition-colors ${tones[tone]} ${disabled ? 'cursor-not-allowed opacity-35 grayscale' : ''}`}>
        <span className="inline-block whitespace-nowrap" style={{ transform: `scaleX(${Math.max(.72, Math.min(1, 14 / label.length))})` }}>{label}</span>
    </button>
);
