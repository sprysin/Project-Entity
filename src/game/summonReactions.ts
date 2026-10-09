import { fieldEntries, sourceZone } from './field';
import { Card, CardContext, CardType, GameState, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { isReservePawn } from './cardHelpers';

export function handSummonSource(state: GameState, request: { sourceId: string; playerIndex: number }) {
    const player = state.players[request.playerIndex];
    return [...player.pawnZones, ...player.actionZones]
        .find(zone => zone?.card.instanceId === request.sourceId && zone.position !== Position.HIDDEN);
}

export function handSummonCandidates(state: GameState, request: { sourceId: string; playerIndex: number }): Card[] {
    const player = state.players[request.playerIndex];
    const source = handSummonSource(state, request);
    const filter = source && cardRegistry.getEffect(source.card.id)?.handSummonFilter;
    return filter && player.pawnZones.includes(null)
        ? player.hand.filter(card => card.type === CardType.PAWN && !isReservePawn(card) && filter(card)) : [];
}

export function notifyPawnSummoned(state: GameState, summonedCard: Card, summoningPlayerIndex: number, tributeCount: number): GameState {
    const sources: CardContext[] = fieldEntries(state).flatMap(({ zone, target }) => zone.position !== Position.HIDDEN
            ? [{ card: zone.card, playerIndex: target.playerIndex }] : []);
    let next = state;
    for (const context of sources) {
        if (next.winner) break;
        const source = sourceZone(next, context);
        const handler = source && cardRegistry.getEffect(source.card.id)?.onPawnSummoned;
        if (handler) next = handler(next, { ...context, card: source.card, summonedCard, summoningPlayerIndex, tributeCount }).newState;
    }
    return next;
}
