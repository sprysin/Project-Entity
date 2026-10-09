import { CardRegistry } from '../src/cards/CardRegistry';
import React from 'react';
import { act, create } from 'react-test-renderer';
import CatalogPagination, { useCatalogPage } from '../src/components/catalog/CatalogPagination';
import CatalogFilters, { useCatalogFilters } from '../src/components/catalog/CatalogFilters';
import DeckCreator from '../src/components/decks/DeckCreator';
import PlaytestSetup from '../src/components/decks/PlaytestSetup';
import RulesView from '../src/components/rules/RulesView';
import Shop from '../src/components/shop/Shop';
import { CardDetail } from '../src/components/cards/CardDetail';
import * as storage from '../src/desktop/storage';
import { expect, it, vi } from 'vitest';
import { newDeck, parseDeck, sortedCards, canAddCard, isDeckPlayable, createRuntimeDeck, createRuntimeReserve, reserveSize } from '../src/decks';
import { isReservePawn } from '../src/game/cardHelpers';
import { cardRegistry } from '../src/cards/CardRegistry';
import { CardType, CARD_RARITIES, CARD_RARITY_TIERS } from '../src/types';
import { PACKS, DEBUG_PACK } from '../src/shop/packs';
import { rarityColor, packCards, packTiers, openPack, advanceRotation, ROTATION_MS } from '../src/shop/PackLogic';

