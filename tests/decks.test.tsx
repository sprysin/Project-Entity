import { CardRegistry } from '../src/cards/CardRegistry';
import { LEGACY_CARD_IDS } from '../src/cards/legacyIds';
import { act, create } from 'react-test-renderer';
import CatalogPagination, { useCatalogPage } from '../src/components/catalog/CatalogPagination';
import { expect, it } from 'vitest';
import { newDeck, parseDeck, sortedCards, canAddCard, isDeckPlayable, createRuntimeDeck, createRuntimeReserve, reserveSize } from '../src/decks';
import { isReservePawn } from '../src/game/cardHelpers';
import { cardRegistry } from '../src/cards/CardRegistry';

it('paginates a large catalog and validates deck copy limits and legacy IDs', () => {
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
    for (const [oldId, id] of Object.entries(LEGACY_CARD_IDS)) {
        const card = cardRegistry.getCard(id)!;
        expect(card).toBeDefined();
        if (card.pawnSubtype === 'Token') continue;
        const location = isReservePawn(card) ? 'reserve' : 'cards';
        const saved = { ...newDeck(), [location]: [{ cardId: oldId, quantity: 1 }] };
        expect(parseDeck(saved)[location]).toEqual([{ cardId: id, quantity: 1 }]);
        expect(saved[location][0].cardId).toBe(oldId);
        expect(() => parseDeck({ ...saved, [location]: [...saved[location], { cardId: id, quantity: 1 }] })).toThrow('unknown cards or invalid quantities');
        expect(() => parseDeck({ ...saved, [location]: [{ cardId: id.toLowerCase(), quantity: 1 }] })).toThrow('unknown cards');
    }
});

it('enforces main and Reserve deck limits and rejects malformed imports', () => {
    const mainCards = sortedCards().filter(card => !isReservePawn(card));
    const atSize = (size: number) => ({ ...newDeck(), cards: Array.from({ length: Math.ceil(size / 3) }, (_, i) => ({ cardId: mainCards[i].id, quantity: Math.min(3, size - i * 3) })) });
    expect(isDeckPlayable(atSize(39))).toBe(false);
    expect(isDeckPlayable(atSize(40))).toBe(true);
    expect(isDeckPlayable(atSize(60))).toBe(true);
    expect(isDeckPlayable(atSize(61))).toBe(false);
    const another = mainCards.at(-1)!.id;
    expect(canAddCard(atSize(59), another)).toBe(true);
    expect(canAddCard(atSize(60), another)).toBe(false);
    expect(canAddCard(atSize(61), another)).toBe(false);
    const vassal = cardRegistry.getCard('P_Patron_Of_Judgement')!;
    const withReserve = { ...atSize(40), reserve: [{ cardId: vassal.id, quantity: 3 }] };
    expect(isDeckPlayable(withReserve)).toBe(true);
    expect(reserveSize(withReserve)).toBe(3);
    expect(createRuntimeDeck(withReserve, 'p0').some(isReservePawn)).toBe(false);
    expect(createRuntimeReserve(withReserve, 'p0')).toHaveLength(3);
    expect(createRuntimeReserve(withReserve, 'p0').every(card => card.ownerId === 'p0')).toBe(true);
    expect(parseDeck(withReserve).reserve).toEqual(withReserve.reserve);
    expect(() => parseDeck({ ...atSize(40), cards: [...atSize(40).cards, { cardId: vassal.id, quantity: 1 }] })).toThrow('Reserve');
    expect(() => parseDeck({ ...atSize(40), reserve: [{ cardId: another, quantity: 1 }] })).toThrow('Reserve');
    const reserveIds = Array.from({ length: 4 }, (_, i) => `test-reserve-limit-${i}`);
    reserveIds.forEach(id => cardRegistry.register({ ...vassal, id }, cardRegistry.getEffect(vassal.id)!));
    const fullReserve = { ...atSize(40), reserve: reserveIds.map((cardId, i) => ({ cardId, quantity: i === 3 ? 1 : 3 })) };
    expect(isDeckPlayable(fullReserve)).toBe(true);
    expect(canAddCard(fullReserve, vassal.id)).toBe(false);
    expect(() => parseDeck({ ...fullReserve, reserve: [...fullReserve.reserve, { cardId: vassal.id, quantity: 1 }] })).toThrow('10 cards');
    expect(parseDeck(newDeck()).cards).toEqual([]);
    const entry = { cardId: sortedCards()[0].id, quantity: 1 };
    for (const cards of [[{ ...entry, cardId: 'missing' }], [{ ...entry, quantity: -1 }], [{ ...entry, quantity: 1.5 }], [entry, entry], [null]]) {
        expect(() => parseDeck({ ...newDeck(), cards })).toThrow();
    }
    expect(() => parseDeck({ ...newDeck(), version: 2 })).toThrow();
    expect(() => parseDeck(null)).toThrow();
});
