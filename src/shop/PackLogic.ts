import { cardRegistry, CardDefinition } from '../cards/CardRegistry';
import '../cards/pawns';
import '../cards/actions';
import '../cards/conditions';
import { CARD_RARITY_TIERS } from '../types';
import { PACKS } from './packs';
import type { Pack } from './packs';

export const PACK_SIZE = 5;
export const ROTATION_MS = 5 * 60 * 1000;
// Per-card weights keep each higher-rarity card harder to pull, even in small pools.
// Roll the aggregated tier weight, then uniformly select a card in that tier.
// Legendary / Mythic / Relic share the existing game's highest rarity tier.
export const TIER_WEIGHTS = [48, 30, 14.5, 6, 1.5] as const;
export function weightedPick<T>(entries: readonly T[], weight: (entry: T) => number, random = Math.random): T {
  const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
  if (!entries.length || total <= 0) throw new Error('ERROR: Empty Pool');
  let roll = random() * total;
  return entries.find(entry => (roll -= weight(entry)) < 0) ?? entries[entries.length - 1];
}
export function packCards(pack: Pack): CardDefinition[] {
  return pack.cardIds.map(id => {
    const card = cardRegistry.getCard(id);
    if (!card) throw new Error(`Unknown card ${id} in ${pack.name}`);
    return card;
  });
}
export function packTiers(pack: Pack) {
  const cards = packCards(pack);
  return TIER_WEIGHTS.map((weight, tier) => {
    const pool = cards.filter(card => CARD_RARITY_TIERS[card.rarity] === tier);
    return { tier, weight: weight * pool.length, cards: pool };
  })
    .filter(group => group.cards.length);
}
export function openPack(pack: Pack, random = Math.random): CardDefinition[] {
  const tiers = packTiers(pack);
  return Array.from({ length: PACK_SIZE }, () => {
    const pool = weightedPick(tiers, group => group.weight, random).cards;
    return weightedPick(pool, () => 1, random);
  });
}
export interface Rotation { expiresAt: number; packIds: string[] }
export function advanceRotation(previous: Rotation | null, now: number, random = Math.random): Rotation {
  if (previous && previous.expiresAt > now) return previous;
  const featured = PACKS.filter(pack => pack.rotationWeight > 0);
  return {
    expiresAt: now + ROTATION_MS, packIds: previous
      ? ['master', ...Array.from({ length: 2 }, () => weightedPick(featured, pack => pack.rotationWeight, random).id)]
      : PACKS.map(pack => pack.id)
  };
}
const STORAGE_KEY = 'entity.shop.rotation.v1';
export function loadRotation(now: number): Rotation {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value && Number.isFinite(value.expiresAt) && value.expiresAt <= now + ROTATION_MS
      && Array.isArray(value.packIds) && value.packIds.length === 3 && value.packIds[0] === 'master'
      && value.packIds.slice(1).every((id: unknown) => PACKS.some(pack => pack.id === id && pack.rotationWeight > 0))) {
      return advanceRotation(value, now);
    }
  } catch { /* Storage is optional for the free preview. */ }
  return advanceRotation(null, now);
}
export function saveRotation(rotation: Rotation) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rotation)); } catch { /* Keep playing without storage. */ }
}
export { rarityColor } from '../cards/rarity';
