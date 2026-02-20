import { GameState, Card, CardContext } from '../types';
import { cardRegistry } from '../src/cards/CardRegistry';

/**
 * Checks whether a card's activation conditions are met.
 * Replacement for the old cardEffects.checkActivationConditions.
 */
export const checkActivationConditions = (gameState: GameState, card: Card, playerIndex: number): boolean => {
    const effect = cardRegistry.getEffect(card.id);
    if (!effect?.canActivate) return true; // No restrictions = always activatable
    const context: CardContext = { card, playerIndex };
    return effect.canActivate(gameState, context);
};

/**
 * Checks if a card has an ignition (manual) effect that can be triggered from the field.
 */
export const hasOnActivateEffect = (card: Card): boolean => {
    const effect = cardRegistry.getEffect(card.id);
    return !!effect?.onActivate;
};
