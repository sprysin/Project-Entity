import React, { useEffect, useState } from 'react';
import { Card, CardSelectionRequest, GameState, HandSelectionRequest, LevelTributeSelectionRequest, PeekSelectionRequest, Position, ShuffleSelectionRequest } from '../../types';
import { multiSelectionCards } from '../../cards/engine/Selections';
import { fieldEntries } from '../../game/field';
import { CardDetail } from '../cards/CardDetail';
import { DuelPrompt } from './DuelPrompt';
import { levelTributeCandidates } from '../../game/levelTributes';
import { mergeMaterialSets } from '../../game/mergeSummons';
import { LevelDiamonds } from './LevelDiamonds';

export const MergeMaterialSelectionModal: React.FC<{
    card: Card; gameState: GameState; onConfirm: (ids: string[]) => void; onCancel: () => void;
}> = ({ card, gameState, onConfirm, onCancel }) => {
    const [selected, setSelected] = useState<number[]>([]);
    const player = gameState.players[gameState.activePlayerIndex];
    const sets = mergeMaterialSets(player, card);
    const choices = player.pawnZones.flatMap(zone => zone && zone.position !== Position.HIDDEN ? [zone.card] : []);
    const ids = selected.map(index => choices[index].instanceId);
    return <CardSelectionModal title="Merge materials" prompt={`Send ${card.mergeMaterials?.map(name => `"${name}"`).join(' + ')} from your face-up Pawns to the Discard.`}
        cards={choices} selectedIndex={null} selectedIndices={selected} requiredCount={card.mergeMaterials?.length}
        filter={card => ids.includes(card.instanceId) || sets.some(set => set.includes(card.instanceId) && ids.every(id => set.includes(id)))}
        confirmDisabled={!sets.some(set => set.length === ids.length && set.every(id => ids.includes(id)))}
        onSelect={index => { if (index !== null) setSelected(previous => previous.includes(index) ? previous.filter(value => value !== index) : [...previous, index]); }}
        onConfirmMulti={indices => onConfirm(indices.map(index => choices[index].instanceId))} onCancel={onCancel}
        emptyLabel="No eligible materials" confirmLabel={`Confirm materials (${selected.length}/${card.mergeMaterials?.length ?? 0})`} searchLabel="Merge materials" />;
};

export const LevelTributeSelectionModal: React.FC<{
    request: LevelTributeSelectionRequest | null; gameState: GameState; onConfirm: (ids: string[]) => void;
}> = ({ request, gameState, onConfirm }) => {
    const [selected, setSelected] = useState<number[]>([]);
    useEffect(() => setSelected([]), [request]);
    if (!request) return null;
    const choices = levelTributeCandidates(gameState, request.playerIndex, request);
    const level = selected.reduce((sum, index) => sum + choices[index].card.level, 0);
    const valid = level === request.totalLevel && (gameState.players[request.playerIndex].pawnZones.includes(null)
        || selected.some(index => choices[index].location === 'field'));
    return <CardSelectionModal title={`${request.sendOnly ? 'Send' : 'Tribute'} Pawns · Levels ${level}/${request.totalLevel}`}
        abovePanel={<LevelDiamonds required={request.totalLevel} selected={level} />}
        prompt={`Choose Pawns from your ${request.location ?? 'hand or field'} whose levels total exactly ${request.totalLevel}.`}
        cards={choices.map(entry => entry.card)} cardLabels={choices.map(entry => entry.location === 'hand' ? 'Hand' : 'Field')}
        selectedIndex={null} selectedIndices={selected} requiredCount={selected.length} confirmDisabled={!valid}
        onSelect={index => {
            if (index !== null) setSelected(previous => previous.includes(index) ? previous.filter(value => value !== index)
                : [...previous, index]);
        }}
        onConfirmMulti={indices => onConfirm(indices.map(index => choices[index].card.instanceId))}
        emptyLabel="No eligible Pawns" confirmLabel="Confirm materials" searchLabel="Contract materials" />;
};

export const ReserveSelectionModal: React.FC<{
    request: CardSelectionRequest | null; gameState: GameState; onConfirm: (index: number) => void;
}> = ({ request, gameState, onConfirm }) => {
    const [selected, setSelected] = useState<number | null>(null);
    useEffect(() => setSelected(null), [request]);
    if (!request) return null;
    return <CardSelectionModal title={request.title ?? 'Reserve summon'} prompt={request.prompt}
        cards={gameState.players[request.playerIndex].reserve} filter={request.filter}
        selectedIndex={selected} onSelect={setSelected} onConfirm={onConfirm}
        emptyLabel="Your Reserve is empty" confirmLabel="Choose Pawn" searchLabel="Reserve selection" />;
};

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
    const choices = multiSelectionCards(gameState, request);
    const hiddenCardIds = request.location === 'field' ? fieldEntries(gameState)
        .filter(({ zone, target }) => zone.position === Position.HIDDEN && target.playerIndex !== request.playerIndex)
        .map(({ zone }) => zone.card.instanceId) : [];
    return <CardSelectionModal
        title={`${request.fieldScope === undefined ? `Shuffle from ${request.location}` : 'Select cards on the field'} (${selected.length}/${request.upTo ? 'up to ' : ''}${request.count})`}
        cards={choices}
        hiddenCardIds={hiddenCardIds}
        cardLabels={request.fieldScope === undefined ? undefined : choices.map(card => {
            const entry = fieldEntries(gameState).find(({ zone }) => zone.card.instanceId === card.instanceId)!;
            return `${gameState.players[entry.target.playerIndex].name}: ${entry.target.type} ${entry.target.index + 1}`;
        })}
        selectedIndex={null}
        selectedIndices={selected}
        requiredCount={request.count}
        confirmDisabled={request.upTo ? selected.length > request.count : selected.length !== request.count}
        onSelect={index => {
            if (index === null) return;
            setSelected(current => current.includes(index) ? current.filter(value => value !== index)
                : current.length < request.count ? [...current, index] : current);
        }}
        onConfirmMulti={indices => onConfirm(indices.map(index => choices[index].instanceId))}
        emptyLabel={`No cards in ${request.location}`}
        confirmLabel={request.fieldScope === undefined ? 'Confirm shuffle' : 'Confirm selection'}
        searchLabel={`${request.location} selection`}
    />;
};

