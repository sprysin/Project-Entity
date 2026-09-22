import { useEffect } from 'react';
import { isSoundName, playSound } from '../audio';

export function useUiSounds() {
  useEffect(() => {
    const playElementSound = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>('[data-sound]');
      if (!element || element.matches(':disabled, [aria-disabled="true"]')) return;

      const sound = element.dataset.sound;
      if (sound && isSoundName(sound)) playSound(sound);
    };

    document.addEventListener('click', playElementSound, true);
    return () => document.removeEventListener('click', playElementSound, true);
  }, []);
}
