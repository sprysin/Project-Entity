import { GameState, CardContext } from '../../../types';

export type Dynamic<T> = T | ((state: GameState, context: CardContext) => T);

export const resolveDynamic = <T>(val: Dynamic<T>, state: GameState, context: CardContext): T => {
    return typeof val === 'function' ? (val as Function)(state, context) : val;
};
