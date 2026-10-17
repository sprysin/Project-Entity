import { Card, CardType, GameState, LevelTributeSelectionRequest } from '../types';
import { canTribute } from './cardHelpers';

export type LevelTributeOptions = Pick<LevelTributeSelectionRequest, 'location' | 'filter' | 'sendOnly'>;

export function levelTributeCandidates(state: GameState, playerIndex: number, options: LevelTributeOptions = {}): { card: Card; location: 'hand' | 'field' }[] {
    const player = state.players[playerIndex];
    return [
        ...player.hand.map(card => ({ card, location: 'hand' as const })),
        ...player.pawnZones.flatMap(zone => zone ? [{ card: zone.card, location: 'field' as const }] : [])
    ].filter(({ card, location }) => card.type === CardType.PAWN && card.level > 0 && (options.sendOnly || canTribute(card))
        && (!options.location || options.location === location) && (!options.filter || options.filter(card)));
}

/** A tribute summon must also have an empty zone, or free one through its cost. */
export function canPayLevelTribute(state: GameState, request: LevelTributeSelectionRequest): boolean {
    const fieldIds = new Set(levelTributeCandidates(state, request.playerIndex, request)
        .filter(entry => entry.location === 'field').map(entry => entry.card.instanceId));
    return levelTributeChoices(state, request).some(ids => state.players[request.playerIndex].pawnZones.includes(null)
        || ids.some(id => fieldIds.has(id)));
}

/** Bounded subset search; shared by activation legality, AI and the cost prompt. */
export function levelTributeChoices(state: GameState, request: LevelTributeSelectionRequest, limit = 160): string[][] {
    const candidates = levelTributeCandidates(state, request.playerIndex, request);
    const choices: string[][] = [];
    const visit = (start: number, remaining: number, ids: string[]) => {
        if (choices.length >= limit) return;
        if (remaining === 0) { if (ids.length) choices.push(ids); return; }
        for (let i = start; i < candidates.length && choices.length < limit; i++) {
            const card = candidates[i].card;
            if (card.level <= remaining) visit(i + 1, remaining - card.level, [...ids, card.instanceId]);
        }
    };
    visit(0, request.totalLevel, []);
    return choices;
}
