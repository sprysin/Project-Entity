import BackToHubButton from '../common/BackToHubButton';
import { matchesCardCatalog } from '../../cards/CardRegistry';
import React, { useEffect, useState } from 'react';
import { CardDetail } from '../cards/CardDetail';
import { CardDefinition } from '../../cards/CardRegistry';
import { SavedDeck, newDeck, parseDeck, sortedCards, canAddCard, deckSize as total, MIN_DECK_SIZE } from '../../decks';
import { getSavedDecks, saveDeckLibrary } from '../../desktop/storage';
import { confirmAction, exportDeck, importDeck, showMessage } from '../../desktop/files';
import { setCloseReason } from '../../desktop/lifecycle';
import { CardType } from '../../types';
import './DeckCreator.css';
import { ActionCardIcon } from '../icons/ActionCardIcon';

const types = [CardType.PAWN, CardType.ACTION, CardType.CONDITION];
const icons = ['fa-chess-pawn', '', 'fa-hourglass-half'];
const TypeIcon = ({ type, icon, className = '' }: { type: CardType; icon: string; className?: string }) => type === CardType.ACTION
    ? <ActionCardIcon className={`h-[1.5em] w-[1.5em] ${className}`} />
    : <i className={`fa-solid ${icon} ${className}`} aria-hidden="true" />;
const face = (card: CardDefinition, compact = false) => <CardDetail card={{ ...card, instanceId: card.id, ownerId: '' }} compact={compact} />;

