import { Card, CardType, PawnType, Phase, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { sourceZone, targetZone } from '../../../game/field';
import { canTargetWithEffect, fieldStats } from '../../../game/cardHelpers';

const eligible = (card: Card) => [PawnType.BEAST, PawnType.PRIMAL, PawnType.WARRIOR].includes(card.pawnType!);

export default [{
    cardData: {
        id: 'A_Big_Feast',
        name: 'Big Feast',
        type: CardType.ACTION,
        isAttached: true,
        rarity: 'Common',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Target 1 Beast, Primal, or Warrior Pawn on the field; its ATK and DEF are doubled. This Pawn cannot attack and is sent to the Discard during your next Standby Phase.'
    }, effect: {
        preventsAttachedPawnAttacks: true,
        canActivate: Condition.PawnMatchesFilter('both', zone => zone.position !== Position.HIDDEN && eligible(zone.card) && canTargetWithEffect(zone.card)),
        onActivate: buildEffect([
            Require.Target('pawn', 'faceup', 'both', 0, eligible), Effect.AttachToTarget(),
            (state, context) => {
                const source = sourceZone(state, context), target = context.target && targetZone(state, context.target);
                if (!source || !target) return { halt: true };
                const stats = fieldStats(state, target);
                Effect.ModifyTargetStats(stats.atk, stats.def)(state, context);
                source.attachedDueTurn = state.turnNumber + (state.activePlayerIndex === context.playerIndex ? 2 : 1);
            }
        ]),
        onPhaseChange: buildEffect([
            (state, context) => {
                const source = sourceZone(state, context);
                if (state.currentPhase !== Phase.STANDBY || state.activePlayerIndex !== context.playerIndex
                    || source?.attachedDueTurn === undefined || state.turnNumber < source.attachedDueTurn) return { halt: true };
                const index = state.players.findIndex(player => player.pawnZones.some(zone => zone && source.attachedToInstanceIds?.includes(zone.card.instanceId)));
                if (index < 0) return { halt: true };
                const slot = state.players[index].pawnZones.findIndex(zone => zone && source.attachedToInstanceIds?.includes(zone.card.instanceId));
                return Effect.SendTargetToDiscard()(state, { ...context, target: { playerIndex: index, type: 'pawn', index: slot } });
            }
        ])
    }
}] satisfies CardModule;
