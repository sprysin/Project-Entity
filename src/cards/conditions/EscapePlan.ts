import { IEffect, CardType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Cost } from '../engine/Costs';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter(),
        (state, context) => {
            const attack = state.deferredAction;
            if (attack?.kind !== 'attack' || attack.targetId !== 'direct' || state.activePlayerIndex === context.playerIndex) return { halt: true };
            const attacker = state.players[state.activePlayerIndex].pawnZones.find(zone => zone?.card.instanceId === attack.attackerId);
            if (attacker) {
                if (attacker.attacksRemaining !== undefined) attacker.attacksRemaining -= 1;
                attacker.hasAttacked = attacker.attacksRemaining === undefined || attacker.attacksRemaining <= 0;
            }
            state.deferredAction = undefined;
        }
    ]),
    canActivate: (state, context) => state.deferredAction?.kind === 'attack'
        && state.deferredAction.targetId === 'direct'
        && state.activePlayerIndex !== context.playerIndex
        && state.players[context.playerIndex].hand.length > 0
};

cardRegistry.register({
    id: 'condition_05',
    name: 'Escape Plan',
    type: CardType.CONDITION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'When your Opponent declares a direct attack, discard 1 card then negate that attack.',
}, effect);
