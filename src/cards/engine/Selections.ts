import { fieldEntries, isLand, removeFieldIdentity } from '../../game/field';
import { Card, CardContext, CardFilter, GameState, PlacedCard, SelectedCard, SelectionLocation, ShuffleSelectionRequest, TargetSelectScope } from '../../types';
import { EffectStep } from './Builder';
import { canTargetWithEffect, cardsAtLocation } from '../../game/cardHelpers';
import { Dynamic, resolveDynamic } from './Dynamic';

/** One candidate list for effect validation, the picker, and AI enumeration. */
export function multiSelectionCards(state: GameState, request: ShuffleSelectionRequest): Card[] {
    const cards = request.fieldScope !== undefined ? fieldEntries(state)
        .filter(({ target }) => request.fieldScope === 'both'
            || (target.playerIndex === request.playerIndex) === (request.fieldScope === 'active'))
        .map(({ zone }) => zone.card)
        : cardsAtLocation(state.players[request.playerIndex], request.location, state).map(entry => entry.card);
    return cards.filter(request.filter);
}

/** Choose field identities without targeting, optionally choosing fewer or none. */
export const selectFieldCards = (options: {
    count?: Dynamic<number>;
    scope?: TargetSelectScope;
    filter: (zone: PlacedCard) => boolean;
}): EffectStep => (state, context) => {
    const eligible = fieldEntries(state).filter(({ zone }) => options.filter(zone)).map(({ zone }) => zone.card.instanceId);
    const request: ShuffleSelectionRequest = {
        playerIndex: context.playerIndex, location: 'field', fieldScope: options.scope ?? 'both',
        filter: card => eligible.includes(card.instanceId),
        count: 0, upTo: options.count === undefined
    };
    const candidates = multiSelectionCards(state, request);
    request.count = options.count === undefined ? candidates.length : Math.min(candidates.length, resolveDynamic(options.count, state, context));
    if (!Number.isSafeInteger(request.count) || request.count < 0) return { halt: true };
    const ids = context.shuffleCardIds;
    if (context.execution === 'resolve') return;
    if (!ids) return request.count ? { requireShuffleSelection: request } : undefined;
    if (new Set(ids).size !== ids.length || (request.upTo ? ids.length > request.count : ids.length !== request.count)
        || ids.some(id => !candidates.some(card => card.instanceId === id))) return { halt: true };
};

/** Produces selections for later effect steps; randomness never implies targeting. */
export const randomSelection = (options: {
    location: SelectionLocation;
    playerIndex?: Dynamic<number>;
    filter?: CardFilter;
    candidateIds?: Dynamic<readonly string[]>;
    count?: number;
    selectionIndex?: number;
    isTarget?: boolean;
}): EffectStep => (state, context) => {
    const playerIndex = options.playerIndex === undefined ? context.playerIndex : resolveDynamic(options.playerIndex, state, context);
    if (!state.players[playerIndex]) return { halt: true };
    const ids = options.candidateIds === undefined ? undefined : resolveDynamic(options.candidateIds, state, context);
    const candidates = cardsAtLocation(state.players[playerIndex], options.location, state).map(entry => entry.card)
        .filter(card => (!options.filter || options.filter(card)) && (!options.isTarget || canTargetWithEffect(card)));
    const pool = ids ? ids.map(id => candidates.find(card => card.instanceId === id)) : candidates;
    const count = options.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || pool.length < count || pool.some(card => !card)
        || new Set(pool.map(card => card!.instanceId)).size !== pool.length) return { halt: true };
    context.selections = [...(context.selections ?? [])];
    for (let index = 0; index < count; index++) {
        const chosen = context.execution === 'resolve' ? Math.floor(Math.random() * pool.length) : 0;
        const card = pool.splice(chosen, 1)[0]!;
        const selectionIndex = (options.selectionIndex ?? 0) + index;
        context.selections[selectionIndex] = { playerIndex, location: options.location, card, isTarget: options.isTarget ?? false };
        if (options.isTarget && options.location === 'field') {
            const pawnIndex = state.players[playerIndex].pawnZones.findIndex(zone => zone?.card.instanceId === card.instanceId);
            const target = isLand(card) ? { playerIndex: state.activePlayerIndex, type: 'land' as const, index: 0 } : pawnIndex >= 0 ? { playerIndex, type: 'pawn' as const, index: pawnIndex }
                : { playerIndex, type: 'action' as const, index: state.players[playerIndex].actionZones.findIndex(zone => zone?.card.instanceId === card.instanceId) };
            context.targets = [...(context.targets ?? [])];
            context.targets[selectionIndex] = target;
            context.target = context.targets[0];
        }
    }
};

/** Consume a selected identity at its original location, never a replacement card. */
export function takeSelectedCard(state: GameState, context: CardContext, index = 0): Card | undefined {
    const selected: SelectedCard | undefined = context.selections?.[index];
    if (!selected) return;
    const player = state.players[selected.playerIndex];
    if (selected.location === 'field') {
        return removeFieldIdentity(state, selected.card.instanceId);
    } else {
        const pile = player[selected.location];
        const slot = pile.findIndex(card => card.instanceId === selected.card.instanceId);
        if (slot >= 0) return pile.splice(slot, 1)[0];
    }
}
