import { Card, CardContext, CardType, GameState, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';

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
        ? player.hand.filter(card => card.type === CardType.PAWN && filter(card)) : [];
}

export function notifyPawnSummoned(state: GameState, summonedCard: Card, summoningPlayerIndex: number, tributeCount: number): GameState {
    const sources: CardContext[] = state.players.flatMap((player, playerIndex) =>
        [...player.pawnZones, ...player.actionZones].flatMap(zone => zone && zone.position !== Position.HIDDEN
            ? [{ card: zone.card, playerIndex }] : []));
    let next = state;
    for (const context of sources) {
        if (next.winner) break;
        const source = [...next.players[context.playerIndex].pawnZones, ...next.players[context.playerIndex].actionZones]
            .find(zone => zone?.card.instanceId === context.card.instanceId && zone.position !== Position.HIDDEN);
        const handler = source && cardRegistry.getEffect(source.card.id)?.onPawnSummoned;
        if (handler) next = handler(next, { ...context, card: source.card, summonedCard, summoningPlayerIndex, tributeCount }).newState;
    }
    return next;
}
