import { ActivationPopupMode, GameState, Phase } from '../types';

export const activationPopupModes: ActivationPopupMode[] = ['off', 'auto', 'on'];

/** Prompt preference never changes effect legality or suppresses trigger decisions. */
export function shouldPromptResponse(mode: ActivationPopupMode, state: GameState): boolean {
    if (!state.response || state.response.ready || mode === 'off') return false;
    if (mode === 'on') return true;
    // Older snapshots have no timing; preserve their existing response behavior.
    return !state.response.timing || ['summon', 'attack', 'activation'].includes(state.response.timing)
        || state.response.timing === 'phase_exit' && [Phase.MAIN1, Phase.BATTLE, Phase.MAIN2].includes(state.currentPhase)
        || state.response.timing === 'turn_end' && state.response.priority !== state.activePlayerIndex;
}
