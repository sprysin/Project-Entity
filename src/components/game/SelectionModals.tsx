import React from 'react';
import { Card, CardSelectionRequest, GameState, HandSelectionRequest, PeekSelectionRequest } from '../../types';
import { CardDetail } from '../cards/CardDetail';

type SelectionTheme = 'red' | 'yellow' | 'indigo';

const themes: Record<SelectionTheme, { frame: string; heading: string; ring: string; overlay: string; confirm: string }> = {
    red: {
        frame: 'border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.3)]',
        heading: 'text-red-500', ring: 'ring-red-500', overlay: 'bg-red-500/20',
        confirm: 'bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)]'
    },
    yellow: {
        frame: 'border-yellow-600 shadow-[0_0_50px_rgba(234,179,8,0.3)]',
        heading: 'text-yellow-500', ring: 'ring-green-500', overlay: 'bg-green-500/20',
        confirm: 'bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
    },
    indigo: {
        frame: 'border-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.3)]',
        heading: 'text-indigo-500', ring: 'ring-indigo-500', overlay: 'bg-indigo-500/20',
        confirm: 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.5)]'
    }
};

interface CardSelectionModalProps {
    title: string;
    cards: Card[];
    selectedIndex: number | null;
    onSelect: (index: number | null) => void;
    onCancel: () => void;
    onConfirm: (index: number) => void;
    emptyLabel: string;
    confirmLabel: string;
    theme: SelectionTheme;
    filter?: (card: Card) => boolean;
    cancellable?: boolean;
}

const CardSelectionModal: React.FC<CardSelectionModalProps> = ({
    title, cards, selectedIndex, onSelect, onCancel, onConfirm,
    emptyLabel, confirmLabel, theme, filter, cancellable = true
}) => {
    const colors = themes[theme];
    const choices = cards
        .map((card, index) => ({ card, index, valid: filter?.(card) ?? true }))
        .sort((a, b) => Number(b.valid) - Number(a.valid));

    return (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/80 p-8 backdrop-blur-sm animate-in fade-in">
            <div className={`flex max-h-[80vh] w-full max-w-5xl flex-col rounded-lg border-2 bg-slate-900 p-8 ${colors.frame}`}>
                <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                    <h2 className={`font-orbitron text-2xl font-black uppercase tracking-widest ${colors.heading}`}>{title}</h2>
                    {cancellable && <button data-sound="cancellation" onClick={onCancel} className="border border-red-500/50 bg-red-900/40 px-6 py-2 font-orbitron text-xs font-bold uppercase tracking-widest text-white hover:bg-red-800">Cancel</button>}
                </div>
                <div className="mb-6 grid flex-1 grid-cols-2 gap-6 overflow-y-auto p-2 md:grid-cols-4 lg:grid-cols-5">
                    {choices.map(({ card, index, valid }) => (
                        <button
                            data-sound="select-small"
                            key={card.instanceId}
                            type="button"
                            disabled={!valid}
                            onClick={() => onSelect(index)}
                            className={`relative text-left transition-all duration-300 ${valid ? 'cursor-pointer hover:scale-105' : 'pointer-events-none opacity-40 grayscale'} ${selectedIndex === index ? `z-10 scale-105 ring-4 ${colors.ring}` : ''}`}
                        >
                            <CardDetail card={card} />
                            {selectedIndex === index && <span className={`pointer-events-none absolute inset-0 ${colors.overlay}`} />}
                        </button>
                    ))}
                    {cards.length === 0 && <div className="col-span-full py-12 text-center font-orbitron uppercase tracking-widest text-slate-500">{emptyLabel}</div>}
                </div>
                <div className="flex justify-end border-t border-white/10 pt-4">
                    <button
                        data-sound="select"
                        disabled={selectedIndex === null}
                        onClick={() => selectedIndex !== null && onConfirm(selectedIndex)}
                        className={`px-12 py-4 font-orbitron text-xl font-black uppercase tracking-widest text-white transition-all ${selectedIndex === null ? 'cursor-not-allowed bg-slate-800 text-slate-500' : colors.confirm}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface HandSelectionModalProps {
    selectionReq: HandSelectionRequest | null;
    gameState: GameState | null;
    selectedHandSelectionIndex: number | null;
    setSelectedHandSelectionIndex: (index: number | null) => void;
    setHandSelectionReq: (request: null) => void;
    handleHandSelection: (index: number) => void;
}

export const HandSelectionModal: React.FC<HandSelectionModalProps> = ({ selectionReq, gameState, selectedHandSelectionIndex, setSelectedHandSelectionIndex, setHandSelectionReq, handleHandSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal title={selectionReq.title ?? 'Select a card'} cards={gameState.players[selectionReq.playerIndex].hand} selectedIndex={selectedHandSelectionIndex} onSelect={setSelectedHandSelectionIndex} onCancel={() => setHandSelectionReq(null)} onConfirm={handleHandSelection} emptyLabel="No cards in hand" confirmLabel="Confirm discard" theme="red" filter={selectionReq.filter} />;
};

export const PeekSelectionModal: React.FC<{
    selectionReq: PeekSelectionRequest | null; gameState: GameState | null; selectedPeekIndex: number | null;
    setSelectedPeekIndex: (index: number | null) => void; cancelEffect: () => void; handlePeekSelection: (index: number) => void;
}> = ({ selectionReq, gameState, selectedPeekIndex, setSelectedPeekIndex, cancelEffect, handlePeekSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal title={selectionReq.title ?? 'Select a card to show'} cards={gameState.players[selectionReq.playerIndex].hand} selectedIndex={selectedPeekIndex} onSelect={setSelectedPeekIndex} onCancel={cancelEffect} onConfirm={handlePeekSelection} emptyLabel="No cards in hand" confirmLabel="Show this card" theme="indigo" cancellable={false} />;
};

export const DiscardSelectionModal: React.FC<{
    selectionReq: CardSelectionRequest | null; gameState: GameState | null; selectedDiscardIndex: number | null;
    setSelectedDiscardIndex: (index: number | null) => void; setDiscardSelectionReq: (request: null) => void; handleDiscardSelection: (index: number) => void;
}> = ({ selectionReq, gameState, selectedDiscardIndex, setSelectedDiscardIndex, setDiscardSelectionReq, handleDiscardSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal title={selectionReq.title ?? 'Select a card'} cards={gameState.players[selectionReq.playerIndex].discard} selectedIndex={selectedDiscardIndex} onSelect={setSelectedDiscardIndex} onCancel={() => setDiscardSelectionReq(null)} onConfirm={handleDiscardSelection} emptyLabel="No cards in discard pile" confirmLabel="Confirm selection" theme="yellow" filter={selectionReq.filter} />;
};

export const DeckSelectionModal: React.FC<{
    selectionReq: CardSelectionRequest | null; gameState: GameState | null; selectedDeckIndex: number | null;
    setSelectedDeckIndex: (index: number | null) => void; setDeckSelectionReq: (request: null) => void; handleDeckSelection: (index: number) => void;
}> = ({ selectionReq, gameState, selectedDeckIndex, setSelectedDeckIndex, setDeckSelectionReq, handleDeckSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal title={selectionReq.title ?? 'Select a card'} cards={gameState.players[selectionReq.playerIndex].deck} selectedIndex={selectedDeckIndex} onSelect={setSelectedDeckIndex} onCancel={() => setDeckSelectionReq(null)} onConfirm={handleDeckSelection} emptyLabel="No cards in deck" confirmLabel="Confirm selection" theme="indigo" filter={selectionReq.filter} />;
};
