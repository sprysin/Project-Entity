import { CardContext, CardTarget } from '../../types';

/** Returns a selected target while preserving the original single-target API. */
export const getEffectTarget = (context: CardContext, index = 0): CardTarget | undefined =>
    context.targets?.[index] ?? (index === 0 ? context.target : undefined);
