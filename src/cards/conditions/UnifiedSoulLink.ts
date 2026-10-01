import { Card, CardType, IEffect, PawnType, Position } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildCondition, buildEffect } from '../engine/Builder';
import { Condition, Require } from '../engine/Requirements';
import { Effect } from '../engine/Effects';
import { destroyFieldCard } from '../../game/attachments';

const eligible = (card: Card) => card.pawnType === PawnType.UNDEAD || card.pawnType === PawnType.ELEMENTAL;
const effect: IEffect = {
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('active', zone => zone.position !== Position.HIDDEN && eligible(zone.card)),
        Condition.PawnMatchesFilter('opponent', zone => zone.position !== Position.HIDDEN)
    ]),
    onActivate: buildEffect([
        Require.Target('pawn', 'faceup', 'active', 0, eligible),
        Require.Target('pawn', 'faceup', 'opponent', 1),
        Effect.AttachToTarget(),
        Effect.AttachToTarget(1)
    ]),
    onAttachedDestroyed: (state, { card, attachedInstanceIds }) => {
        destroyFieldCard(state, card.instanceId);
        for (const instanceId of attachedInstanceIds) destroyFieldCard(state, instanceId);
    }
};

export default [{
    cardData: {
        id: 'condition_08',
        name: 'Unified Soul Link', type: CardType.CONDITION, rarity: 'Epic',
        isAttached: true,
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Target 1 face-up Undead or Elemental type pawn on your field, and 1 face-up pawn on your opponents field, when either pawn is destroyed, destroy this card as well as the other pawn.'
    }, effect
}] satisfies CardModule;
