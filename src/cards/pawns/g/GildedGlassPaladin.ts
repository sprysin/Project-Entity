import { Attribute, CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { fieldStats } from '../../../game/cardHelpers';
import { destroyFieldCard } from '../../../game/attachments';

export default [{
    cardData: {
        id: 'P_Gilded_Glass_Paladin', name: 'Gilded Glass Paladin', type: CardType.PAWN,
        attribute: Attribute.FIRE, pawnType: PawnType.WARRIOR, level: 8, atk: 0, def: 250, rarity: 'Legendary',
        effectText: 'This Pawn can attack directly. If this pawn succesfully completes an attack, target 1 face-up Pawn on your opponents field; destroy it and if you do they take damage equal to half that Pawns attack.'
    },
    effect: {
        canAttackDirectly: () => true,
        mandatoryReactions: true,
        onAttackCompleted: buildEffect([
            Require.Target('pawn', 'faceup', 'opponent'),
            (state, context) => {
                const target = context.targets?.[0] ?? context.target!;
                const zone = state.players[target.playerIndex].pawnZones[target.index];
                if (!zone || zone.position === Position.HIDDEN) return { halt: true };
                const damage = fieldStats(state, zone).atk / 2;
                destroyFieldCard(state, zone.card.instanceId);
                if (!state.players[target.playerIndex].pawnZones.some(value => value?.card.instanceId === zone.card.instanceId)) {
                    return Effect.DealDamage(target.playerIndex, damage)(state, context);
                }
            }
        ])
    }
}] satisfies CardModule;
