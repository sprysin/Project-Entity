import { GameState, EffectResult } from './types';

const API_BASE = 'http://localhost:5073/api/game';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
    }
    return response.json();
}

export const api = {
    getState: async (): Promise<GameState> => {
        const res = await fetch(`${API_BASE}`);
        return handleResponse<GameState>(res);
    },

    startGame: async (): Promise<GameState> => {
        const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
        return handleResponse<GameState>(res);
    },

    nextPhase: async (): Promise<EffectResult> => {
        const res = await fetch(`${API_BASE}/phase/next`, { method: 'POST' });
        return handleResponse<EffectResult>(res);
    },

    summon: async (cardId: string, mode: 'normal' | 'hidden' | 'tribute', tributeIndices?: number[]): Promise<EffectResult> => {
        const res = await fetch(`${API_BASE}/summon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId, mode, tributeIndices })
        });
        return handleResponse<EffectResult>(res);
    },

    setAction: async (cardId: string): Promise<EffectResult> => {
        const res = await fetch(`${API_BASE}/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId })
        });
        return handleResponse<EffectResult>(res);
    },

    activateHand: async (cardId: string, target?: any, discardIndex?: number, handIndex?: number): Promise<EffectResult> => {
        const res = await fetch(`${API_BASE}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: 'hand', cardId, target, discardIndex, handIndex })
        });
        return handleResponse<EffectResult>(res);
    },

    activateField: async (index: number, type: 'entity' | 'action', target?: any, discardIndex?: number, handIndex?: number): Promise<EffectResult> => {
        const res = await fetch(`${API_BASE}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: 'field', index, type, target, discardIndex, handIndex })
        });
        return handleResponse<EffectResult>(res);
    },

    attack: async (attackerIndex: number, targetIndexStr: string): Promise<EffectResult> => {
        const res = await fetch(`${API_BASE}/attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attackerIndex, targetIndexStr })
        });
        return handleResponse<EffectResult>(res);
    }
};
