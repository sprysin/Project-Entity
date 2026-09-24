import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardTarget, GameState, Position } from '../../types';
import { cardRegistry } from '../../cards/CardRegistry';
import { CardDetail } from '../cards/CardDetail';

interface GameSidebarProps {
    viewerIndex?: number;
    gameState: GameState;
    selectedCard: Card | null;
    inspectedCard?: Card | null;
    selectedFieldSlot: CardTarget | null;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const GameSidebar: React.FC<GameSidebarProps> = ({ gameState, viewerIndex = gameState.activePlayerIndex, selectedCard, inspectedCard, selectedFieldSlot, isOpen, setIsOpen }) => {
    const [logCard, setLogCard] = useState<Card | null>(null);
    const cardsByName = useMemo(() => new Map(cardRegistry.getAllCards().map(card => [card.name, card])), []);
    const selectedZone = selectedFieldSlot
        ? gameState.players[selectedFieldSlot.playerIndex][selectedFieldSlot.type === 'pawn' ? 'pawnZones' : 'actionZones'][selectedFieldSlot.index]
        : null;
    const revealedCard = gameState.peekEvents?.find(event => event.viewerPlayerIndex === viewerIndex)?.card;
    useEffect(() => setLogCard(null), [selectedCard?.instanceId, inspectedCard?.instanceId, selectedFieldSlot?.playerIndex, selectedFieldSlot?.type, selectedFieldSlot?.index]);

    const renderLogEntry = (entry: string) => {
        const parts = entry.split(/("[^"]+")/g);
        return parts.map((part, index) => {
            const name = part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : '';
            const definition = cardsByName.get(name);
            if (!definition) return <React.Fragment key={index}>{part}</React.Fragment>;
            return <button data-sound="select-small" key={index} type="button" className="font-bold text-yellow-400 underline decoration-yellow-500/50 underline-offset-2 hover:text-yellow-200" onClick={() => setLogCard({ ...definition, instanceId: `log-${definition.id}`, ownerId: 'log-preview' })}>{part}</button>;
        });
    };

    return (
        <aside className={`relative z-40 flex flex-col border-l border-white/10 bg-black/80 backdrop-blur-2xl transition-all duration-300 ease-in-out ${isOpen ? 'w-80' : 'w-10'}`}>
            <button aria-label={isOpen ? 'Collapse system data' : 'Expand system data'} onClick={() => setIsOpen(!isOpen)} className="absolute -left-3 top-1/2 z-50 flex h-12 w-6 items-center justify-center rounded-l-md border-l border-y border-yellow-400 bg-yellow-600 text-black shadow-lg transition-colors hover:bg-yellow-500">
                <i className={`fa-solid ${isOpen ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
            </button>
            <div className="relative flex flex-1 flex-col overflow-hidden">
                {isOpen ? (
                    <div className="flex h-full flex-1 flex-col overflow-hidden">
                        <div className="flex-none p-6 pb-2">
                            {revealedCard ? (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <CardDetail card={revealedCard} />
                                </div>
                            ) : logCard ? (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <CardDetail card={logCard} />
                                    <button data-sound="cancellation" type="button" onClick={() => setLogCard(null)} className="w-full font-orbitron text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-yellow-400">Close log preview</button>
                                </div>
                            ) : selectedZone && selectedFieldSlot ? (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <CardDetail card={selectedZone.card} isSet={selectedZone.position === Position.HIDDEN && selectedFieldSlot.playerIndex !== viewerIndex} showOriginalStats={selectedFieldSlot.type === 'pawn'} />
                                </div>
                            ) : selectedCard ? (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <CardDetail card={selectedCard} />
                                    <p className="text-center font-orbitron text-[9px] font-bold uppercase tracking-widest text-slate-500">Select an open zone to choose how to play this card.</p>
                                </div>
                            ) : inspectedCard ? (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <CardDetail card={inspectedCard} />
                                </div>
                            ) : (
                                <div className="flex h-64 flex-col items-center justify-center space-y-6 opacity-30 grayscale">
                                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/10"><i className="fa-solid fa-crosshairs text-4xl text-slate-600" /></div>
                                    <span className="text-center font-orbitron text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Select card to view...</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex flex-1 flex-col overflow-hidden px-6 pb-6">
                            <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                                <span className="flex items-center gap-2 font-orbitron text-[10px] font-bold uppercase tracking-widest text-yellow-500"><i className="fa-solid fa-code-branch" /> System log</span>
                            </div>
                            <div className="flex-1 space-y-2 overflow-y-auto pr-2 font-mono text-[10px]">
                                {gameState.log.map((entry, index) => /^Turn \d+$/.test(entry) ? (
                                    <div key={`${index}-${entry}`} className="flex items-center gap-2 py-2 font-orbitron text-[9px] font-bold uppercase tracking-widest text-yellow-500" role="separator" aria-label={entry}>
                                        <span className="h-px flex-1 bg-yellow-500/40" /><span>{entry}</span><span className="h-px flex-1 bg-yellow-500/40" />
                                    </div>
                                ) : (
                                    <div key={`${index}-${entry}`} className={`border-l-2 py-1 pl-2 transition-all duration-300 ${index === 0 ? 'animate-pulse border-yellow-500 bg-white/5 text-white' : 'border-slate-800 text-slate-500'}`}>{renderLogEntry(entry)}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setIsOpen(true)} className="flex flex-1 cursor-pointer flex-col items-center justify-center space-y-8 pt-4 transition-colors hover:bg-white/5">
                        <span className="rotate-90 whitespace-nowrap font-orbitron text-[10px] font-bold uppercase tracking-widest text-slate-500 opacity-60">System data</span>
                    </button>
                )}
            </div>
        </aside>
    );
};
