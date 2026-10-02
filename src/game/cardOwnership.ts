import { Card, GameState } from '../types';
import { clearFieldReduction, isToken } from './cardHelpers';

/** Cards keep their original owner even while controlled by the other player. */
export function sendToOwnerPile(state: GameState, card: Card, pile: 'discard' | 'void' | 'hand' | 'deck'): void {
    if (isToken(card)) return;
    const owner = state.players.find(player => player.id === card.ownerId);
    const placement = state.players.flatMap(player => [...player.pawnZones, ...player.actionZones])
        .find(zone => zone?.card.instanceId === card.instanceId);
    const bonuses = placement?.attachmentStatBonuses ?? [];
    const cleared = clearFieldReduction(card);
    if (owner) owner[pile].push(bonuses.length ? { ...cleared,
        atk: Math.max(0, cleared.atk - bonuses.reduce((sum, bonus) => sum + bonus.atk, 0)),
        def: Math.max(0, cleared.def - bonuses.reduce((sum, bonus) => sum + bonus.def, 0))
    } : cleared);
}
