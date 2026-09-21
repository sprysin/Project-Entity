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
        <div className="deck-view-overlay animate-in fade-in duration-200" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <section className="deck-view-panel" role="dialog" aria-modal="true" aria-labelledby="deck-view-title">
                <header className="deck-view-header">
                    <div className="deck-view-mark" aria-hidden="true"><i className="fa-solid fa-layer-group" /></div>
                    <div className="deck-view-heading">
                        <h2 id="deck-view-title">{deckName || 'Current Deck'}</h2>
                        <p>{playerName} <b aria-hidden="true"></b> </p>
                    </div>
                    <div className="deck-view-count" aria-label={`${deck.length} cards`}><strong>{String(deck.length).padStart(2, '0')}</strong><span>Cards</span></div>
                    <button aria-label="Close deck" onClick={onClose} className="deck-view-close">
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </header>

                <div className="deck-view-body">
                    <div className="deck-view-preview">
                        {selectedCard ? (
                            <div className="deck-view-preview-card">
                                <CardDetail card={selectedCard} className="h-full w-full" />
                            </div>
                        ) : (
                            <div className="deck-view-empty"><i className="fa-solid fa-layer-group" aria-hidden="true" /></div>
                        )}
                    </div>

                    <div className="deck-view-collection">
                        <div className="deck-view-grid">
                            {sortedDeck.map(card => {
                                const isSelected = selectedCard?.instanceId === card.instanceId;
                                return (
                                    <button
                                        type="button"
                                        key={card.instanceId}
                                        aria-label={`View ${card.name}`}
                                        aria-pressed={isSelected}
                                        onClick={() => setSelectedCard(card)}
                                        className={`deck-view-card ${isSelected ? 'is-selected' : ''}`}
                                    >
                                        <CardDetail card={card} compact className="pointer-events-none h-full w-full" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
