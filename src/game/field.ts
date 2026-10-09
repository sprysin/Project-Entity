import { ActionSubtype, Card, CardContext, CardTarget, CardType, GameState, PlacedCard } from '../types';

export const isLand = (card: Card): boolean => card.type === CardType.ACTION && card.actionSubtype === ActionSubtype.LAND;
export const activeLand = (state: GameState): PlacedCard | undefined => state.landStack?.at(-1);
export const hasLand = (state: GameState, card: Card): boolean => !!state.landStack?.some(zone =>
    zone.card.id === card.id || zone.card.name.toLowerCase() === card.name.toLowerCase());
/** Shared Lands belong to neither personal row; expose the active one once. */
export function fieldEntries(state: GameState): { zone: PlacedCard; target: CardTarget }[] {
    const entries = state.players.flatMap((player, playerIndex) => (['pawn', 'action'] as const).flatMap(type =>
        player[type === 'pawn' ? 'pawnZones' : 'actionZones'].flatMap((zone, index) => zone ? [{ zone, target: { playerIndex, type, index } as CardTarget }] : [])));
    const land = activeLand(state);
    if (land) entries.push({ zone: land, target: { playerIndex: state.activePlayerIndex, type: 'land', index: 0 } });
    return entries;
}
export function targetZones(state: GameState, target: CardTarget): (PlacedCard | null)[] {
    return target.type === 'land' ? [activeLand(state) ?? null]
        : state.players[target.playerIndex]?.[target.type === 'pawn' ? 'pawnZones' : 'actionZones'] ?? [];
}
export const targetZone = (state: GameState, target: CardTarget): PlacedCard | null | undefined => targetZones(state, target)[target.index];
export const sourceZone = (state: GameState, context: CardContext): PlacedCard | undefined =>
    fieldEntries(state).find(entry => entry.zone.card.instanceId === context.card.instanceId)?.zone;
/** Remove one visible identity. Covered Lands cannot be removed through field targets. */
export function removeFieldIdentity(state: GameState, instanceId: string): Card | undefined {
    if (activeLand(state)?.card.instanceId === instanceId) return state.landStack!.pop()!.card;
    for (const player of state.players) for (const zones of [player.pawnZones, player.actionZones]) {
        const index = zones.findIndex(zone => zone?.card.instanceId === instanceId);
        if (index >= 0) { const card = zones[index]!.card; zones[index] = null; return card; }
    }
}
