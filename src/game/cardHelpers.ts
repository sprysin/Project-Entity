import { GameState, Card, CardContext, PawnSubtype, PlacedCard, Player, Position, ShuffleLocation } from '../types';
import { cardRegistry } from '../cards/CardRegistry';

export const isToken = (card: Pick<Card, 'pawnSubtype'>): boolean => card.pawnSubtype === PawnSubtype.TOKEN;
export const canTribute = (card: Card): boolean => !card.cannotBeTributed;
export const canSetPawn = (card: Card): boolean => !isToken(card);

export function cardsAtLocation(player: Player, location: ShuffleLocation): { card: Card; index: number }[] {
    if (location === 'hand') return player.hand.map((card, index) => ({ card, index }));
    if (location === 'discard') return player.discard.map((card, index) => ({ card, index }));
    return [...player.pawnZones, ...player.actionZones].flatMap((zone, index) => zone ? [{ card: zone.card, index }] : []);
}

export function shuffleDeck(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

export function setPawnPosition(zone: PlacedCard, position: Position): void {
    if (position === Position.HIDDEN) {
        if (!canSetPawn(zone.card)) return;
        zone.hasUsedWhileOnField = false;
        delete zone.counters;
    }
    zone.position = position;
}

export function clearFieldReduction(card: Card): Card {
    if (card.fieldAtkReduction === undefined) return card;
    const { fieldAtkReduction, ...rest } = card;
    return { ...rest, atk: card.atk + fieldAtkReduction };
}

/**
 * Checks whether a card's activation conditions are met.
 * Shared by UI adapters without depending on React.
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
