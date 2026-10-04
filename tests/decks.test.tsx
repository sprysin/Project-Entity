import { CardRegistry } from '../src/cards/CardRegistry';
import React from 'react';
import { act, create } from 'react-test-renderer';
import CatalogPagination, { useCatalogPage } from '../src/components/catalog/CatalogPagination';
import CatalogFilters, { useCatalogFilters } from '../src/components/catalog/CatalogFilters';
import DeckCreator from '../src/components/decks/DeckCreator';
import { expect, it } from 'vitest';
import { newDeck, parseDeck, sortedCards, canAddCard, isDeckPlayable } from '../src/decks';
import { CARD_RARITIES, CARD_RARITY_TIERS } from '../src/types';

it('validates a 1000-card catalog, paginates full search results, and preserves deck copy limits', () => {
    expect(sortedCards().every(card => card.pawnSubtype !== 'Token')).toBe(true);
    expect(sortedCards().every(card => CARD_RARITIES.includes(card.rarity))).toBe(true);
    expect(CARD_RARITY_TIERS.Legendary).toBe(CARD_RARITY_TIERS.Mythic);
    expect(CARD_RARITY_TIERS.Legendary).toBe(CARD_RARITY_TIERS.Relic);
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
    let filters: ReturnType<typeof useCatalogFilters>;
    function FilterControls() {
        filters = useCatalogFilters();
        return <CatalogFilters {...filters} />;
    }
    act(() => { root = create(<FilterControls />); });
    const pawn = sortedCards().find(card => card.pawnType && card.attribute)!;
    const otherLevel = String(pawn.level % 10 + 1);
    act(() => filters.toggle('level', String(pawn.level)));
    act(() => filters.toggle('level', otherLevel));
    act(() => filters.toggle('pawnType', pawn.pawnType!));
    act(() => filters.toggle('attribute', pawn.attribute!));
    expect(filters.active).toBe(false);
    expect(filters.matches({ ...pawn, attribute: undefined })).toBe(true);
    act(() => filters.apply());
    expect(filters.matches(pawn)).toBe(true);
    expect(filters.matches({ ...pawn, level: Number(otherLevel) as typeof pawn.level })).toBe(true);
    expect(filters.matches({ ...pawn, attribute: undefined })).toBe(false);
    expect(filters.matches({ ...pawn, type: 'ACTION' as typeof pawn.type })).toBe(false);
    const openFilters = () => root.root.findAllByType('button').find(button => button.props['aria-haspopup'] === 'dialog')!;
    act(() => openFilters().props.onClick());
    expect(root.root.findAllByProps({ 'aria-label': 'Level 0' })).toHaveLength(0);
    expect(root.root.findByProps({ 'aria-label': 'Level filters' }).findAllByType('button')).toHaveLength(10);
    expect(root.root.findAllByProps({ role: 'group' }).map(group => group.props['aria-label'])).toEqual(['Level filters', 'Attribute filters', 'Type filters']);
    expect(root.root.findAllByType('button').some(button => button.props.children === 'Cancel')).toBe(false);
    const option = root.root.findByProps({ 'aria-label': `Type ${pawn.pawnType}` });
    expect(option.props['aria-pressed']).toBe(true);
    act(() => option.props.onClick());
    expect(filters.filters.pawnType).toEqual([]);
    expect(root.root.findByType('dialog')).toBeTruthy();
    act(() => root.root.findByProps({ 'aria-label': `Type ${pawn.pawnType}` }).props.onClick());
    expect(root.root.findByProps({ 'aria-label': `Type ${pawn.pawnType}` }).props['aria-pressed']).toBe(true);
    act(() => filters.clear());
    expect(filters.active).toBe(true);
    act(() => root.root.findByProps({ 'aria-label': 'Close filters' }).props.onClick());
    act(() => openFilters().props.onClick());
    expect(filters.filters.pawnType).toEqual([pawn.pawnType]);
    act(() => filters.clear());
    act(() => root.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    expect(filters.active).toBe(false);
    expect(root.root.findAllByType('dialog')).toHaveLength(0);
    expect(sortedCards().every(filters.matches)).toBe(true);
    act(() => root.unmount());
    act(() => { root = create(<DeckCreator onBack={() => {}} />); });
    act(() => root.root.findAllByType('button').find(button => button.props.children?.[1] === ' New deck')!.props.onClick());
    const catalog = root.root.findByProps({ 'aria-label': 'All cards' });
    const cardButton = () => catalog.findAllByType('button').find(button => button.props['aria-label'] === `View ${definition.name}`)!;
    act(() => cardButton().props.onClick());
    expect(root.root.findByProps({ 'aria-label': 'Deck contents' }).findAllByProps({ className: 'deck-owned-card' })).toHaveLength(0);
    for (let copy = 0; copy < 4; copy++) act(() => cardButton().props.onDoubleClick());
    expect(root.root.findByProps({ 'aria-label': `Add ${definition.name}` }).props.disabled).toBe(true);
    expect(root.root.findByProps({ 'aria-label': 'Deck contents' }).findAllByType('button').filter(button => button.props.title === 'Right click to remove')).toHaveLength(3);
    act(() => root.unmount());
    for (const invalid of [{ level: 11 }, { atk: NaN }, { isAttached: true, isLingering: true }, { name: '' }, { rarity: 'Unknown' }]) {
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
