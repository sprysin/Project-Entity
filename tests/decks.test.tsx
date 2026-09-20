import { expect, it } from 'vitest';
import { DECK_STORAGE_KEY, loadDecks, newDeck, parseDeck, sortedCards, storeDeck, canAddCard, isDeckPlayable } from '../src/decks';

it('round-trips a named deck through JSON and local storage, updating only that deck', () => {
    let value: string | null = null;
    const storage = { getItem: () => value, setItem: (key: string, text: string) => { expect(key).toBe(DECK_STORAGE_KEY); value = text; } };
    const first = { ...newDeck(), name: 'My beasts', cards: [{ cardId: sortedCards()[0].id, quantity: 3 }] };
    const other = { ...newDeck(), name: 'Another deck' };
    let library = storeDeck(storage, [], first);
    library = storeDeck(storage, library, other);
    storeDeck(storage, library, { ...first, name: 'Renamed', cards: [{ ...first.cards[0], quantity: 2 }] });
    const loaded = loadDecks(storage);
    expect(loaded).toHaveLength(2);
    expect(loaded.find(d => d.id === other.id)).toEqual(other);
    expect(loaded.find(d => d.id === first.id)).toMatchObject({ name: 'Renamed', cards: [{ cardId: first.cards[0].cardId, quantity: 2 }] });
    expect(parseDeck(JSON.parse(JSON.stringify(first)))).toEqual(first);
});

it('caps copies at three and rejects imported fourth copies while keeping legacy decks editable', () => {
    const cardId = sortedCards()[0].id;
    const deck = { ...newDeck(), cards: [{ cardId, quantity: 3 }] };
    expect(canAddCard(deck, cardId)).toBe(false);
    expect(canAddCard({ ...deck, cards: [{ cardId, quantity: 2 }] }, cardId)).toBe(true);
    const legacy = { ...deck, cards: [{ cardId, quantity: 4 }] };
    expect(() => parseDeck(legacy)).toThrow('Only 3 copies');
    expect(loadDecks({ getItem: () => JSON.stringify([legacy]) })).toEqual([legacy]);
});

it('allows 40–60 cards and blocks additions at 60, even for a card not yet included', () => {
    // Synthetic IDs exercise the size boundary independently of the current small card pool.
    const atSize = (size: number) => ({ ...newDeck(), cards: Array.from({ length: size }, (_, i) => ({ cardId: `card-${i}`, quantity: 1 })) });
    expect(isDeckPlayable(atSize(39))).toBe(false);
    expect(isDeckPlayable(atSize(40))).toBe(true);
    expect(isDeckPlayable(atSize(60))).toBe(true);
    expect(isDeckPlayable(atSize(61))).toBe(false);
    expect(canAddCard(atSize(59), 'another')).toBe(true);
    expect(canAddCard(atSize(60), 'another')).toBe(false);
    expect(canAddCard(atSize(61), 'another')).toBe(false);
    expect(parseDeck(newDeck()).cards).toEqual([]);
});

it('rejects malformed imports and does not overwrite unreadable saved data', () => {
    const entry = { cardId: sortedCards()[0].id, quantity: 1 };
    for (const cards of [[{ ...entry, cardId: 'missing' }], [{ ...entry, quantity: -1 }], [{ ...entry, quantity: 1.5 }], [entry, entry], [null]]) {
        expect(() => parseDeck({ ...newDeck(), cards })).toThrow();
    }
    expect(() => parseDeck({ ...newDeck(), version: 2 })).toThrow();
    expect(() => parseDeck(null)).toThrow();
    expect(() => loadDecks({ getItem: () => '{broken' })).toThrow();
    expect(loadDecks({ getItem: () => null })).toEqual([]);
});
