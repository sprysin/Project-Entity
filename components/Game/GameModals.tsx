import React from 'react';
import { Card, GameState, CardType } from '../../types';
import { CardDetail } from './CardDetail';
import { checkActivationConditions } from '../../hooks/cardHelpers';

interface WinnerModalProps {
    winner: string | null;
    onQuit: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({ winner, onQuit }) => {
    if (!winner) return null;
    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center animate-in fade-in zoom-in text-white">
            <h2 className="text-7xl font-orbitron font-black text-yellow-500 mb-2 uppercase tracking-tighter drop-shadow-[0_0_50px_rgba(234,179,8,0.5)]">Battle Concluded</h2>
            <div className="h-1 w-96 bg-yellow-600/50 mb-12"></div>
            <p className="text-4xl font-orbitron font-bold text-white mb-16 uppercase tracking-widest">{winner} is Victorious</p>
            <button
                onClick={onQuit}
                className="px-16 py-6 bg-yellow-600 hover:bg-yellow-500 text-white font-orbitron font-black text-xl border-b-8 border-yellow-800 active:translate-y-2 active:border-b-0 transition-all uppercase tracking-[0.2em]"
            >
                Return to Hub
            </button>
        </div>
    );
};

interface HandSelectionModalProps {
    selectionReq: { playerIndex: number, title: string } | null;
    gameState: GameState | null;
    selectedHandSelectionIndex: number | null;
    setSelectedHandSelectionIndex: (idx: number | null) => void;
    setHandSelectionReq: (req: null) => void;
    handleHandSelection: (idx: number) => void;
}

