import { CardType, IEffect, PawnType, Phase, Position } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildCondition, buildEffect } from '../engine/Builder';
import { Condition, Require } from '../engine/Requirements';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('pawn'),
        Require.TargetMatchesPosition(Position.HIDDEN, true),
        Effect.AttachToTarget(),
        Effect.ModifyTargetStats(40, 0)
    ]),
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('both', zone => zone.position !== Position.HIDDEN)
    ]),
    onPhaseChange: buildEffect([
        (state, { card, playerIndex }) => {
            if (state.currentPhase !== Phase.STANDBY) return { halt: true };
            const source = state.players[playerIndex].actionZones.find(zone => zone?.card.instanceId === card.instanceId);
            const target = state.players.flatMap(player => player.pawnZones)
                .find(zone => zone?.card.instanceId === source?.attachedToInstanceIds?.[0]);
            if (!target || target.position === Position.HIDDEN || target.card.pawnType === PawnType.WARRIOR) return { halt: true };
            target.card.atk = Math.max(0, target.card.atk - 20);
        }
    ])
};

export default [{
    cardData: {
        id: 'action_withering_sword',
        name: 'Withering Sword',
        type: CardType.ACTION,
        rarity: 'Common',
        isAttached: true,
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Attach to 1 face-up Pawn on the field; it gains 40 ATK. During each Standby Phase, decrease the attached Pawn\'s ATK by 20 unless it is a Warrior Pawn.'
    }, effect
}] satisfies CardModule;
