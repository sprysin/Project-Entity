import type { CardRarity } from '../types';
const RARITY_COLORS: Record<CardRarity, string> = {
  Common: '#b8c3d4', Uncommon: '#88dca2', Rare: '#77bbff', Epic: '#c28bff',
  Legendary: '#edc56f', Mythic: '#30F0DD', Relic: '#D35400',
};
export const rarityColor = (rarity: CardRarity) => RARITY_COLORS[rarity];
