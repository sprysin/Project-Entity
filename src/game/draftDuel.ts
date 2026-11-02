import starterDeck from '../data/starter-deck.json';
import { parseDeck } from '../decks';
import { openPack } from '../shop/PackLogic';
import { PACKS } from '../shop/packs';

export type DraftScore = [number, number];
export type DraftResult = 'victory' | 'defeat' | 'draw';

export function createDraftDuel(random = Math.random) {
  const available = PACKS.filter(pack => pack.id !== 'master');
  if (available.length < 2) throw new Error('Draft Duel needs two themed packs.');
  const packs = Array.from({ length: 2 }, () => available.splice(Math.floor(random() * available.length), 1)[0]);
  const batches = packs.flatMap(pack => Array.from({ length: 5 }, () => ({
    pack, cards: openPack(pack, random), opponentCards: openPack(pack, random),
  })));
  const deck = parseDeck(structuredClone(starterDeck));
  const pool: Record<string, number> = {};
  for (const entry of [...deck.cards, ...deck.reserve ?? []]) pool[entry.cardId] = entry.quantity;
  for (const { cards } of batches) for (const card of cards) pool[card.id] = (pool[card.id] ?? 0) + 1;
  return { packs, batches, pool, deck, opponentDeck: structuredClone(deck) };
}

export function scoreDraftGame(score: DraftScore, result: DraftResult): DraftScore {
  return [score[0] + Number(result !== 'defeat'), score[1] + Number(result !== 'victory')];
}

export function getDraftDeckEdits(run: ReturnType<typeof createDraftDuel>) {
  const counts = (deck: typeof run.deck) => new Map([...deck.cards, ...deck.reserve ?? []].map(entry => [entry.cardId, entry.quantity]));
  const original = counts(run.opponentDeck);
  const current = counts(run.deck);
  const remaining = new Map([...current].map(([id, count]) => [id, Math.max(0, count - (original.get(id) ?? 0))]));
  // Identical copies have no individual identity; attribute additions in pull order.
  const groups = run.packs.map(pack => {
    const added = new Map<string, number>();
    for (const batch of run.batches.filter(batch => batch.pack.id === pack.id)) for (const card of batch.cards) {
      const needed = remaining.get(card.id) ?? 0;
      if (!needed) continue;
      added.set(card.id, (added.get(card.id) ?? 0) + 1);
      remaining.set(card.id, needed - 1);
    }
    return { label: pack.name, color: pack.color, removed: false, entries: [...added].map(([cardId, quantity]) => ({ cardId, quantity })) };
  });
  return [...groups, { label: 'Removed from starter', color: '#fda4af', removed: true,
    entries: [...original].flatMap(([cardId, count]) => count > (current.get(cardId) ?? 0) ? [{ cardId, quantity: count - (current.get(cardId) ?? 0) }] : []),
  }];
}

export function draftMatchResult(score: DraftScore): DraftResult | null {
  if (score.every(points => points >= 2)) return 'draw';
  return score[0] >= 2 ? 'victory' : score[1] >= 2 ? 'defeat' : null;
}
