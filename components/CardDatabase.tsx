import React, { useState, useMemo } from 'react';
import { BASE_CARDS } from '../constants';
import { CardDetail } from './Game/CardDetail';
import { CardType, Card } from '../types';

interface CardDatabaseProps {
    onBack: () => void;
}

const CardDatabase: React.FC<CardDatabaseProps> = ({ onBack }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);

    const filteredCards = useMemo(() => {
        return BASE_CARDS.filter(card =>
            card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.effectText.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const pawns = filteredCards.filter(c => c.type === CardType.ENTITY);
    const actions = filteredCards.filter(c => c.type === CardType.ACTION);
    const conditions = filteredCards.filter(c => c.type === CardType.CONDITION);

    return (
        <div className="flex-1 flex overflow-hidden retro-hash bg-[#050505] text-slate-100 font-roboto">
            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-8 w-full">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between md:items-center border-b-4 border-yellow-500/50 pb-6 gap-6">
                        <div className="space-y-1">
                            <h2 className="text-6xl font-orbitron font-bold text-yellow-500 tracking-tighter drop-shadow-[0_0_20px_rgba(234,179,8,0.3)] uppercase">Database</h2>
                            <p className="text-slate-400 font-orbitron text-xs tracking-[0.4em] uppercase">Card Index</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="relative">
                                <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500"></i>
                                <input
                                    type="text"
                                    placeholder="Search Database..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-3 bg-slate-900 border border-yellow-500/30 text-yellow-500 font-orbitron outline-none focus:ring-2 focus:ring-yellow-500 placeholder-slate-600 rounded-sm w-64 md:w-80 shadow-inner"
                                />
                            </div>
                            <button
                                onClick={onBack}
                                className="px-10 py-3 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded-sm font-orbitron font-bold transition-all transform active:scale-95 border border-yellow-500/30 uppercase tracking-widest whitespace-nowrap"
                            >
                                Back to Hub
                            </button>
                        </div>
                    </div>

                    {/* Card Sections */}
                    <div className="space-y-12 pb-12">
                        {pawns.length > 0 && (
                            <div className="space-y-4 bg-black/40 p-6 rounded-lg border border-white/5 shadow-2xl">
                                <h3 className="text-3xl font-orbitron font-bold text-slate-200 border-b border-slate-700/50 pb-3 flex items-center gap-3">
                                    <i className="fa-solid fa-chess-pawn text-yellow-500 text-2xl"></i> Pawns
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {pawns.map(card => (
                                        <div key={card.id} className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2 ${selectedCard?.id === card.id ? 'ring-4 ring-yellow-500 rounded' : 'opacity-90 hover:opacity-100'}`} onClick={() => setSelectedCard(card)}>
                                            <CardDetail card={card} compact={true} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {actions.length > 0 && (
                            <div className="space-y-4 bg-black/40 p-6 rounded-lg border border-white/5 shadow-2xl">
                                <h3 className="text-3xl font-orbitron font-bold text-slate-200 border-b border-slate-700/50 pb-3 flex items-center gap-3">
                                    <i className="fa-solid fa-wand-sparkles text-green-400 text-2xl"></i> Actions
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {actions.map(card => (
                                        <div key={card.id} className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2 ${selectedCard?.id === card.id ? 'ring-4 ring-green-500 rounded' : 'opacity-90 hover:opacity-100'}`} onClick={() => setSelectedCard(card)}>
                                            <CardDetail card={card} compact={true} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {conditions.length > 0 && (
                            <div className="space-y-4 bg-black/40 p-6 rounded-lg border border-white/5 shadow-2xl">
                                <h3 className="text-3xl font-orbitron font-bold text-slate-200 border-b border-slate-700/50 pb-3 flex items-center gap-3">
                                    <i className="fa-solid fa-hourglass-half text-purple-400 text-2xl"></i> Conditions
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {conditions.map(card => (
                                        <div key={card.id} className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2 ${selectedCard?.id === card.id ? 'ring-4 ring-purple-500 rounded' : 'opacity-90 hover:opacity-100'}`} onClick={() => setSelectedCard(card)}>
                                            <CardDetail card={card} compact={true} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {filteredCards.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                                <i className="fa-solid fa-ghost text-6xl opacity-50"></i>
                                <p className="font-orbitron tracking-widest uppercase font-bold">No Records Found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Side Panel (Similar to GameView) */}
            <div className="w-80 border-l border-white/10 bg-black/80 backdrop-blur-2xl z-40 flex flex-col p-6 overflow-y-auto shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.5)]">
                {selectedCard ? (
                    <div className="animate-in slide-in-from-right-4 duration-300">
                        <CardDetail card={selectedCard} />
                        <div className="mt-8 flex flex-col space-y-3 bg-black/50 p-4 rounded border border-white/5">
                            <div className="font-orbitron text-xs text-yellow-500 uppercase font-bold tracking-widest border-b border-yellow-500/30 pb-2 mb-2 flex items-center gap-2">
                                <i className="fa-solid fa-database"></i> Card Data
                            </div>
                            <div className="text-xs text-slate-400 font-mono flex justify-between"><span className="text-slate-500">TAG:</span> <span className="text-white">{selectedCard.id.toUpperCase()}</span></div>
                            <div className="text-xs text-slate-400 font-mono flex justify-between"><span className="text-slate-500">CLASS:</span> <span className="text-white">{selectedCard.type}</span></div>
                            {selectedCard.type === CardType.ENTITY && (
                                <>
                                    <div className="text-xs text-slate-400 font-mono flex justify-between"><span className="text-slate-500">LEVEL:</span> <span className="text-white">{selectedCard.level}</span></div>
                                    <div className="text-xs text-slate-400 font-mono flex justify-between"><span className="text-slate-500">ATTR:</span> <span className="text-white">{selectedCard.attribute || 'N/A'}</span></div>
                                    <div className="text-xs text-slate-400 font-mono flex justify-between"><span className="text-slate-500">RACE:</span> <span className="text-white">{selectedCard.entityType || 'N/A'}</span></div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 space-y-6 grayscale transition-all">
                        <div className="w-32 h-32 border-4 border-dashed border-slate-600 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                            <i className="fa-solid fa-crosshairs text-5xl text-slate-500 animate-[spin_10s_linear_infinite_reverse]"></i>
                        </div>
                        <span className="text-[10px] font-orbitron tracking-widest text-center uppercase font-bold text-slate-400 tracking-[0.2em] leading-relaxed max-w-[200px]">
                            Select Entity Data to View Detailed Telemetry...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CardDatabase;
