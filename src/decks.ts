import { cardRegistry, CardDefinition } from './cards/CardRegistry';
import { CardType } from '../types';
import './cards/pawns';
import './cards/actions';
import './cards/conditions';

export interface SavedDeck {
    version: 1;
    id: string;
    name: string;
    cards: { cardId: string; quantity: number }[];
}

export const DECK_STORAGE_KEY = 'project-pawn.decks.v1';
export const MAX_COPIES = 3;
export const MIN_DECK_SIZE = 40;
export const MAX_DECK_SIZE = 60;
export const deckSize = (deck: SavedDeck) => deck.cards.reduce((sum, entry) => sum + entry.quantity, 0);
export const canAddCard = (deck: SavedDeck, cardId: string) => deckSize(deck) < MAX_DECK_SIZE && (deck.cards.find(e => e.cardId === cardId)?.quantity ?? 0) < MAX_COPIES;
export const isDeckPlayable = (deck: SavedDeck) => deckSize(deck) >= MIN_DECK_SIZE && deckSize(deck) <= MAX_DECK_SIZE && deck.cards.every(e => e.quantity >= 1 && e.quantity <= MAX_COPIES);
const order = { [CardType.PAWN]: 0, [CardType.ACTION]: 1, [CardType.CONDITION]: 2 };
export const sortedCards = (): CardDefinition[] => cardRegistry.getAllCards().sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name));
export const newDeck = (): SavedDeck => ({ version: 1, id: crypto.randomUUID(), name: 'Untitled deck', cards: [] });

// Only stable card IDs and quantities belong in files, never runtime game state.
export function parseDeck(value: unknown, enforceLimits = true): SavedDeck {
    const deck = value as SavedDeck;
    if (!deck || deck.version !== 1 || typeof deck.id !== 'string' || !deck.id.trim() ||
        typeof deck.name !== 'string' || !deck.name.trim() || deck.name.length > 80 || !Array.isArray(deck.cards)) {
        throw new Error('This is not a supported deck JSON file.');
    }
    const known = new Set(sortedCards().map(c => c.id));
    const seen = new Set<string>();
    const cards = deck.cards.map(entry => {
        if (!entry || !known.has(entry.cardId) || seen.has(entry.cardId) || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 999) {
            throw new Error('The deck contains unknown cards or invalid quantities.');
        }
        seen.add(entry.cardId);
        return { cardId: entry.cardId, quantity: entry.quantity };
    });
    const positions = new Map(sortedCards().map((c, i) => [c.id, i]));
    if (enforceLimits && cards.some(e => e.quantity > MAX_COPIES)) throw new Error('Only 3 copies of each card are allowed.');
    if (enforceLimits && deckSize({ ...deck, cards }) > MAX_DECK_SIZE) throw new Error('Decks cannot contain more than 60 cards.');
    cards.sort((a, b) => positions.get(a.cardId)! - positions.get(b.cardId)!);
    return { version: 1, id: deck.id, name: deck.name.trim(), cards };
}

export function loadDecks(storage: Pick<Storage, 'getItem'>): SavedDeck[] {
    const raw = storage.getItem(DECK_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('The local deck library could not be read.');
    // Keep older decks accessible so excess copies can be removed in the editor.
    return data.map(value => parseDeck(value, false));
}

export function storeDeck(storage: Pick<Storage, 'setItem'>, library: SavedDeck[], deck: SavedDeck): SavedDeck[] {
    const valid = parseDeck(deck);
    const next = [...library.filter(item => item.id !== valid.id), valid];
    storage.setItem(DECK_STORAGE_KEY, JSON.stringify(next));
    return next;
}

export function downloadDeck(deck: SavedDeck) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(parseDeck(deck), null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (deck.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'deck') + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
