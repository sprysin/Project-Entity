import { CardContext, EffectResult, GameState, IEffect, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { formatEffectLog } from './effectLog';

/** Observe an event once using the face-up sources present when it happened. */
export function notifyFieldEvent<K extends 'onEffectActivated' | 'onEffectDamage'>(
    state: GameState, event: K, details: Omit<Parameters<NonNullable<IEffect[K]>>[1], keyof CardContext>
): GameState {
    let next = state;
    const observers = state.players.flatMap((player, playerIndex) =>
        [...player.pawnZones, ...player.actionZones].flatMap(zone =>
            zone && zone.position !== Position.HIDDEN ? [{ card: zone.card, playerIndex }] : []));
    for (const context of observers) {
        const handler = cardRegistry.getEffect(context.card.id)?.[event] as
            ((state: GameState, context: Parameters<NonNullable<IEffect[K]>>[1]) => EffectResult) | undefined;
        if (!handler) continue;
        const result = handler(next, { ...context, ...details } as Parameters<typeof handler>[1]);
        if (!result.halted) {
            const log = formatEffectLog(next, result.newState, context.card, context, 'activate');
            next = { ...result.newState, log: [log, ...result.newState.log].slice(0, 50) };
        }
    }
    return next;
}