interface CardSelectionModalProps {
    title: string;
    abovePanel?: React.ReactNode;
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
    confirmDisabled?: boolean;
    cardLabels?: string[];
    hiddenCardIds?: readonly string[];
}

export const CardSelectionModal: React.FC<CardSelectionModalProps> = ({
    title, abovePanel, prompt, cards, selectedIndex, onSelect, onCancel, onConfirm,
    emptyLabel, confirmLabel, filter,
    selectedIndices, requiredCount, onConfirmMulti, searchLabel = 'Card selection', confirmDisabled: forcedDisabled, cardLabels, hiddenCardIds
}) => {
    const [peeking, setPeeking] = useState(false);
    const choices = cards
        .map((card, index) => ({ card, index, valid: filter?.(card) ?? true }))
        .sort((a, b) => Number(b.valid) - Number(a.valid));
    const isSelected = (index: number) => selectedIndex === index || selectedIndices?.includes(index) === true;
    const confirmDisabled = forcedDisabled ?? (onConfirmMulti ? selectedIndices?.length !== requiredCount : selectedIndex === null);
    return <DuelPrompt className="duel-prompt--card-search" ariaLabel={searchLabel} title={<strong>{title}</strong>}
        abovePanel={abovePanel}
        peeking={peeking} setPeeking={setPeeking} actions={[
            ...(onCancel ? [{ label: 'Cancel', onClick: onCancel, variant: 'secondary' as const }] : []),
            {
                label: confirmLabel, variant: 'primary', disabled: confirmDisabled, onClick: () => onConfirmMulti
                    ? selectedIndices && onConfirmMulti(selectedIndices)
                    : selectedIndex !== null && onConfirm?.(selectedIndex)
            },
        ]}>
        {prompt && <div className="card-search__summary"><p>{prompt}</p></div>}
        <div className="card-search__grid">
            {choices.map(({ card, index, valid }) => <button key={card.instanceId} type="button" data-sound="select-small"
                aria-label={hiddenCardIds?.includes(card.instanceId) ? 'Hidden card' : card.name} aria-pressed={isSelected(index)} disabled={!valid} onClick={() => onSelect(index)}
                className={`duel-card-choice ${isSelected(index) ? 'is-selected' : ''}`}>
                <CardDetail card={card} isSet={hiddenCardIds?.includes(card.instanceId)} className="w-full h-full" />
                {cardLabels?.[index] && <span className="card-search__location">{cardLabels[index]}</span>}
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
    handleHandSelection: (index: number) => void;
}

export const HandSelectionModal: React.FC<HandSelectionModalProps> = ({ selectionReq, gameState, selectedHandSelectionIndex, setSelectedHandSelectionIndex, handleHandSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal searchLabel="Hand selection" title={selectionReq.title ?? 'Select a card'} prompt={selectionReq.prompt} cards={selectionReq.cards ?? gameState.players[selectionReq.playerIndex].hand} selectedIndex={selectedHandSelectionIndex} onSelect={setSelectedHandSelectionIndex} onConfirm={handleHandSelection} emptyLabel="No cards in hand" confirmLabel={selectionReq.purpose === 'summon' ? 'Choose Pawn' : 'Confirm discard'} filter={selectionReq.filter} />;
};

export const PeekSelectionModal: React.FC<{
    selectionReq: PeekSelectionRequest | null; gameState: GameState | null; selectedPeekIndex: number | null;
    setSelectedPeekIndex: (index: number | null) => void; cancelEffect?: () => void; handlePeekSelection: (index: number) => void;
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
    return <CardSelectionModal searchLabel="Discard pile search" title={selectionReq.title ?? 'Select a card'} prompt={selectionReq.prompt} cards={selectionReq.cards ?? gameState.players[selectionReq.playerIndex].discard} selectedIndex={selectedDiscardIndex} onSelect={setSelectedDiscardIndex} onConfirm={handleDiscardSelection} emptyLabel="No cards in discard pile" confirmLabel="Confirm selection" filter={selectionReq.filter} />;
};

export const DeckSelectionModal: React.FC<{
    selectionReq: CardSelectionRequest | null; gameState: GameState | null; selectedDeckIndex: number | null;
    setSelectedDeckIndex: (index: number | null) => void; handleDeckSelection: (index: number) => void;
}> = ({ selectionReq, gameState, selectedDeckIndex, setSelectedDeckIndex, handleDeckSelection }) => {
    if (!selectionReq || !gameState) return null;
    return <CardSelectionModal searchLabel="Deck search" title={selectionReq.title ?? 'Select a card'} prompt={selectionReq.prompt} cards={gameState.players[selectionReq.playerIndex].deck} selectedIndex={selectedDeckIndex} onSelect={setSelectedDeckIndex} onConfirm={handleDeckSelection} emptyLabel="No cards in deck" confirmLabel="Confirm selection" filter={selectionReq.filter} />;
};
