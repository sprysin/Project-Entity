import { GameState } from '../types';

/** Shared host rule: automatic progression waits for the current player's decision. */
export function isAwaitingDecision(state: GameState): boolean {
    return !!(state.pendingActivation || state.pendingChainTarget || state.response && !state.response.ready && !state.resolvingChain
        || state.pendingVoidReturns?.length || state.pendingVoidSelections?.length
        || state.attackReplay
        || !state.chain?.length && !state.response && (state.pendingHandSummons?.length || state.pendingReactions?.length));
}
