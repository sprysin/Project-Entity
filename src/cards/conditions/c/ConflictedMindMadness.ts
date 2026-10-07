import { CardType, IEffect, Phase, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        (state, context) => Require.Target('action', 'faceup', 'both', 0,
            card => card.instanceId !== context.card.instanceId)(state, context),
        Effect.AttachToTarget()
    ]),
    onPhaseChange: buildEffect([
        (state, context) => {
            if (state.currentPhase !== Phase.STANDBY) return { halt: true };
            const zones = state.players.flatMap(player => player.actionZones);
            const source = zones.find(zone => zone?.card.instanceId === context.card.instanceId);
            const target = zones.find(zone => zone?.card.instanceId === source?.attachedToInstanceIds?.[0]);
            if (!source || source.position === Position.HIDDEN || !target || target.position === Position.HIDDEN) return { halt: true };
            const owner = state.players.findIndex(player => player.id === target.card.ownerId);
            if (owner < 0) return { halt: true };
            return Effect.DealDamage(owner, 10)(state, context);
        }
    ]),
    onAttachedActivation: (state, { card, activatedCard }) => {
        const playerIndex = state.players.findIndex(player => player.id === card.ownerId);
        const pilePlayerIndex = state.players.findIndex(player => player.id === activatedCard.ownerId);
        if (playerIndex < 0 || pilePlayerIndex < 0 || !state.players[pilePlayerIndex].discard.length) return { newState: state };
        return {
            newState: {
                ...state, pendingVoidSelections: [...(state.pendingVoidSelections ?? []),
                { source: card, playerIndex, pilePlayerIndex }]
            }
        };
    }
};

export default [
{ cardData: {
    id: 'condition_07', name: 'Conflicted Mind Madness', type: CardType.CONDITION, rarity: 'Rare',
    isAttached: true, level: 0, atk: 0, def: 0,
    effectText: 'Target 1 face-up Action/Condition, during each Standby Phase deal 10 damage to the owner of the target. If the target activates an additional effect Void 1 card from the owners Discard pile.'
}, effect }
] satisfies CardModule;
