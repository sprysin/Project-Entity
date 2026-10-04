import { GameState, Card, CardContext, PawnSubtype, PlacedCard, Player, Position, ShuffleLocation } from '../types';
import { cardRegistry } from '../cards/CardRegistry';

export const isToken = (card: Pick<Card, 'pawnSubtype'>): boolean => card.pawnSubtype === PawnSubtype.TOKEN;
export const canTribute = (card: Card): boolean => !card.cannotBeTributed && !card.tributeBlockedThisTurn;
export const canTributeForSummon = (card: Card, summoned: Card): boolean => canTribute(card) && (cardRegistry.getEffect(summoned.id)?.tributeSummonFilter?.(card) ?? true);
export const matchesCardName = (card: Card, name: string): boolean => card.name.toLowerCase() === name.toLowerCase();
export const matchesCardGroup = (card: Card, group: string): boolean => card.name.toLowerCase().includes(group.toLowerCase());
export const canTargetWithEffect = (card: Card): boolean => !card.effectTargetBlockedThisTurn;
export const canSetPawn = (card: Card): boolean => !isToken(card);

/** Current combat stats, including a card's continuous field modifier. */
export function fieldStats(state: GameState, placement: PlacedCard): { atk: number; def: number } {
    const { card } = placement;
    if (placement.position === Position.HIDDEN) return { atk: card.atk, def: card.def };
    const modifier = cardRegistry.getEffect(card.id)?.fieldStatModifier;
    if (!modifier) return { atk: card.atk, def: card.def };
    const playerIndex = state.players.findIndex(player => player.pawnZones.some(zone => zone?.card.instanceId === card.instanceId));
    if (playerIndex < 0) return { atk: card.atk, def: card.def };
    const bonus = modifier(state, { card, playerIndex }, placement);
    return { atk: Math.max(0, card.atk + (bonus.atk ?? 0)), def: Math.max(0, card.def + (bonus.def ?? 0)) };
}

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
    const { fieldAtkReduction, tributeBlockedThisTurn, effectTargetBlockedThisTurn, ...rest } = card;
    return { ...rest, atk: card.atk + (fieldAtkReduction ?? 0) };
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
