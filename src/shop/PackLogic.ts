import { cardRegistry, CardDefinition } from '../cards/CardRegistry';
import '../cards/pawns';
import '../cards/actions';
import '../cards/conditions';
import { CARD_RARITIES, type CardRarity } from '../types';
import { PACKS } from './packs';
import type { Pack } from './packs';

export const PACK_SIZE = 5;
export const ROTATION_MS = 5 * 60 * 1000;
// Conditional chances, checked from highest tier to lowest with a fresh roll.
// The lowest available tier is guaranteed; pool size does not change tier odds.
export const RARITY_ROLL_CHANCES: Record<CardRarity, number> = {
  Common: 1, Uncommon: 0.30, Rare: 0.15, Epic: 0.04,
  Legendary: 0.0075, Mythic: 0.002, Relic: 0.002,
};
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
  return CARD_RARITIES.map(rarity => {
    const pool = cards.filter(card => card.rarity === rarity);
    return { rarity, chance: RARITY_ROLL_CHANCES[rarity], cards: pool };
  })
    .filter(group => group.cards.length);
}
export function openPack(pack: Pack, random = Math.random): CardDefinition[] {
  const tiers = packTiers(pack).reverse();
  if (!tiers.length) throw new Error('ERROR: Empty Pool');
  return Array.from({ length: PACK_SIZE }, () => {
    const pool = tiers.find((group, index) => index === tiers.length - 1 || random() < group.chance)!.cards;
    return weightedPick(pool, () => 1, random);
  });
}
export interface Rotation { expiresAt: number; packIds: string[] }
export function advanceRotation(previous: Rotation | null, now: number, random = Math.random): Rotation {
  if (previous && previous.expiresAt > now) return previous;
  const featured = PACKS.filter(pack => pack.rotationWeight > 0);
  const packIds = ['master'];
  for (let slot = 0; slot < 2 && featured.length; slot++) {
    const pack = weightedPick(featured, pack => pack.rotationWeight, random);
    packIds.push(pack.id);
    featured.splice(featured.indexOf(pack), 1);
  }
  return {
    expiresAt: now + ROTATION_MS, packIds
  };
}
const STORAGE_KEY = 'entity.shop.rotation.v1';
export function loadRotation(now: number): Rotation {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value && Number.isFinite(value.expiresAt) && value.expiresAt <= now + ROTATION_MS
      && Array.isArray(value.packIds) && value.packIds.length === 3 && value.packIds[0] === 'master'
      && new Set(value.packIds).size === value.packIds.length
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
