import { GameState } from '../../types';

/** Game state contains plain data, so structuredClone gives us one safe, typed clone path. */
export const cloneGameState = (state: GameState): GameState => structuredClone(state);

export const clonePlayers = (players: GameState['players']): GameState['players'] => structuredClone(players);
