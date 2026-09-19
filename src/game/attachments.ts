import { GameState } from '../types';

/** Destroy Attach cards whose recorded target is no longer on the field. */
export function destroyOrphanedAttachments(state: GameState): GameState {
    const fieldIds = new Set(state.players.flatMap(player =>
        [...player.pawnZones, ...player.actionZones].flatMap(zone => zone ? [zone.card.instanceId] : [])
    ));

    let destroyed = true;
    while (destroyed) {
        destroyed = false;
        for (const player of state.players) {
            player.actionZones.forEach((zone, index) => {
                if (!zone?.attachedToInstanceId || fieldIds.has(zone.attachedToInstanceId)) return;
                player.discard.push(zone.card);
                player.actionZones[index] = null;
                fieldIds.delete(zone.card.instanceId);
                destroyed = true;
            });
        }
    }

    return state;
}
