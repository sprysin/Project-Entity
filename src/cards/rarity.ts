import type { CardRarity } from '../types';
const RARITY_COLORS: Record<CardRarity, string> = {
  Common: '#e4e2dc', Uncommon: '#32ff7e', Rare: '#29b6ff', Epic: '#c066ff',
  Legendary: '#ffd02e', Mythic: '#30F0DD', Relic: '#ff791f',
};
export const rarityColor = (rarity: CardRarity) => RARITY_COLORS[rarity];
