import { fieldEntries, removeFieldIdentity } from './field';
import { Card, GameState, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { sendToOwnerPile } from './cardOwnership';

/** Destroy a field identity and notify its face-up attachments before orphan cleanup. */
export function destroyFieldCard(state: GameState, instanceId: string): void {
    for (const { zone } of fieldEntries(state)) {
        if (zone.card.instanceId !== instanceId) continue;
        const card = zone.card;
        state.destroyedCardIds = [...(state.destroyedCardIds ?? []), instanceId];
        sendToOwnerPile(state, card, 'discard');
        removeFieldIdentity(state, instanceId);
        const owner = state.players.findIndex(candidate => candidate.discard.some(value => value.instanceId === card.instanceId));
        if (owner >= 0 && cardRegistry.getEffect(card.id)?.onDestroyed) {
            state.pendingReactions = [...(state.pendingReactions ?? []), { card, playerIndex: owner, trigger: 'destroyed' }];
        }
        const observers = state.players.flatMap((controller, playerIndex) => controller.actionZones.flatMap(attachment =>
            attachment && attachment.position !== Position.HIDDEN && attachment.attachedToInstanceIds?.includes(instanceId)
                ? [{ attachment, playerIndex, attachedInstanceIds: [...attachment.attachedToInstanceIds] }] : []));
        for (const { attachment, playerIndex, attachedInstanceIds } of observers) {
            if (!state.players[playerIndex].actionZones.some(zone => zone?.card.instanceId === attachment.card.instanceId)) continue;
            cardRegistry.getEffect(attachment.card.id)?.onAttachedDestroyed?.(state, {
                card: attachment.card, playerIndex, destroyedCard: card, attachedInstanceIds
            });
        }
        destroyOrphanedAttachments(state);
        return;
    }
}

/** Use the announcement snapshot so later attachments cannot catch an earlier activation. */
export function notifyAttachedActivation(before: GameState, after: GameState, activatedCard: Card): GameState {
    let next = after;
    before.players.forEach((player, playerIndex) => player.actionZones.forEach(zone => {
        if (!zone || zone.position === Position.HIDDEN || !zone.attachedToInstanceIds?.includes(activatedCard.instanceId)) return;
        const result = cardRegistry.getEffect(zone.card.id)?.onAttachedActivation?.(next, { card: zone.card, playerIndex, activatedCard });
        if (result && !result.halted) next = result.newState;
    }));
    return next;
}

/** Destroy Attach cards whose target left the field or turned face-down. */
export function destroyOrphanedAttachments(state: GameState): GameState {
    const field = () => new Map(fieldEntries(state).map(({ zone }) => [zone.card.instanceId, zone] as const));

    let destroyed = true;
    while (destroyed) {
        destroyed = false;
        const fieldCards = field();
        for (const player of state.players) {
            player.actionZones.forEach(zone => {
                if (!zone?.attachedToInstanceIds?.length) return;
                if (zone.attachedToInstanceIds.every(id => {
                    const target = fieldCards.get(id);
                    return target && (target.position !== Position.HIDDEN || zone.card.survivesTargetFlip);
                })) return;
                destroyFieldCard(state, zone.card.instanceId);
                destroyed = true;
            });
        }
    }

    const activeAttachments = new Set(state.players.flatMap(player => player.actionZones.flatMap(zone =>
        zone?.attachedToInstanceIds?.length ? [zone.card.instanceId] : [])));
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
