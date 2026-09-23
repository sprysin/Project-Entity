import { cardRegistry } from '../cards/CardRegistry';
import { GameState, Position } from '../types';

/** Collect Pawn reveals from any command or card effect. Battle handles cards destroyed by that same attack. */
export function queueRevealedSwitches(before: GameState, after: GameState): GameState {
    if (before === after) return after;
    const pending = [...(after.pendingSwitches ?? [])];
    after.players.forEach((player, playerIndex) => player.pawnZones.forEach(zone => {
        if (!zone || zone.position === Position.HIDDEN || !cardRegistry.getEffect(zone.card.id)?.onSwitch) return;
        const prior = before.players.flatMap(p => p.pawnZones).find(old => old?.card.instanceId === zone.card.instanceId);
        if (prior?.position === Position.HIDDEN && !pending.some(entry => entry.card.instanceId === zone.card.instanceId)) {
            pending.push({ card: zone.card, playerIndex });
        }
    }));
    return pending.length === (after.pendingSwitches?.length ?? 0) ? after : { ...after, pendingSwitches: pending };
}
