import { Card, GameState } from '../types';
import { clearFieldReduction, isGeneratedCard } from './cardHelpers';
import { cardRegistry } from '../cards/CardRegistry';
import { notifyFieldEvent } from './fieldEvents';

/** Cards keep their original owner even while controlled by the other player. */
export function sendToOwnerPile(state: GameState, card: Card, pile: 'discard' | 'void' | 'hand' | 'deck'): void {
    if (isGeneratedCard(card)) return;
    const owner = state.players.find(player => player.id === card.ownerId);
    const placement = state.players.flatMap(player => [...player.pawnZones, ...player.actionZones])
        .find(zone => zone?.card.instanceId === card.instanceId);
    const bonuses = placement?.attachmentStatBonuses ?? [];
    const cleared = { ...clearFieldReduction(card) };
    const temporaryStats = state.pendingEffects.filter(effect => effect.targetInstanceId === card.instanceId);
    for (const effect of temporaryStats) {
        const stat = effect.type === 'RESET_ATK' ? 'atk' : 'def';
        cleared[stat] = effect.delta === undefined ? effect.value : cleared[stat] - effect.delta;
    }
    state.pendingEffects = state.pendingEffects.filter(effect => !temporaryStats.includes(effect));
    if (owner) owner[pile].push(bonuses.length ? { ...cleared,
        atk: Math.max(0, cleared.atk - bonuses.reduce((sum, bonus) => sum + bonus.atk, 0)),
        def: Math.max(0, cleared.def - bonuses.reduce((sum, bonus) => sum + bonus.def, 0))
    } : cleared);
    if (owner && pile === 'discard' && cardRegistry.getEffect(card.id)?.onSentToDiscard) {
        state.pendingReactions = [...(state.pendingReactions ?? []), {
            card: cleared, playerIndex: state.players.indexOf(owner), trigger: 'sent_discard'
        }];
    }
    if (owner && pile === 'hand') Object.assign(state, notifyFieldEvent(state, 'onCardSentToHand', {
        returnedCard: cleared, receivingPlayerIndex: state.players.indexOf(owner)
    }));
}
