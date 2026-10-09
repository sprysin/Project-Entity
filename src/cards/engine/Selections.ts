import { activeLand, isLand, removeFieldIdentity } from '../../game/field';
import { Card, CardContext, CardFilter, GameState, SelectedCard, SelectionLocation } from '../../types';
import { EffectStep } from './Builder';
import { canTargetWithEffect } from '../../game/cardHelpers';
import { Dynamic, resolveDynamic } from './Dynamic';

/** Enumerate identities without making them effect targets. */
export function cardsForSelection(state: GameState, playerIndex: number, location: SelectionLocation): Card[] {
    const player = state.players[playerIndex];
    return location === 'field'
        ? [...player.pawnZones, ...player.actionZones, activeLand(state)].flatMap(zone => zone ? [zone.card] : [])
        : player[location];
}

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
    const candidates = cardsForSelection(state, playerIndex, options.location)
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