function IconButton({ label, icon, onClick, disabled = false, active = false, sound }: { label: string; icon: string; onClick: () => void; disabled?: boolean; active?: boolean; sound?: 'select-small' | 'toggle' | 'cancellation' }) {
    return <button data-sound={sound} type="button" className={`deck-icon-button${active ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={active || undefined} onClick={onClick} disabled={disabled}><i aria-hidden="true" className={`fa-solid ${icon}`} /></button>;
}

export default function DeckCreator({ onBack }: { onBack: () => void }) {
    const cards = sortedCards();
    const [library, setLibrary] = useState<SavedDeck[]>([]);
    const [deck, setDeck] = useState<SavedDeck | null>(null);
    const [selected, setSelected] = useState<CardDefinition | null>(cards[0] ?? null);
    const [search, setSearch] = useState('');
    const [dirty, setDirty] = useState(false);
    const [notice, setNotice] = useState('');
    const [libraryReadable, setLibraryReadable] = useState(true);
    const [deleteMode, setDeleteMode] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        try { setLibrary(getSavedDecks()); }
        catch { setLibraryReadable(false); setNotice('Local library unavailable. You can still save and open JSON files.'); }
    }, []);
    useEffect(() => {
        setCloseReason('deck', dirty ? 'Your deck has unsaved changes.' : null);
        return () => setCloseReason('deck', null);
    }, [dirty]);

    const open = (next: SavedDeck) => { setDeck(structuredClone(next)); setDirty(false); setNotice(''); setSearch(''); };
    const deleteDeck = async (item: SavedDeck) => {
        if (!await confirmAction(`Delete "${item.name}" from your decks? Exported JSON files will remain on your computer.`)) return;
        try {
            const remaining = library.filter(saved => saved.id !== item.id);
            await saveDeckLibrary(remaining);
            setLibrary(remaining);
            setDeleteMode(false);
            setNotice('Deck deleted');
        } catch { setNotice('Could not delete the deck. Please try again.'); }
    };
    const leave = async () => {
        if (dirty && !await confirmAction('Leave without saving your deck changes?')) return;
        setDeck(null); setDirty(false); setNotice('');
    };
    const changeQuantity = (card: CardDefinition, delta: number) => {
        if (!deck) return;
        if (delta > 0 && !canAddCard(deck, card.id)) return;
        const quantity = Math.max(0, (deck.cards.find(e => e.cardId === card.id)?.quantity ?? 0) + delta);
        setDeck({ ...deck, cards: [...deck.cards.filter(e => e.cardId !== card.id), ...(quantity ? [{ cardId: card.id, quantity }] : [])] });
        setSelected(card); setDirty(true); setNotice('');
    };
    const save = async () => {
        if (!deck) return;
        let saved: SavedDeck;
        try { saved = parseDeck({ ...deck, name: deck.name.trim() || 'Untitled deck' }); }
        catch (error) { await showMessage(error instanceof Error ? error.message : 'Please check your deck.'); return; }
        if (!libraryReadable) { setNotice('Local library unavailable. Export to JSON to keep a copy.'); return; }
        setBusy(true);
        try {
            const next = [...library.filter(item => item.id !== saved.id), saved];
            await saveDeckLibrary(next);
            setLibrary(next);
        }
        catch { setNotice('Could not save the deck locally. Export to JSON to keep a copy.'); return; }
        finally { setBusy(false); }
        setDeck(saved); setDirty(false);
        setNotice('Deck saved locally');
        if (total(saved) < MIN_DECK_SIZE) await showMessage(`Deck saved, but it is unplayable. A playable deck needs 40–60 cards. This deck has ${total(saved)}; add ${MIN_DECK_SIZE - total(saved)} more.`);
    };
    const exportJson = async () => {
        if (!deck) return;
        try {
            const exported = parseDeck({ ...deck, name: deck.name.trim() || 'Untitled deck' });
            if (await exportDeck(exported)) setNotice('Deck exported');
        } catch (error) { await showMessage(error instanceof Error ? error.message : 'Could not export your deck.'); }
    };
    const importFile = async () => {
        try {
            const imported = await importDeck();
            if (!imported) return;
            // A file opens as a separate deck so an import cannot replace local work.
            open(imported); setDirty(true);
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not open this file.'); }
    };
    const filtered = cards.filter(c => matchesCardCatalog(c, search));
    const quantity = (card: CardDefinition) => deck?.cards.find(e => e.cardId === card.id)?.quantity ?? 0;

    return <div className="deck-workspace retro-hash" inert={busy}>
        {busy && <div role="status" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', background: '#020617aa' }}>Saving deck…</div>}
        {!deck ? <main className="deck-library">
            <header className="deck-library-header">
                <div><span className="deck-eyebrow">PROJECT PAWN</span><h1>YOUR DECKS</h1></div>
                <BackToHubButton onClick={onBack} />
            </header>
            <div className="deck-library-actions">
                <button data-sound="select" className="deck-primary" onClick={() => { open(newDeck()); setDirty(true); }}><i className="fa-solid fa-plus" aria-hidden="true" /> New deck</button>
                <button data-sound="select-small" className="deck-secondary" onClick={importFile}><i className="fa-solid fa-folder-open" aria-hidden="true" /> Open JSON</button>
                <IconButton sound={deleteMode ? 'cancellation' : undefined} label={deleteMode ? 'Cancel deleting' : 'Delete a deck'} icon={deleteMode ? 'fa-xmark' : 'fa-trash-can'} active={deleteMode} disabled={!library.length} onClick={() => { setDeleteMode(value => !value); setNotice(deleteMode ? '' : 'Select a deck to delete'); }} />
            </div>
            <div className="deck-library-grid">
                {library.map(item => <div key={item.id} className={`deck-library-tile${deleteMode ? ' is-delete-mode' : ''}`}>
                    <button data-sound={deleteMode ? undefined : 'select-small'} className="deck-library-open" aria-label={`${deleteMode ? 'Delete' : 'Open'} ${item.name}`} onClick={() => deleteMode ? deleteDeck(item) : open(item)}>
                    <div className="deck-library-art">{item.cards.length ? item.cards.slice(0, 3).map((entry, i) => <div key={entry.cardId} style={{ transform: `translateX(${(i - 1) * 45}px) rotate(${(i - 1) * 9}deg)` }}>{face(cards.find(c => c.id === entry.cardId)!, true)}</div>) : <i className="fa-solid fa-layer-group" aria-hidden="true" />}</div>
                    <div className="deck-tile-caption"><strong>{item.name}</strong><span>{total(item)} cards <i className={`fa-solid ${deleteMode ? 'fa-trash-can' : 'fa-arrow-right'}`} aria-hidden="true" /></span></div>
                    </button>
                </div>)}
                {!library.length && <button data-sound="select" className="deck-empty-library" onClick={() => { open(newDeck()); setDirty(true); }}><i className="fa-solid fa-layer-group" aria-hidden="true" /><span>Build your first deck</span><i className="fa-solid fa-plus" aria-hidden="true" /></button>}
            </div>
        </main> : <div className="deck-editor">
            <aside className="deck-preview" aria-label="Card viewer">
                <div className="deck-preview-nav"><IconButton sound="cancellation" label="Back to decks" icon="fa-arrow-left" onClick={leave} /><i className="fa-solid fa-chess-pawn text-yellow-500" aria-hidden="true" /></div>
                {selected && <div className="deck-preview-face">{face(selected)}</div>}
                {selected && <div className="deck-preview-controls"><IconButton sound="toggle" label={`Remove ${selected.name}`} icon="fa-minus" onClick={() => changeQuantity(selected, -1)} disabled={!quantity(selected)} /><IconButton sound="toggle" label={`Add ${selected.name}`} icon="fa-plus" onClick={() => changeQuantity(selected, 1)} disabled={!canAddCard(deck, selected.id)} /></div>}
            </aside>
            <main className="deck-center" aria-label="Deck contents">
                <header className="deck-center-header">
                    <input aria-label="Deck name" maxLength={80} value={deck.name} onChange={e => { setDeck({ ...deck, name: e.target.value }); setDirty(true); setNotice(''); }} placeholder="Deck name" />
                    <span className="deck-unsaved" title={dirty ? 'Unsaved changes' : 'Saved'} aria-label={dirty ? 'Unsaved changes' : 'Saved'}>{dirty ? '●' : ''}</span>
                    <button data-sound="select" className="deck-primary" onClick={save} title="Save deck locally"><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save</button>
                    <IconButton sound="select-small" label="Export deck to JSON" icon="fa-file-export" onClick={exportJson} />
                </header>
                <div className="deck-counts"><span>{total(deck)} <span className="text-slate-500">cards</span></span>{types.map((type, i) => <span key={type} title={type} aria-label={`${type} count`}><TypeIcon type={type} icon={icons[i]} className={`deck-type-${type}`} /> {deck.cards.filter(e => cards.find(c => c.id === e.cardId)?.type === type).reduce((sum, e) => sum + e.quantity, 0)}</span>)}</div>
                <div className="deck-content-scroll">
                    {!deck.cards.length && <div className="deck-empty-center"><i className="fa-solid fa-layer-group" aria-hidden="true" /><span>Add cards with +</span></div>}
                    <div className="deck-owned-grid">{cards.flatMap(card => Array.from({ length: quantity(card) }, (_, copy) =>
                        <div key={`${card.id}-${copy}`} className="deck-owned-card">
                            <button data-sound="select-small" className={`deck-card-select ${selected?.id === card.id ? 'is-selected' : ''}`} aria-label={`View ${card.name}, copy ${copy + 1}`} onClick={() => setSelected(card)}>{face(card, true)}</button>
                            <div className="deck-quantity"><IconButton sound="toggle" label={`Remove ${card.name}, copy ${copy + 1}`} icon="fa-minus" onClick={() => changeQuantity(card, -1)} /></div>
                        </div>
                    ))}</div>
                </div>
            </main>
            <aside className="deck-catalog" aria-label="All cards">
                <label className="deck-search"><i className="fa-solid fa-search" aria-hidden="true" /><input aria-label="Search cards" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></label>
                <div className="deck-catalog-scroll">
                    {!filtered.length && <p className="deck-no-results">No cards found</p>}
                    {types.map((type, i) => {
                        const entries = filtered.filter(c => c.type === type);
                        return entries.length > 0 && <section key={type} aria-label={type} className={`deck-card-section deck-type-${type}`}>
                            <div className="deck-section-rule"><TypeIcon type={type} icon={icons[i]} /><span /></div>
                            <div className="deck-catalog-grid">{entries.map(card => <div className="deck-catalog-card" key={card.id}>
                                <button data-sound="select-small" className={`deck-card-select ${selected?.id === card.id ? 'is-selected' : ''}`} aria-label={`View ${card.name}`} onClick={() => setSelected(card)}>{face(card, true)}</button>
                                <div className="deck-catalog-add"><span /><IconButton sound="toggle" label={`Add ${card.name}`} icon="fa-plus" onClick={() => changeQuantity(card, 1)} disabled={!canAddCard(deck, card.id)} /></div>
                            </div>)}</div>
                        </section>;
                    })}
                </div>
            </aside>
        </div>}
        {notice && <div className="deck-notice" role="status">{notice}<IconButton sound="cancellation" label="Dismiss notification" icon="fa-xmark" onClick={() => setNotice('')} /></div>}
    </div>;
}
