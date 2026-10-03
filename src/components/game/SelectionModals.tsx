import React, { useEffect, useState } from 'react';
import { Card, CardSelectionRequest, GameState, HandSelectionRequest, PeekSelectionRequest, ShuffleSelectionRequest } from '../../types';
import { CardDetail } from '../cards/CardDetail';
import { cardsAtLocation } from '../../game/cardHelpers';
import { DuelPrompt } from './DuelPrompt';

export const VoidSelectionModal: React.FC<{
    gameState: GameState;
    onConfirm: (sourceId: string, cardId: string) => void;
}> = ({ gameState, onConfirm }) => {
    const request = gameState.pendingVoidSelections?.[0];
    const [selected, setSelected] = useState<number | null>(null);
    useEffect(() => setSelected(null), [request]);
    if (!request) return null;
    const owner = gameState.players[request.playerIndex];
    const pile = gameState.players[request.pilePlayerIndex];
    return <CardSelectionModal searchLabel="Discard pile search" title={request.source.name}
        prompt={`${owner.name}: Choose 1 card from ${pile.name}'s Discard Pile to Void.`}
        cards={pile.discard} selectedIndex={selected} onSelect={setSelected}
        onConfirm={index => onConfirm(request.source.instanceId, pile.discard[index].instanceId)}
        emptyLabel="No cards in discard pile" confirmLabel="Void selected card" />;
};

export const ShuffleSelectionModal: React.FC<{
    request: ShuffleSelectionRequest | null;
    gameState: GameState;
    onConfirm: (cardIds: string[]) => void;
}> = ({ request, gameState, onConfirm }) => {
    const [selected, setSelected] = useState<number[]>([]);
    useEffect(() => setSelected([]), [request]);
    if (!request) return null;
    const choices = cardsAtLocation(gameState.players[request.playerIndex], request.location).filter(entry => request.filter(entry.card));
    return <CardSelectionModal
        title={`Shuffle from ${request.location} (${selected.length}/${request.count})`}
        cards={choices.map(entry => entry.card)}
        selectedIndex={null}
        selectedIndices={selected}
        requiredCount={request.count}
        onSelect={index => {
            if (index === null) return;
            setSelected(current => current.includes(index) ? current.filter(value => value !== index)
                : current.length < request.count ? [...current, index] : current);
        }}
        onConfirmMulti={indices => onConfirm(indices.map(index => choices[index].card.instanceId))}
        emptyLabel={`No cards in ${request.location}`}
        confirmLabel="Confirm shuffle"
        searchLabel={`${request.location} selection`}
    />;
};

interface CardSelectionModalProps {
    title: string;
    prompt?: string;
    cards: Card[];
    selectedIndex: number | null;
    onSelect: (index: number | null) => void;
    onCancel?: () => void;
    onConfirm?: (index: number) => void;
    emptyLabel: string;
    confirmLabel: string;
    filter?: (card: Card) => boolean;
    selectedIndices?: number[];
    requiredCount?: number;
    onConfirmMulti?: (indices: number[]) => void;
    searchLabel?: string;
}

