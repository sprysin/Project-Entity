import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import DeckCreator from '../src/components/DeckCreator';
import { downloadDeck, sortedCards, newDeck, DECK_STORAGE_KEY } from '../src/decks';

vi.mock('../src/decks', async importOriginal => ({ ...await importOriginal<typeof import('../src/decks')>(), downloadDeck: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('deletes only the confirmed deck and keeps the library intact on cancel or storage failure', () => {
    const first = { ...newDeck(), name: 'First' }, second = { ...newDeck(), name: 'Second' };
    const confirm = vi.fn(() => false);
    const setItem = vi.fn();
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm });
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([first, second]), setItem });
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<DeckCreator onBack={() => {}} />); });
    try {
        act(() => renderer.root.findByProps({ 'aria-label': 'Delete a deck' }).props.onClick());
        const remove = () => renderer.root.findByProps({ 'aria-label': 'Delete First' }).props.onClick();
        act(remove);
        expect(setItem).not.toHaveBeenCalled();
        confirm.mockReturnValue(true);
        setItem.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
        act(remove);
        expect(renderer.root.findAll(node => node.type === 'div' && node.props.className?.startsWith('deck-library-tile'))).toHaveLength(2);
        act(remove);
        expect(setItem).toHaveBeenLastCalledWith(DECK_STORAGE_KEY, JSON.stringify([second]));
        expect(renderer.root.findAllByProps({ 'aria-label': 'Open First' })).toHaveLength(0);
        expect(renderer.root.findAllByProps({ 'aria-label': 'Open Second' })).toHaveLength(1);
        expect(renderer.root.findAllByProps({ 'aria-label': 'Deck contents' })).toHaveLength(0);
    } finally { act(() => renderer.unmount()); }
});

it('renders individual copies together, guards additions, removes a copy, and warns after saving an undersized deck', () => {
    const alert = vi.fn();
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), alert });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<DeckCreator onBack={() => {}} />); });
    try {
        act(() => renderer.root.findByProps({ className: 'deck-primary' }).props.onClick());
        const name = sortedCards()[0].name;
        const add = () => renderer.root.findAllByType('button').find(b => b.props['aria-label'] === `Add ${name}`)!;
        for (let i = 0; i < 4; i++) act(() => add().props.onClick());
        expect(add().props.disabled).toBe(true);
        const grid = renderer.root.findByProps({ className: 'deck-owned-grid' });
        expect(grid.findAllByProps({ className: 'deck-owned-card' })).toHaveLength(3);
        expect(grid.findAllByType('section')).toHaveLength(0);
        act(() => grid.findAllByType('button').find(b => b.props['aria-label'] === `Remove ${name}, copy 1`)!.props.onClick());
        expect(grid.findAllByProps({ className: 'deck-owned-card' })).toHaveLength(2);
        expect(add().props.disabled).toBe(false);
        act(() => renderer.root.findByProps({ title: 'Save deck locally' }).props.onClick());
        expect(downloadDeck).not.toHaveBeenCalled();
        act(() => renderer.root.findByProps({ 'aria-label': 'Export deck to JSON' }).props.onClick());
        expect(downloadDeck).toHaveBeenCalledWith(expect.objectContaining({ cards: [{ cardId: sortedCards()[0].id, quantity: 2 }] }));
        expect(alert).toHaveBeenCalledWith(expect.stringContaining('unplayable'));
    } finally { act(() => renderer.unmount()); }
});
