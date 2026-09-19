import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import PlaytestSetup from '../src/components/PlaytestSetup';
import { DECK_STORAGE_KEY, newDeck, sortedCards } from '../src/decks';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it('selects saved playable decks for either player and passes them into the playtest', () => {
  const entries = sortedCards().slice(0, 14).map((card, index) => ({ cardId: card.id, quantity: index < 12 ? 3 : 2 }));
  const playable = { ...newDeck(), name: 'Established deck', cards: entries };
  const incomplete = { ...newDeck(), name: 'Work in progress', cards: entries.slice(0, 1) };
  const storage = { getItem: vi.fn((key: string) => key === DECK_STORAGE_KEY ? JSON.stringify([playable, incomplete]) : null) };
  vi.stubGlobal('localStorage', storage);
  const onStart = vi.fn();
  let root!: ReturnType<typeof create>;

  act(() => { root = create(<PlaytestSetup onBack={() => {}} onStart={onStart} />); });
  const playableButtons = root.root.findAllByProps({ 'aria-label': `${playable.name}, 40 cards` });
  expect(playableButtons).toHaveLength(2);
  expect(root.root.findAllByProps({ 'aria-label': `${incomplete.name}, 3 cards, not playable` }).every(button => button.props.disabled)).toBe(true);
  act(() => playableButtons[0].props.onClick());
  act(() => root.root.findByProps({ 'aria-label': 'Begin playtest' }).props.onClick());
  expect(onStart).toHaveBeenCalledWith([playable, null]);
  act(() => root.unmount());
  vi.unstubAllGlobals();
});
