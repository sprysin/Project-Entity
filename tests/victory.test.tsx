import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { WinnerModal } from '../src/components/game/MatchModals';
import { cardRegistry } from '../src/cards/CardRegistry';
import { GameState } from '../src/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it('keeps the MVP face down for one second and then reveals it', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { activeElement: null });
    const card = { ...cardRegistry.getCard('action_01')!, instanceId: 'mvp', ownerId: 'p1' };
    const state = { winner: 'Winner', turnNumber: 4, players: [{ name: 'Winner' }, { name: 'Loser' }], damageEvents: [{ card, playerIndex: 0, amount: 50, kind: 'effect' }] } as GameState;
    let root: ReturnType<typeof create> | undefined;
    try {
        act(() => { root = create(<WinnerModal gameState={state} onQuit={() => {}} />); });
        const front = () => root!.root.findByProps({ className: 'duel-mvp-face duel-mvp-front' });
        expect(front().props['aria-hidden']).toBe(true);
        act(() => vi.advanceTimersByTime(999));
        expect(front().props['aria-hidden']).toBe(true);
        act(() => vi.advanceTimersByTime(1));
        expect(front().props['aria-hidden']).toBe(false);
    } finally {
        act(() => root?.unmount());
        vi.useRealTimers();
        vi.unstubAllGlobals();
    }
});
