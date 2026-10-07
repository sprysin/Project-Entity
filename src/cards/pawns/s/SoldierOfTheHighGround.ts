import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Cost } from '../../engine/Costs';
import { Condition, Require } from '../../engine/Requirements';
import { canTargetWithEffect, matchesCardGroup, matchesCardName } from '../../../game/cardHelpers';

export default [{
    effect: {
        tributeSummonFilter: card => card.type === CardType.PAWN && matchesCardGroup(card, 'Soldier'),
        canActivate: (state, context) => state.pendingReactions?.some(entry => entry.card.instanceId === context.card.instanceId && entry.trigger === 'destroyed')
            ? state.players[context.playerIndex].discard.some(card => matchesCardName(card, 'Infantry Soldier'))
            : Condition.OnceWhileOnField()(state, context) && state.players.some(player => player.actionZones.some(zone => zone && canTargetWithEffect(zone.card))),
        onActivate: buildEffect([Require.Target('action'), Effect.SetOnceWhileOnField(), Effect.DestroyTarget()]),
        onDestroyed: buildEffect([Cost.SelectDiscardRecovery(card => matchesCardName(card, 'Infantry Soldier')), Effect.RecoverFromDiscardToHand()])
    },
    cardData: {
        id: 'pawn_soldier_of_the_high_ground',
        name: 'Soldier of the High Ground',
        type: CardType.PAWN,
        rarity: 'Epic',
        attribute: Attribute.NORMAL,
        pawnType: PawnType.WARRIOR,
        level: 5,
        atk: 190,
        def: 190,
        effectText: 'Cannot be tribute summoned unless you tribute a "Soldier" Pawn. Once while on the field: target 1 card in the Action Zone; destroy it. If this card is destroyed and sent to the Discard, add 1 "Infantry Soldier" from your Discard to your hand.'
    }
}] satisfies CardModule;