export const HandSelectionModal: React.FC<HandSelectionModalProps> = ({
    selectionReq, gameState, selectedHandSelectionIndex, setSelectedHandSelectionIndex, setHandSelectionReq, handleHandSelection
}) => {
    if (!selectionReq || !gameState) return null;
    const hand = gameState.players[selectionReq.playerIndex].hand;

    return (
        <div className="fixed inset-0 bg-black/80 z-[120] flex flex-col items-center justify-center p-8 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border-2 border-red-600 rounded-lg p-8 w-full max-w-5xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                    <h2 className="text-2xl font-orbitron font-black text-red-500 uppercase tracking-widest">{selectionReq.title}</h2>
                    <button onClick={() => setHandSelectionReq(null)} className="px-6 py-2 bg-red-900/40 hover:bg-red-800 text-white font-orbitron text-xs border border-red-500/50 uppercase font-bold tracking-widest">CANCEL</button>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2 scrollbar-hide mb-6">
                    {hand
                        .map((card, idx) => ({ card, idx }))
                        .map(({ card, idx }) => (
                            <div key={idx} onClick={() => setSelectedHandSelectionIndex(idx)} className={`relative transition-all duration-300 cursor-pointer hover:scale-105 ${selectedHandSelectionIndex === idx ? 'ring-4 ring-red-500 scale-105 z-10' : ''}`}>
                                <CardDetail card={card} />
                                {selectedHandSelectionIndex !== idx && <div className="absolute inset-0 bg-red-500/10 hover:bg-red-500/0 transition-colors"></div>}
                                {selectedHandSelectionIndex === idx && <div className="absolute inset-0 bg-red-500/20 pointer-events-none"></div>}
                            </div>
                        ))
                    }
                    {hand.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-500 font-orbitron uppercase tracking-widest">No Cards in Hand</div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                        onClick={() => selectedHandSelectionIndex !== null && handleHandSelection(selectedHandSelectionIndex)}
                        disabled={selectedHandSelectionIndex === null}
                        className={`px-12 py-4 font-orbitron font-black text-xl uppercase tracking-widest transition-all ${selectedHandSelectionIndex !== null ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    >
                        CONFIRM DISCARD
                    </button>
                </div>
            </div>
        </div>
    );
};


interface DiscardSelectionModalProps {
    selectionReq: { playerIndex: number, filter: (c: Card) => boolean, title: string } | null;
    gameState: GameState | null;
    selectedDiscardIndex: number | null;
    setSelectedDiscardIndex: (idx: number | null) => void;
    setDiscardSelectionReq: (req: null) => void;
    handleDiscardSelection: (idx: number) => void;
}

export const DiscardSelectionModal: React.FC<DiscardSelectionModalProps> = ({
    selectionReq, gameState, selectedDiscardIndex, setSelectedDiscardIndex, setDiscardSelectionReq, handleDiscardSelection
}) => {
    if (!selectionReq || !gameState) return null;
    const discard = gameState.players[selectionReq.playerIndex].discard;

    return (
        <div className="fixed inset-0 bg-black/80 z-[120] flex flex-col items-center justify-center p-8 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border-2 border-yellow-600 rounded-lg p-8 w-full max-w-5xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                    <h2 className="text-2xl font-orbitron font-black text-yellow-500 uppercase tracking-widest">{selectionReq.title}</h2>
                    <button onClick={() => setDiscardSelectionReq(null)} className="px-6 py-2 bg-red-900/40 hover:bg-red-800 text-white font-orbitron text-xs border border-red-500/50 uppercase font-bold tracking-widest">CANCEL</button>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2 scrollbar-hide mb-6">
                    {discard
                        .map((card, idx) => ({ card, idx, valid: selectionReq.filter(card) }))
                        .sort((a, b) => (b.valid ? 1 : 0) - (a.valid ? 1 : 0)) // Sort valid first
                        .map(({ card, idx, valid }) => (
                            <div key={idx} onClick={() => valid && setSelectedDiscardIndex(idx)} className={`relative transition-all duration-300 ${valid ? 'cursor-pointer hover:scale-105' : 'opacity-40 grayscale pointer-events-none'} ${selectedDiscardIndex === idx ? 'ring-4 ring-green-500 scale-105 z-10' : ''}`}>
                                <CardDetail card={card} />
                                {valid && selectedDiscardIndex !== idx && <div className="absolute inset-0 bg-yellow-500/10 hover:bg-yellow-500/0 transition-colors"></div>}
                                {selectedDiscardIndex === idx && <div className="absolute inset-0 bg-green-500/20 pointer-events-none"></div>}
                            </div>
                        ))
                    }
                    {discard.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-500 font-orbitron uppercase tracking-widest">No Cards in Discard Pile</div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                        onClick={() => selectedDiscardIndex !== null && handleDiscardSelection(selectedDiscardIndex)}
                        disabled={selectedDiscardIndex === null}
                        className={`px-12 py-4 font-orbitron font-black text-xl uppercase tracking-widest transition-all ${selectedDiscardIndex !== null ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    >
                        CONFIRM SELECTION
                    </button>
                </div>
            </div>
        </div>
    );
};


interface EffectModalProps {
    triggeredEffect: Card | null;
    gameState: GameState | null;
    isPeekingField: boolean;
    resolveEffect: (card: Card) => void;
    checkActivationConditions: (gs: GameState, c: Card, pIdx: number) => boolean;
    setIsPeekingField: (peek: boolean) => void;
    setTriggeredEffect: (card: Card | null) => void;
    setPendingEffectCard: (card: Card | null) => void;
}

export const EffectModal: React.FC<EffectModalProps> = ({
    triggeredEffect, gameState, isPeekingField, resolveEffect, checkActivationConditions, setIsPeekingField, setTriggeredEffect, setPendingEffectCard
}) => {
    if (!triggeredEffect || !gameState) return null;

    return (
        <div className={`fixed inset-0 z-[70] flex flex-col items-center justify-center transition-opacity duration-300 ${isPeekingField ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="bg-slate-900 border-2 border-yellow-600 p-6 flex flex-col items-center space-y-4 shadow-[0_0_40px_rgba(234,179,8,0.5)]">
                <h3 className="text-2xl font-orbitron font-black text-yellow-500 uppercase tracking-tighter">{triggeredEffect.name}</h3>
                <p className="text-white/90 font-mono text-center max-w-sm font-bold text-sm">{triggeredEffect.effectText}</p>
                <div className="flex flex-col w-full space-y-3">
                    <button onClick={() => resolveEffect(triggeredEffect)} disabled={!checkActivationConditions(gameState, triggeredEffect, gameState.activePlayerIndex)} className={`px-8 py-3 text-white font-orbitron font-black uppercase tracking-widest border-b-4 ${!checkActivationConditions(gameState, triggeredEffect, gameState.activePlayerIndex) ? 'bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800'}`}>ACTIVATE ABILITY</button>
                    <div className="flex space-x-3 w-full">
                        <button onClick={() => setIsPeekingField(true)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron text-[10px] font-bold uppercase tracking-widest border border-white/10">Peek Field</button>
                        <button onClick={() => { setTriggeredEffect(null); setPendingEffectCard(null); setIsPeekingField(false); }} className="flex-1 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 font-orbitron text-[10px] font-bold uppercase tracking-widest border border-red-500/30">Decline</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PileViewModalProps {
    viewingDiscardIdx: number | null;
    viewingVoidIdx: number | null;
    gameState: GameState | null;
    setViewingDiscardIdx: (idx: number | null) => void;
    setViewingVoidIdx: (idx: number | null) => void;
}

export const PileViewModal: React.FC<PileViewModalProps> = ({
    viewingDiscardIdx, viewingVoidIdx, gameState, setViewingDiscardIdx, setViewingVoidIdx
}) => {
    if (!gameState) return null;

    if (viewingDiscardIdx !== null) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[110] flex flex-col p-12 backdrop-blur-md animate-in fade-in text-white">
                <div className="flex justify-between items-center mb-8 border-b border-white/20 pb-4">
                    <h2 className="text-4xl font-orbitron font-black text-yellow-500 tracking-[0.2em] uppercase">
                        {gameState.players[viewingDiscardIdx].name} Discard Pile
                    </h2>
                    <button onClick={() => setViewingDiscardIdx(null)} className="px-10 py-4 bg-red-900/40 hover:bg-red-800 text-white font-orbitron text-md border border-red-500/50 uppercase font-bold tracking-widest transition-all">CLOSE VIEW</button>
                </div>
                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-4 scrollbar-hide">
                    {gameState.players[viewingDiscardIdx].discard.map((card, i) => (
                        <CardDetail key={i} card={card} />
                    ))}
                </div>
            </div>
        );
    }

    if (viewingVoidIdx !== null) {
        return (
            <div className="fixed inset-0 bg-purple-900/50 z-[110] flex flex-col p-12 backdrop-blur-md animate-in fade-in text-white">
                <div className="flex justify-between items-center mb-8 border-b border-white/20 pb-4">
                    <h2 className="text-4xl font-orbitron font-black text-purple-400 tracking-[0.2em] uppercase drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]">
                        {gameState.players[viewingVoidIdx].name} Void
                    </h2>
                    <button onClick={() => setViewingVoidIdx(null)} className="px-10 py-4 bg-purple-900/40 hover:bg-purple-800 text-white font-orbitron text-md border border-purple-500/50 uppercase font-bold tracking-widest transition-all">CLOSE VIEW</button>
                </div>
                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-4 scrollbar-hide">
                    {gameState.players[viewingVoidIdx].void.map((card, i) => (
                        <CardDetail key={i} card={card} />
                    ))}
                </div>
            </div>
        );
    }

    return null;
};

interface DeckViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    deck: Card[];
    playerName: string;
}

export const DeckViewModal: React.FC<DeckViewModalProps> = ({
    isOpen, onClose, deck, playerName
}) => {
    const [selectedCard, setSelectedCard] = React.useState<Card | null>(null);

    // --- TWEAKABLE DECK VIEWER SIZES ---
    // Change these values to adjust the layout sizing of the deck viewer's card container.
    const deckContainerWidth = "50vw"; // Adjust to make the card grid wider/narrower (e.g. 50vw is 50% of screen width)
    const deckContainerHeight = "65vh"; // Adjust to make the card grid taller/shorter
    const gridColsPattern = "repeat(10, minmax(0, 1fr))"; // The grid columns. Change the "10" to fit more/less per row.
    const cardScaleTransform = "scale(1)"; // Adjust to change the size of the individual cards relative to their slot.
    // ------------------------------------

    if (!isOpen) return null;

    // Sort: PAWN -> ACTION -> CONDITION, then alphabetically
    const typeOrder = { [CardType.PAWN]: 1, [CardType.ACTION]: 2, [CardType.CONDITION]: 3 };
    const sortedDeck = [...deck].sort((a, b) => {
        if (typeOrder[a.type] !== typeOrder[b.type]) {
            return typeOrder[a.type] - typeOrder[b.type];
        }
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="fixed inset-0 bg-black/60 z-[150] flex flex-col items-center justify-center p-8 animate-in fade-in text-white">

            {/* The detached modal window */}
            <div className="bg-black border-2 border-slate-600 rounded-xl flex flex-col relative p-8">

                {/* Top Right Close Button */}
                <div className="absolute -top-4 -right-4">
                    <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-red-900 border-2 border-red-500 hover:bg-red-700 text-white font-orbitron text-xl uppercase font-black transition-all shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="flex w-full justify-center items-stretch space-x-8 lg:space-x-12">
                    {/* Left Panel: Zoomed in card view */}
                    <div className="w-80 h-[32rem] items-center justify-center p-4 bg-black/30 border-2 border-slate-800 rounded-lg shadow-inner">
                        {selectedCard ? (
                            <div className="w-full h-full items-center justify-center">
                                <CardDetail card={selectedCard} />
                            </div>
                        ) : (
                            <div className="text-slate-500 font-orbitron uppercase tracking-widest text-sm text-center opacity-50 border-2 border-slate-800 border-dashed w-full h-full flex items-center justify-center rounded-lg">
                                Select a card to view
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Deck Container with tweakable sizes */}
                    <div className="flex flex-col" style={{ width: deckContainerWidth }}>
                        <div className="mb-4">
                            <h2 className="text-3xl font-orbitron font-black text-yellow-500 tracking-[0.2em] uppercase drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                                {playerName} - [DECK NAME PLACEHOLDER]
                            </h2>
                            <p className="font-orbitron text-slate-400 text-xs tracking-widest mt-1">Number of Cards: {deck.length}</p>
                        </div>

                        <div
                            className="grid gap-2 p-4 content-start bg-black/40 border-2 border-slate-800 rounded-lg overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent shadow-inner"
                            style={{ height: deckContainerHeight, gridTemplateColumns: gridColsPattern }}
                        >
                            {sortedDeck.map((card, i) => (
                                <div
                                    key={i}
                                    className={`cursor-pointer transition-colors duration-200 border-2 flex items-center justify-center overflow-hidden aspect-[2/3] ${selectedCard === card ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'border-slate-800 hover:border-slate-600'}`}
                                    onClick={() => setSelectedCard(card)}
                                    style={{ padding: '2px' }}
                                >
                                    <div className="w-full h-full transform-origin-center flex justify-center items-center" style={{ transform: cardScaleTransform }}>
                                        <CardDetail card={card} compact={true} className="pointer-events-none w-full h-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