it('validates a 1000-card catalog, paginates full search results, and preserves deck copy limits', () => {
    // Pack pools stay in sync with the catalog while remaining individually editable.
    expect([...PACKS[0].cardIds].sort()).toEqual(sortedCards().map(card => card.id).sort());
    for (const pack of PACKS) {
        const cards = packCards(pack);
        expect(new Set(pack.cardIds).size).toBe(cards.length);
        expect(pack.chaseCardIds).toHaveLength(3);
        expect(new Set(pack.chaseCardIds).size).toBe(3);
        expect(pack.chaseCardIds.every(id => cards.some(card => card.id === id))).toBe(true);
        expect(cards.every(card => card.pawnSubtype !== 'Token')).toBe(true);
        const tiers = packTiers(pack);
        const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
        for (let i = 1; i < tiers.length; i++) {
            expect(tiers[i].weight / tiers[i].cards.length).toBeLessThan(tiers[i - 1].weight / tiers[i - 1].cards.length);
        }
        let boundary = 0;
        for (const tier of tiers) {
            const random = vi.fn().mockReturnValueOnce((boundary + tier.weight / 2) / total).mockReturnValue(0);
            expect(CARD_RARITY_TIERS[openPack(pack, random)[0].rarity]).toBe(tier.tier);
            boundary += tier.weight;
        }
        expect(openPack(pack, () => 0)).toHaveLength(5);
        expect(openPack(pack, () => .999999).every(card => pack.cardIds.includes(card.id))).toBe(true);
    }
    const debugCards = packCards(DEBUG_PACK);
    expect(debugCards.map(card => card.rarity)).toEqual([...CARD_RARITIES]);
    expect(packCards(DEBUG_PACK)).toEqual(debugCards);
    expect(PACKS).not.toContain(DEBUG_PACK);
    expect(CARD_RARITIES.map(rarityColor)).toEqual([
        '#b8c3d4', '#88dca2', '#77bbff', '#c28bff', '#edc56f', '#30F0DD', '#D35400',
    ]);
    const initial = advanceRotation(null, 1000);
    expect(initial.packIds).toEqual(['master', 'fire', 'grave']);
    expect(advanceRotation(initial, initial.expiresAt - 1)).toBe(initial);
    expect(advanceRotation(initial, initial.expiresAt, () => .7499).packIds).toEqual(['master', 'fire', 'fire']);
    expect(advanceRotation(initial, initial.expiresAt, () => .75).packIds).toEqual(['master', 'grave', 'grave']);
    expect(advanceRotation(initial, initial.expiresAt + 1000000).expiresAt).toBe(initial.expiresAt + 1000000 + ROTATION_MS);
    expect(sortedCards().every(card => card.pawnSubtype !== 'Token')).toBe(true);
    expect(sortedCards().every(card => CARD_RARITIES.includes(card.rarity))).toBe(true);
    const pawns = sortedCards().filter(card => card.type === CardType.PAWN);
    expect(pawns).toEqual([false, true].flatMap(reserve => pawns.filter(card => isReservePawn(card) === reserve).sort((a, b) => a.name.localeCompare(b.name))));
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
    expect(root.root.findAllByProps({ className: 'deck-empty-center' })).toHaveLength(1);
    expect(root.root.findByProps({ 'aria-label': 'Reserve contents' }).findAllByProps({ className: 'deck-reserve-slot' })).toHaveLength(10);
    expect(JSON.stringify(root.toJSON())).not.toContain('Vassal Pawns are added here automatically');
    const catalog = root.root.findByProps({ 'aria-label': 'All cards' });
    const cardButton = () => catalog.findAllByType('button').find(button => button.props['aria-label'] === `View ${definition.name}`)!;
    act(() => cardButton().props.onClick());
    expect(root.root.findByProps({ 'aria-label': 'Deck contents' }).findAllByProps({ className: 'deck-owned-card' })).toHaveLength(0);
    for (let copy = 0; copy < 4; copy++) act(() => cardButton().props.onDoubleClick());
    expect(root.root.findByProps({ 'aria-label': `Add ${definition.name}` }).props.disabled).toBe(true);
    expect(root.root.findByProps({ 'aria-label': 'Deck contents' }).findAllByType('button').filter(button => button.props.title === 'Right click to remove')).toHaveLength(3);
    const patron = sortedCards().find(card => card.id === 'pawn_patron_of_judgement')!;
    act(() => root.root.findByProps({ 'aria-label': 'Search cards' }).props.onChange({ target: { value: 'Patron of Judgement' } }));
    const patronButton = () => catalog.findByProps({ 'aria-label': `View ${patron.name}` });
    act(() => patronButton().props.onDoubleClick());
    expect(root.root.findByProps({ 'aria-label': 'Reserve contents' }).findAllByType('button')).toHaveLength(1);
    expect(root.root.findByProps({ 'aria-label': 'Reserve contents' }).findAllByProps({ className: 'deck-reserve-slot' })).toHaveLength(9);
    expect(root.root.findAllByProps({ className: 'deck-empty-center' })).toHaveLength(0);
    expect(root.root.findByProps({ 'aria-label': 'Main deck cards' }).findAllByType('button')).toHaveLength(3);
    expect(root.root.findByProps({ 'aria-label': 'Reserve contents' }).findAllByType('div').some(div => div.props.className?.includes('card-vassal'))).toBe(true);
    act(() => root.unmount());
    act(() => { root = create(<RulesView onBack={() => {}} />); });
    const chapters = root.root.findByProps({ 'aria-label': 'Rulebook chapters' });
    const reserveChapter = chapters.findAllByType('button').find(button => button.findAllByType('strong').some(title => title.props.children === 'The Reserve'))!;
    expect(reserveChapter).toBeTruthy();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
    act(() => reserveChapter.props.onClick());
    expect(root.root.findByType('h1').props.children).toBe('The Reserve');
    const reserveRules = root.root.findByProps({ className: 'rulebook-rule-list' }).findAllByType('p').map(rule => rule.props.children).join(' ');
    expect(reserveRules).toContain('up to 10 extra Pawns');
    expect(reserveRules).toContain('either Vassal or Merge Pawns');
    expect(reserveRules).toContain('Contract Action');
    expect(reserveRules).toContain('This is counted as a special summon.');
    act(() => root.unmount());
    vi.unstubAllGlobals();
    // A batch remains available after rotation and retains every pull in rarity order.
    vi.useFakeTimers();
    vi.stubGlobal('window', { setInterval, clearInterval, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
    const random = vi.spyOn(Math, 'random');
    let roll = 0;
    random.mockImplementation(() => ((roll++ * 37) % 100) / 100);
    try {
        act(() => { root = create(<Shop onBack={() => {}} />); });
        const button = (text: string) => root.root.findAllByType('button').find(entry => entry.props['aria-label'] === text || entry.props.children === text)!;
        const chooseMaster = () => root.root.findAllByProps({ className: 'shop-pack' })[0];
        act(() => chooseMaster().props.onClick());
        expect(root.root.findByProps({ 'aria-label': 'Pack details' })).toBeTruthy();
        expect(root.root.findAllByProps({ 'aria-label': 'Pack opening' })).toHaveLength(0);
        const showcase = () => root.root.findByProps({ className: 'pack-showcase' });
        const previewIds = () => showcase().findAllByType(CardDetail).map(entry => entry.props.card.id);
        expect(previewIds()).toEqual([]);
        for (const id of PACKS[0].chaseCardIds) {
            act(() => button('Next showcase item').props.onClick());
            expect(previewIds()).toEqual([id]);
            expect(showcase().findByProps({ 'aria-label': `${cardRegistry.getCard(id)!.name} description` }).findByType('p').props.children).toBe(cardRegistry.getCard(id)!.effectText);
            expect(button(`Inspect ${cardRegistry.getCard(id)!.name}, ${cardRegistry.getCard(id)!.rarity}`)).toBeTruthy();
        }
        act(() => button('Next showcase item').props.onClick());
        expect(previewIds()).toEqual([]);
        act(() => button('Previous showcase item').props.onClick());
        expect(previewIds()).toEqual([PACKS[0].chaseCardIds[2]]);
        act(() => showcase().props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} }));
        expect(previewIds()).toEqual([PACKS[0].chaseCardIds[1]]);
        act(() => button('Preview pack artwork').props.onClick());
        expect(previewIds()).toEqual([]);
        act(() => button('OPEN 5 PACKS').props.onClick());
        const pulls: string[] = [];
        for (let pack = 0; pack < 5; pack++) {
            act(() => vi.advanceTimersByTime(pack === 1 ? ROTATION_MS + 1 : 850));
            expect(button('REVEAL ALL').props.disabled).toBe(false);
            act(() => button('REVEAL ALL').props.onClick());
            const cards = root.root.findByProps({ 'aria-label': 'Pack opening' }).findAllByType(CardDetail);
            pulls.push(...cards.map(entry => entry.props.card.id));
            expect(cards).toHaveLength(5);
            const next = root.root.findAllByType('button').find(entry => entry.props.children?.[0] === 'CONTINUE ')!;
            act(() => next.props.onClick());
        }
        const results = root.root.findByProps({ 'aria-label': 'Session pulls' }).findAllByType(CardDetail).map(entry => entry.props.card);
        expect(results).toHaveLength(25);
        expect(results.map(card => card.id).sort()).toEqual(pulls.sort());
        expect(results.map(card => CARD_RARITY_TIERS[card.rarity])).toEqual(results.map(card => CARD_RARITY_TIERS[card.rarity]).sort((a, b) => b - a));
        for (const tier of new Set(results.map(card => CARD_RARITY_TIERS[card.rarity]))) {
            const names = results.filter(card => CARD_RARITY_TIERS[card.rarity] === tier).map(card => card.name);
            expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        }
        act(() => button('CONTINUE').props.onClick());
        act(() => chooseMaster().props.onClick());
        expect(previewIds()).toEqual([]);
        act(() => button('OPEN 1 PACK').props.onClick());
        act(() => vi.advanceTimersByTime(850));
        act(() => button('REVEAL ALL').props.onClick());
        act(() => root.root.findAllByType('button').find(entry => entry.props.children?.[0] === 'CONTINUE ')!.props.onClick());
        expect(root.root.findAllByProps({ className: 'shop-pack' })).toHaveLength(3);
        expect(root.root.findAllByProps({ 'aria-label': 'Session pulls' })).toHaveLength(0);
    } finally {
        act(() => root.unmount());
        random.mockRestore();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    }
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

it('enforces deck size boundaries, rejects malformed imports, and offers recent playable decks for training', () => {
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
    const vassal = cardRegistry.getCard('pawn_patron_of_judgement')!;
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

    const older = { ...atSize(40), name: 'Older deck' };
    const recent = { ...atSize(60), name: 'Recently edited deck' };
    const invalid = { ...atSize(39), name: 'Incomplete deck' };
    const library = [older, invalid, recent];
    const savedDecks = vi.spyOn(storage, 'getSavedDecks').mockReturnValue(library);
    const start = vi.fn();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let root: ReturnType<typeof create>;
    try {
        act(() => { root = create(<PlaytestSetup onBack={() => {}} onStart={start} />); });
        for (const list of root!.root.findAllByProps({ className: 'training-deck__list' })) {
            const choices = list.findAllByType('button');
            expect(choices.map(choice => choice.findByType('strong').props.children)).toEqual(['RANDOM TEST DECK', recent.name, invalid.name, older.name]);
            expect(choices.map(choice => choice.props.disabled)).toEqual([undefined, false, true, false]);
            expect(choices[1].findByType('small').props.children.filter(Boolean).join('')).toBe('60 cards');
            expect(choices[2].findByType('small').props.children.filter(Boolean).join('')).toBe('39 cards · Invalid');
            act(() => choices[1].props.onClick());
            expect(choices[1].props['aria-pressed']).toBe(true);
        }
        act(() => root!.root.findByProps({ 'aria-label': 'Begin playtest' }).props.onClick());
        expect(start).toHaveBeenCalledWith([recent, recent], 'ai', {});
        expect(library).toEqual([older, invalid, recent]);
    } finally {
        act(() => root?.unmount());
        savedDecks.mockRestore();
    }
});
