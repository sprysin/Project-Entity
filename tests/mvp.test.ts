import { expect, it } from 'vitest';
import { getDuelMvp } from '../src/game/mvp';
import { Card, GameState } from '../src/types';

it('ranks winner-owned instances across battle and effect damage beyond the visible log', () => {
    const a = { instanceId: 'a', name: 'Twin' } as Card;
    const b = { instanceId: 'b', name: 'Twin' } as Card;
    const state = { winner: 'Winner', players: [{ name: 'Winner' }, { name: 'Loser' }], log: [], damageEvents: [
        { card: a, playerIndex: 0, amount: 200, kind: 'battle' },
        { card: b, playerIndex: 0, amount: 250, kind: 'battle' },
        { card: a, playerIndex: 0, amount: 100, kind: 'effect' },
        { card: b, playerIndex: 1, amount: 900, kind: 'effect' },
    ] } as GameState;
    expect(getDuelMvp(state)).toEqual({ card: a, battle: 200, effect: 100, total: 300 });
    state.damageEvents![1].amount = 300;
    expect(getDuelMvp(state)?.card.instanceId).toBe('a');
    state.damageEvents = [];
    expect(getDuelMvp(state)).toBeNull();
});
