import { Card, GameState, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { sendToOwnerPile } from './cardOwnership';

/** Use the announcement snapshot so later attachments cannot catch an earlier activation. */
export function notifyAttachedActivation(before: GameState, after: GameState, activatedCard: Card): GameState {
    let next = after;
    before.players.forEach((player, playerIndex) => player.actionZones.forEach(zone => {
        if (!zone || zone.position === Position.HIDDEN || zone.attachedToInstanceId !== activatedCard.instanceId) return;
        const result = cardRegistry.getEffect(zone.card.id)?.onAttachedActivation?.(next, { card: zone.card, playerIndex, activatedCard });
        if (result && !result.halted) next = result.newState;
    }));
    return next;
}

/** Destroy Attach cards whose target left the field or turned face-down. */
export function destroyOrphanedAttachments(state: GameState): GameState {
    const field = () => new Map(state.players.flatMap(player =>
        [...player.pawnZones, ...player.actionZones].flatMap(zone => zone ? [[zone.card.instanceId, zone] as const] : [])
    ));

    let destroyed = true;
    while (destroyed) {
        destroyed = false;
        const fieldCards = field();
        for (const player of state.players) {
            player.actionZones.forEach((zone, index) => {
                if (!zone?.attachedToInstanceId) return;
                const target = fieldCards.get(zone.attachedToInstanceId);
                if (target && (target.position !== Position.HIDDEN || zone.card.survivesTargetFlip)) return;
                sendToOwnerPile(state, zone.card, 'discard');
                player.actionZones[index] = null;
                destroyed = true;
            });
        }
    }

    const activeAttachments = new Set(state.players.flatMap(player => player.actionZones.flatMap(zone =>
        zone?.attachedToInstanceId ? [zone.card.instanceId] : [])));
    for (const player of state.players) for (const zone of [...player.pawnZones, ...player.actionZones]) {
        if (!zone?.attachmentStatBonuses) continue;
        for (const bonus of zone.attachmentStatBonuses.filter(b => !activeAttachments.has(b.sourceInstanceId))) {
            zone.card.atk = Math.max(0, zone.card.atk - bonus.atk);
            zone.card.def = Math.max(0, zone.card.def - bonus.def);
        }
        zone.attachmentStatBonuses = zone.attachmentStatBonuses.filter(b => activeAttachments.has(b.sourceInstanceId));
    }

    return state;
}
