import { CardRegistry } from '../src/cards/CardRegistry';
import React from 'react';
import { act, create } from 'react-test-renderer';
import CatalogPagination, { useCatalogPage } from '../src/components/catalog/CatalogPagination';
import { expect, it } from 'vitest';
import { newDeck, parseDeck, sortedCards, canAddCard, isDeckPlayable } from '../src/decks';

it('validates a 1000-card catalog, paginates full search results, and preserves deck copy limits', () => {
    expect(sortedCards().every(card => card.pawnSubtype !== 'Token')).toBe(true);
    const registry = new CardRegistry();
    const definition = sortedCards()[0];
    for (let i = 0; i < 1000; i++) registry.register({ ...definition, id: `scale-${i}` }, {});
    expect(registry.getAllCards()).toHaveLength(1000);
    expect(registry.getCard('scale-999')?.name).toBe(definition.name);
    expect(Object.isFrozen(registry.getCard('scale-999'))).toBe(true);
    expect(() => registry.register({ ...definition, id: 'scale-999' }, {})).toThrow('Duplicate');
    expect(registry.size).toBe(1000);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let page: ReturnType<typeof useCatalogPage>;
    function Catalog({ query }: { query: string }) {
        page = useCatalogPage(registry.getAllCards().filter(card => card.id.includes(query)), query);
        return <CatalogPagination {...page} />;
    }
    let root: ReturnType<typeof create>;
    act(() => { root = create(<Catalog query="" />); });
    expect(page.entries).toHaveLength(60);
    expect(page.pages).toBe(17);
    act(() => page.onPage(16));
    expect(page.entries).toHaveLength(40);
    act(() => { root.update(<Catalog query="scale-999" />); });
    expect(page.page).toBe(0);
    expect(page.entries).toHaveLength(1);
    expect(root.toJSON()).toBeNull();
    act(() => { root.update(<Catalog query="missing" />); });
    expect(page.entries).toEqual([]);
    act(() => root.unmount());
    for (const invalid of [{ level: 11 }, { atk: NaN }, { isAttached: true, isLingering: true }, { name: '' }]) {
        expect(() => registry.register({ ...definition, ...invalid, id: 'invalid' } as typeof definition, {})).toThrow('Invalid');
    }
    expect(registry.size).toBe(1000);
    const cardId = sortedCards()[0].id;
    const deck = { ...newDeck(), cards: [{ cardId, quantity: 3 }] };
    expect(canAddCard(deck, cardId)).toBe(false);
    expect(canAddCard({ ...deck, cards: [{ cardId, quantity: 2 }] }, cardId)).toBe(true);
    const legacy = { ...deck, cards: [{ cardId, quantity: 4 }] };
    expect(() => parseDeck(legacy)).toThrow('Only 3 copies');
    expect(parseDeck(legacy, false)).toEqual(legacy);
});

it('enforces deck size boundaries and rejects malformed imports', () => {
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
    const entry = { cardId: sortedCards()[0].id, quantity: 1 };
    for (const cards of [[{ ...entry, cardId: 'missing' }], [{ ...entry, quantity: -1 }], [{ ...entry, quantity: 1.5 }], [entry, entry], [null]]) {
        expect(() => parseDeck({ ...newDeck(), cards })).toThrow();
    }
    expect(() => parseDeck({ ...newDeck(), version: 2 })).toThrow();
    expect(() => parseDeck(null)).toThrow();
});
