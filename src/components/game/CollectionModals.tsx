import React from 'react';
import { Card, CardType, GameState } from '../../types';
import { CardDetail } from './CardDetail';

export const PileViewModal: React.FC<{
    viewingDiscardIdx: number | null; viewingVoidIdx: number | null; gameState: GameState | null;
    setViewingDiscardIdx: (index: number | null) => void; setViewingVoidIdx: (index: number | null) => void;
}> = ({ viewingDiscardIdx, viewingVoidIdx, gameState, setViewingDiscardIdx, setViewingVoidIdx }) => {
    const panelRef = React.useRef<HTMLElement>(null);
    const close = React.useCallback(() => { setViewingDiscardIdx(null); setViewingVoidIdx(null); }, [setViewingDiscardIdx, setViewingVoidIdx]);

    React.useEffect(() => {
        if (viewingDiscardIdx === null && viewingVoidIdx === null) return;
        const outside = (event: PointerEvent) => { if (!panelRef.current?.contains(event.target as Node)) close(); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [viewingDiscardIdx, viewingVoidIdx, close]);

    const playerIndex = viewingDiscardIdx ?? viewingVoidIdx;
    if (!gameState || playerIndex === null) return null;
    const isVoid = viewingDiscardIdx === null;
    const cards = gameState.players[playerIndex][isVoid ? 'void' : 'discard'];

    return (
        <aside ref={panelRef} aria-label={isVoid ? 'Void pile contents' : 'Discard pile contents'} className="pile-drawer absolute inset-y-0 right-0 z-[110] flex w-80 max-w-[90vw] flex-col border-l border-white/20 bg-slate-950 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/15 p-5">
                <div>
                    <p className="text-xs text-slate-400">{gameState.players[playerIndex].name}</p>
                    <h2 className={`font-orbitron text-lg ${isVoid ? 'text-purple-400' : 'text-yellow-400'}`}>{isVoid ? 'VOID' : 'DISCARD'} · {cards.length}</h2>
                    <p className="mt-1 text-xs text-slate-400">Most recent first</p>
                </div>
                <button aria-label="Close pile" onClick={close} className="rounded px-3 py-2 hover:bg-white/10">✕</button>
            </div>
            <div className="grid flex-1 auto-rows-max grid-cols-2 content-start gap-x-3 gap-y-4 overflow-y-auto p-5">
                {cards.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-slate-400">This pile is empty.</p>}
                {[...cards].reverse().map(card => <CardDetail key={card.instanceId} card={card} compact />)}
            </div>
        </aside>
    );
};

const typeOrder: Record<CardType, number> = { [CardType.PAWN]: 1, [CardType.ACTION]: 2, [CardType.CONDITION]: 3 };

export const DeckViewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    deck: Card[];
    playerName: string;
    deckName?: string;
}> = ({ isOpen, onClose, deck, playerName, deckName }) => {
    const sortedDeck = React.useMemo(() => {
        return [...deck].sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.name.localeCompare(b.name));
    }, [deck]);

    const [selectedCard, setSelectedCard] = React.useState<Card | null>(null);

    React.useEffect(() => {
        if (isOpen && sortedDeck.length > 0) {
            setSelectedCard(prev => {
                if (prev && sortedDeck.some(c => c.instanceId === prev.instanceId || c.id === prev.id)) {
                    return prev;
                }
                return sortedDeck[0];
            });
        }
    }, [isOpen, sortedDeck]);

    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/70 p-6 backdrop-blur-md text-white animate-in fade-in duration-200">
            <div className="relative flex max-h-[92vh] max-w-7xl w-full flex-col rounded-xl border-2 border-slate-700 bg-slate-950 p-6 shadow-2xl">
                <button
                    aria-label="Close deck"
                    onClick={onClose}
                    className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-500 bg-red-900/90 font-orbitron text-lg font-black text-white shadow-[0_0_15px_rgba(220,38,38,0.8)] transition-all hover:scale-110 hover:bg-red-700 z-10"
                >
                    <i className="fa-solid fa-xmark" />
                </button>
                <div className="flex w-full items-stretch justify-center space-x-6 lg:space-x-8 min-h-0 flex-1">
                    {/* Left Card Preview / Viewer */}
                    <div className="flex flex-col items-center justify-center w-72 lg:w-80 shrink-0 rounded-lg border-2 border-slate-800 bg-black/40 p-4 shadow-inner">
                        {selectedCard ? (
                            <div className="w-full h-full max-h-[460px] flex items-center justify-center">
                                <CardDetail card={selectedCard} className="w-full h-full" />
                            </div>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-800 text-center font-orbitron text-xs uppercase tracking-widest text-slate-500 opacity-50 p-4">
                                Select a card to view
                            </div>
                        )}
                    </div>

                    {/* Right side: Deck Name header + Gallery of Cards */}
                    <div className="flex flex-1 flex-col min-w-0">
                        <div className="mb-3 flex items-baseline justify-between border-b border-white/10 pb-3">
                            <div>
                                <h2 className="font-orbitron text-2xl lg:text-3xl font-black uppercase tracking-[0.15em] text-yellow-500 drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                                    {deckName || 'Current Deck'}
                                </h2>
                                <p className="mt-1 font-orbitron text-xs tracking-widest text-slate-400">
                                    {playerName} · Starting Deck ({deck.length} Cards)
                                </p>
                            </div>
                            {selectedCard && (
                                <div className="text-right hidden sm:block">
                                    <div className="font-orbitron text-sm font-bold text-slate-200">{selectedCard.name}</div>
                                    <div className="text-xs text-slate-400 font-mono">[{selectedCard.type}]</div>
                                </div>
                            )}
                        </div>

                        <div className="grid max-h-[60vh] flex-1 grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 content-start gap-2 overflow-y-auto overflow-x-hidden rounded-lg border-2 border-slate-800 bg-black/40 p-4 shadow-inner">
                            {sortedDeck.map(card => {
                                const isSelected = selectedCard?.instanceId === card.instanceId;
                                return (
                                    <button
                                        type="button"
                                        key={card.instanceId}
                                        onClick={() => setSelectedCard(card)}
                                        className={`group relative flex aspect-[2/3] cursor-pointer items-center justify-center overflow-hidden rounded border-2 p-0.5 transition-all duration-200 hover:scale-105 hover:z-10 ${
                                            isSelected
                                                ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)] ring-2 ring-yellow-400/50 scale-105 z-10'
                                                : 'border-slate-800 hover:border-slate-500'
                                        }`}
                                    >
                                        <CardDetail card={card} compact className="pointer-events-none h-full w-full" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
