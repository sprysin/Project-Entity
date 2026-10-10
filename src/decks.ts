import { isGeneratedCard, isReservePawn, shuffleDeck } from './game/cardHelpers';
import { cardRegistry, CardDefinition } from './cards/CardRegistry';
import { LEGACY_CARD_IDS } from './cards/legacyIds';
import { Card, CardType } from './types';
import './cards/pawns';
import './cards/actions';
import './cards/conditions';

export interface SavedDeck {
    version: 1;
    id: string;
    name: string;
    cards: { cardId: string; quantity: number }[];
    reserve?: { cardId: string; quantity: number }[];
}

export const MAX_COPIES = 3;
export const MIN_DECK_SIZE = 40;
export const MAX_DECK_SIZE = 60;
export const MAX_RESERVE_SIZE = 10;
export const deckSize = (deck: SavedDeck) => deck.cards.reduce((sum, entry) => sum + entry.quantity, 0);
export const reserveSize = (deck: SavedDeck) => (deck.reserve ?? []).reduce((sum, entry) => sum + entry.quantity, 0);
export const canAddCard = (deck: SavedDeck, cardId: string) => {
    const card = cardRegistry.getCard(cardId);
    if (!card || isGeneratedCard(card)) return false;
    const entries = isReservePawn(card) ? deck.reserve ?? [] : deck.cards;
    return (isReservePawn(card) ? reserveSize(deck) < MAX_RESERVE_SIZE : deckSize(deck) < MAX_DECK_SIZE)
        && (entries.find(e => e.cardId === cardId)?.quantity ?? 0) < MAX_COPIES;
};
export const isDeckPlayable = (deck: SavedDeck) => {
    try { parseDeck(deck); } catch { return false; }
    return deckSize(deck) >= MIN_DECK_SIZE;
};
const order = { [CardType.PAWN]: 0, [CardType.ACTION]: 1, [CardType.CONDITION]: 2 };
let catalogSize = -1;
let catalog: readonly CardDefinition[] = [];
export function sortedCards(): readonly CardDefinition[] {
    if (catalogSize !== cardRegistry.size) {
        catalog = Object.freeze(cardRegistry.getAllCards().filter(card => !isGeneratedCard(card))
            .sort((a, b) => order[a.type] - order[b.type]
                || Number(isReservePawn(a)) - Number(isReservePawn(b))
                || a.name.localeCompare(b.name)));
        catalogSize = cardRegistry.size;
    }
    return catalog;
}
export const newDeck = (): SavedDeck => ({ version: 1, id: crypto.randomUUID(), name: 'Untitled deck', cards: [] });

/** Expands stable saved-deck entries into shuffled runtime card instances. */
export function createRuntimeDeck(deck: SavedDeck, playerId: string): Card[] {
    if (!isDeckPlayable(deck)) throw new Error('A deck must contain 40–60 cards with no more than 3 copies of each card.');
    const cards = expandEntries(parseDeck(deck).cards, playerId);
    shuffleDeck(cards);
    return cards;
}

export function createRuntimeReserve(deck: SavedDeck, playerId: string): Card[] {
    return expandEntries(parseDeck(deck).reserve ?? [], playerId);
}

function expandEntries(entries: SavedDeck['cards'], playerId: string): Card[] {
    return entries.flatMap(entry => {
        const definition = cardRegistry.getCard(entry.cardId);
        if (!definition) throw new Error(`The deck contains an unknown card: ${entry.cardId}`);
        return Array.from({ length: entry.quantity }, (_, copyIndex) => ({
            ...definition,
            instanceId: `${playerId}_${entry.cardId}_${copyIndex}_${crypto.randomUUID()}`,
            ownerId: playerId,
        }));
    });
}

// Only stable card IDs and quantities belong in files, never runtime game state.
export function parseDeck(value: unknown, enforceLimits = true): SavedDeck {
    const deck = value as SavedDeck;
    if (!deck || deck.version !== 1 || typeof deck.id !== 'string' || !deck.id.trim() ||
        typeof deck.name !== 'string' || !deck.name.trim() || deck.name.length > 80 || !Array.isArray(deck.cards)) {
        throw new Error('This is not a supported deck JSON file.');
    }
    if (deck.reserve !== undefined && !Array.isArray(deck.reserve)) throw new Error('The Reserve must be a list of cards.');
    const known = new Map(sortedCards().map(c => [c.id, c]));
    const seen = new Set<string>();
    const readEntries = (entries: SavedDeck['cards'], reserve: boolean) => entries.map(entry => {
        if (entry && Object.hasOwn(LEGACY_CARD_IDS, entry.cardId)) entry = { ...entry, cardId: LEGACY_CARD_IDS[entry.cardId] };
        if (!entry || !known.has(entry.cardId) || seen.has(entry.cardId) || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 999) {
            throw new Error('The deck contains unknown cards or invalid quantities.');
        }
        seen.add(entry.cardId);
        if (isReservePawn(known.get(entry.cardId)!) !== reserve) throw new Error('Vassal Pawns belong in the Reserve; other cards belong in the main deck.');
        return { cardId: entry.cardId, quantity: entry.quantity };
    });
    const cards = readEntries(deck.cards, false);
    const reserve = readEntries(deck.reserve ?? [], true);
    const positions = new Map(sortedCards().map((c, i) => [c.id, i]));
    if (enforceLimits && [...cards, ...reserve].some(e => e.quantity > MAX_COPIES)) throw new Error('Only 3 copies of each card are allowed.');
    if (enforceLimits && deckSize({ ...deck, cards }) > MAX_DECK_SIZE) throw new Error('Decks cannot contain more than 60 cards.');
    if (enforceLimits && reserveSize({ ...deck, reserve }) > MAX_RESERVE_SIZE) throw new Error('The Reserve cannot contain more than 10 cards.');
    cards.sort((a, b) => positions.get(a.cardId)! - positions.get(b.cardId)!);
    reserve.sort((a, b) => positions.get(a.cardId)! - positions.get(b.cardId)!);
    return { version: 1, id: deck.id, name: deck.name.trim(), cards, ...(deck.reserve === undefined ? {} : { reserve }) };
}
