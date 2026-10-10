import { activeLand, fieldEntries } from './field';
import { ActionSubtype, GameState, Card, CardContext, PawnSubtype, PlacedCard, Player, Position, ShuffleLocation } from '../types';
import { cardRegistry } from '../cards/CardRegistry';

export const isToken = (card: Pick<Card, 'pawnSubtype'>): boolean => card.pawnSubtype === PawnSubtype.TOKEN;
export const isBomb = (card: Pick<Card, 'actionSubtype'>): boolean => card.actionSubtype === ActionSubtype.BOMB;
export const isGeneratedCard = (card: Pick<Card, 'pawnSubtype' | 'actionSubtype'>): boolean => isToken(card) || isBomb(card);
export const isReservePawn = (card: Pick<Card, 'pawnSubtype'>): boolean => card.pawnSubtype === PawnSubtype.VASSAL;
export const canTribute = (card: Card): boolean => !card.cannotBeTributed && !card.tributeBlockedThisTurn;
export const canTributeForSummon = (card: Card, summoned: Card): boolean => canTribute(card) && (cardRegistry.getEffect(summoned.id)?.tributeSummonFilter?.(card) ?? true);
export const matchesCardName = (card: Card, name: string): boolean => card.name.toLowerCase() === name.toLowerCase();
export const matchesCardGroup = (card: Card, group: string): boolean => card.name.toLowerCase().includes(group.toLowerCase());
export const canTargetWithEffect = (card: Card): boolean => !card.effectTargetBlockedThisTurn;
export const canSetPawn = (card: Card): boolean => !isToken(card);

export const canPawnAttack = (state: GameState, playerIndex: number, zone: PlacedCard): boolean =>
    cardRegistry.getEffect(zone.card.id)?.canAttack?.(state, { card: zone.card, playerIndex }, zone) ?? true;

export const canAttackDirectly = (state: GameState, playerIndex: number, card: Card): boolean =>
    !state.players[1 - playerIndex].pawnZones.some(Boolean)
    || (cardRegistry.getEffect(card.id)?.canAttackDirectly?.(state, { card, playerIndex }) ?? false);

/** Both rows use left-to-right board indices, so equal indices share a column. */
export function opposingPawnInColumn(state: GameState, context: CardContext): PlacedCard | null {
    const index = state.players[context.playerIndex].pawnZones.findIndex(zone => zone?.card.instanceId === context.card.instanceId);
    return index < 0 ? null : state.players[1 - context.playerIndex].pawnZones[index];
}

/** Current combat stats, including a card's continuous field modifier. */
export function fieldStats(state: GameState, placement: PlacedCard): { atk: number; def: number } {
    const { card } = placement;
    if (placement.position === Position.HIDDEN) return { atk: placement.attackOverride?.turn === state.turnNumber ? placement.attackOverride.value : card.atk, def: card.def };
    const modifier = cardRegistry.getEffect(card.id)?.fieldStatModifier;
    const playerIndex = state.players.findIndex(player => player.pawnZones.some(zone => zone?.card.instanceId === card.instanceId));
    if (playerIndex < 0) return { atk: card.atk, def: card.def };
    const bonus = modifier?.(state, { card, playerIndex }, placement) ?? {};
    let atk = card.atk + (bonus.atk ?? 0), def = card.def + (bonus.def ?? 0);
    for (const entry of fieldEntries(state)) {
        if (entry.zone.position === Position.HIDDEN) continue;
        const modifier = cardRegistry.getEffect(entry.zone.card.id)?.LingeringStatModifier?.(state,
            { card: entry.zone.card, playerIndex: entry.target.playerIndex }, placement, playerIndex);
        atk += modifier?.atk ?? 0; def += modifier?.def ?? 0;
    }
    return { atk: Math.max(0, placement.attackOverride?.turn === state.turnNumber ? placement.attackOverride.value : atk), def: Math.max(0, def) };
}

export function cardsAtLocation(player: Player, location: ShuffleLocation, state?: GameState): { card: Card; index: number }[] {
    if (location === 'hand') return player.hand.map((card, index) => ({ card, index }));
    if (location === 'discard') return player.discard.map((card, index) => ({ card, index }));
    return [...player.pawnZones, ...player.actionZones, ...(state ? [activeLand(state)] : [])].flatMap((zone, index) => zone ? [{ card: zone.card, index }] : []);
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
    const { fieldAtkReduction, fieldOriginalAttribute, tributeBlockedThisTurn, effectTargetBlockedThisTurn, ...rest } = card;
    return { ...rest, atk: card.atk + (fieldAtkReduction ?? 0), ...(fieldOriginalAttribute === undefined ? {} : { attribute: fieldOriginalAttribute }) };
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
