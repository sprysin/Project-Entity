import { getSettings } from './desktop/storage';

const soundUrls = {
  select: new URL('./Sounds/Select.mp3', import.meta.url).href,
  'select-small': new URL('./Sounds/SelectSmall.mp3', import.meta.url).href,
  toggle: new URL('./Sounds/toggle.mp3', import.meta.url).href,
  cancellation: new URL('./Sounds/Cancellation.mp3', import.meta.url).href,
  'minor-card-effect': new URL('./Sounds/MinorCardEffect.mp3', import.meta.url).href,
  'to-the-void': new URL('./Sounds/ToTheVoid.mp3', import.meta.url).href,
  'lp-gain': new URL('./Sounds/LPGain.mp3', import.meta.url).href,
  'turn-change': new URL('./Sounds/TurnChange.mp3', import.meta.url).href,
  'gain-stat': new URL('./Sounds/GainStat.mp3', import.meta.url).href,
  'hide-card': new URL('./Sounds/HideCard.mp3', import.meta.url).href,
  'high-effect': new URL('./Sounds/HighEffect.mp3', import.meta.url).href,
  'card-destruction': new URL('./Sounds/CardDestruction.mp3', import.meta.url).href,
} as const;

export type SoundName = keyof typeof soundUrls;

export const isSoundName = (value: string): value is SoundName => value in soundUrls;

export function playSound(name: SoundName) {
  const volume = getSettings().volume / 100;
  if (volume <= 0 || typeof Audio === 'undefined') return;

  const audio = new Audio(soundUrls[name]);
  audio.volume = volume;
  void audio.play().catch(() => {
    // Browsers can reject playback before the first user interaction.
  });
}
