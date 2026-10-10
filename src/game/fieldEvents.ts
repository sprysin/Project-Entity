import { fieldEntries } from './field';
import { CardContext, EffectResult, GameState, IEffect, Position } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { formatEffectLog } from './effectLog';

/** Observe an event once using the face-up sources present when it happened. */
export function notifyFieldEvent<K extends 'onEffectActivated' | 'onEffectDamage' | 'onCardSentToHand'>(
    state: GameState, event: K, details: Omit<Parameters<NonNullable<IEffect[K]>>[1], keyof CardContext>
): GameState {
    let next = state;
    const observers = fieldEntries(state).flatMap(({ zone, target }) =>
        zone.position !== Position.HIDDEN ? [{ card: zone.card, playerIndex: target.playerIndex }] : []);
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
