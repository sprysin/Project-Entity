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
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {cards.length === 0 && <p className="py-8 text-center text-sm text-slate-400">This pile is empty.</p>}
                {[...cards].reverse().map(card => <CardDetail key={card.instanceId} card={card} />)}
            </div>
        </aside>
    );
};

const typeOrder: Record<CardType, number> = { [CardType.PAWN]: 1, [CardType.ACTION]: 2, [CardType.CONDITION]: 3 };

export const DeckViewModal: React.FC<{ isOpen: boolean; onClose: () => void; deck: Card[]; playerName: string }> = ({ isOpen, onClose, deck, playerName }) => {
    const [selectedCard, setSelectedCard] = React.useState<Card | null>(null);
    if (!isOpen) return null;

    const sortedDeck = [...deck].sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.name.localeCompare(b.name));
    return (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/60 p-8 text-white animate-in fade-in">
            <div className="relative flex flex-col rounded-xl border-2 border-slate-600 bg-black p-8">
                <button aria-label="Close deck" onClick={onClose} className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center border-2 border-red-500 bg-red-900 font-orbitron text-xl font-black text-white shadow-[0_0_15px_rgba(220,38,38,0.8)] transition-all hover:bg-red-700"><i className="fa-solid fa-xmark" /></button>
                <div className="flex w-full items-stretch justify-center space-x-8 lg:space-x-12">
                    <div className="flex h-[32rem] w-80 items-center justify-center rounded-lg border-2 border-slate-800 bg-black/30 p-4 shadow-inner">
                        {selectedCard ? <CardDetail card={selectedCard} /> : <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-800 text-center font-orbitron text-sm uppercase tracking-widest text-slate-500 opacity-50">Select a card to view</div>}
                    </div>
                    <div className="flex w-[50vw] flex-col">
                        <div className="mb-4">
                            <h2 className="font-orbitron text-3xl font-black uppercase tracking-[0.2em] text-yellow-500 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">{playerName} — Starting Deck</h2>
                            <p className="mt-1 font-orbitron text-xs tracking-widest text-slate-400">Number of cards: {deck.length}</p>
                        </div>
                        <div className="grid h-[65vh] grid-cols-10 content-start gap-2 overflow-y-auto overflow-x-hidden rounded-lg border-2 border-slate-800 bg-black/40 p-4 shadow-inner">
                            {sortedDeck.map(card => (
                                <button key={card.instanceId} onClick={() => setSelectedCard(card)} className={`flex aspect-[2/3] cursor-pointer items-center justify-center overflow-hidden border-2 p-0.5 transition-colors ${selectedCard?.instanceId === card.instanceId ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'border-slate-800 hover:border-slate-600'}`}>
                                    <CardDetail card={card} compact className="pointer-events-none h-full w-full" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