export const CardSelectionModal: React.FC<CardSelectionModalProps> = ({
    title, prompt, cards, selectedIndex, onSelect, onCancel, onConfirm,
    emptyLabel, confirmLabel, filter,
    selectedIndices, requiredCount, onConfirmMulti, searchLabel = 'Card selection'
}) => {
    const [peeking, setPeeking] = useState(false);
    useEffect(() => {
        if (!peeking) return;
        const returnToPrompt = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setPeeking(false);
        };
        window.addEventListener('keydown', returnToPrompt);
        return () => window.removeEventListener('keydown', returnToPrompt);
    }, [peeking]);
    const choices = cards
        .map((card, index) => ({ card, index, valid: filter?.(card) ?? true }))
        .sort((a, b) => Number(b.valid) - Number(a.valid));
    const isSelected = (index: number) => selectedIndex === index || selectedIndices?.includes(index) === true;
    const confirmDisabled = onConfirmMulti ? selectedIndices?.length !== requiredCount : selectedIndex === null;
    return <DuelPrompt className="duel-prompt--card-search" ariaLabel={searchLabel} title={<strong>{title}</strong>}
        peeking={peeking} setPeeking={setPeeking} actions={[
            ...(onCancel ? [{ label: 'Cancel', onClick: onCancel, variant: 'secondary' as const }] : []),
            { label: confirmLabel, variant: 'primary', disabled: confirmDisabled, onClick: () => onConfirmMulti
                ? selectedIndices && onConfirmMulti(selectedIndices)
                : selectedIndex !== null && onConfirm?.(selectedIndex) },
        ]}>
        {prompt && <div className="card-search__summary"><p>{prompt}</p></div>}
        <div className="card-search__grid">
            {choices.map(({ card, index, valid }) => <button key={card.instanceId} type="button" data-sound="select-small"
                aria-label={card.name} aria-pressed={isSelected(index)} disabled={!valid} onClick={() => onSelect(index)}
                className={`duel-card-choice ${isSelected(index) ? 'is-selected' : ''}`}>
                <CardDetail card={card} className="w-full h-full" />
                {isSelected(index) && <span className="card-search__selected" aria-hidden="true"><i className="fa-solid fa-check" /></span>}
            </button>)}
            {cards.length === 0 && <div className="card-search__empty">{emptyLabel}</div>}
        </div>
    </DuelPrompt>;
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
    return <CardSelectionModal searchLabel="Hand selection" title={selectionReq.title ?? 'Select a card'} prompt={selectionReq.prompt} cards={gameState.players[selectionReq.playerIndex].hand} selectedIndex={selectedHandSelectionIndex} onSelect={setSelectedHandSelectionIndex} onCancel={() => setHandSelectionReq(null)} onConfirm={handleHandSelection} emptyLabel="No cards in hand" confirmLabel={selectionReq.purpose === 'summon' ? 'Choose Pawn' : 'Confirm discard'} filter={selectionReq.filter} />;
};

export const PeekSelectionModal: React.FC<{
    selectionReq: PeekSelectionRequest | null; gameState: GameState | null; selectedPeekIndex: number | null;
    setSelectedPeekIndex: (index: number | null) => void; cancelEffect: () => void; handlePeekSelection: (index: number) => void;
    filter?: (card: Card) => boolean; confirmLabel?: string; cancellable?: boolean;
}> = ({ selectionReq, gameState, selectedPeekIndex, setSelectedPeekIndex, cancelEffect, handlePeekSelection, filter, confirmLabel = 'Show this card', cancellable = false }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal searchLabel="Hand selection" title={selectionReq.title ?? 'Select a card to show'} prompt={selectionReq.prompt} cards={gameState.players[selectionReq.playerIndex].hand} selectedIndex={selectedPeekIndex} onSelect={setSelectedPeekIndex} onCancel={cancellable ? cancelEffect : undefined} onConfirm={handlePeekSelection} emptyLabel="No cards in hand" confirmLabel={confirmLabel} filter={filter} />;
};

export const DiscardSelectionModal: React.FC<{
    selectionReq: CardSelectionRequest | null; gameState: GameState | null; selectedDiscardIndex: number | null;
    setSelectedDiscardIndex: (index: number | null) => void; handleDiscardSelection: (index: number) => void;
}> = ({ selectionReq, gameState, selectedDiscardIndex, setSelectedDiscardIndex, handleDiscardSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal searchLabel="Discard pile search" title={selectionReq.title ?? 'Select a card'} prompt={selectionReq.prompt} cards={gameState.players[selectionReq.playerIndex].discard} selectedIndex={selectedDiscardIndex} onSelect={setSelectedDiscardIndex} onConfirm={handleDiscardSelection} emptyLabel="No cards in discard pile" confirmLabel="Confirm selection" filter={selectionReq.filter} />;
};

export const DeckSelectionModal: React.FC<{
    selectionReq: CardSelectionRequest | null; gameState: GameState | null; selectedDeckIndex: number | null;
    setSelectedDeckIndex: (index: number | null) => void; handleDeckSelection: (index: number) => void;
}> = ({ selectionReq, gameState, selectedDeckIndex, setSelectedDeckIndex, handleDeckSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal searchLabel="Deck search" title={selectionReq.title ?? 'Select a card'} prompt={selectionReq.prompt} cards={gameState.players[selectionReq.playerIndex].deck} selectedIndex={selectedDeckIndex} onSelect={setSelectedDeckIndex} onConfirm={handleDeckSelection} emptyLabel="No cards in deck" confirmLabel="Confirm selection" filter={selectionReq.filter} />;
};
