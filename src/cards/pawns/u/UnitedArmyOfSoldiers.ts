import { Attribute, Card, CardType, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition, Require } from '../../engine/Requirements';
import { matchesCardGroup } from '../../../game/cardHelpers';

const soldier = (card: Card) => card.type === CardType.PAWN && matchesCardGroup(card, 'Soldier');

export default [{
    cardData: {
        id: 'P_United_Army_Of_Soldiers',
        name: 'United Army of Soldiers',
        type: CardType.PAWN,
        pawnSubtype: PawnSubtype.MERGE,
        mergeMaterials: ['Infantry Soldier', 'Infantry Soldier', 'Infantry Soldier'],
        rarity: 'Relic',
        level: 5,
        attribute: Attribute.NORMAL,
        pawnType: PawnType.WARRIOR,
        atk: 300,
        def: 250,
        effectText: 'Once while on the field: target 1 card on the field; destroy it. If this card is destroyed and sent to the Discard, you can Special Summon up to 2 "Soldier" Pawns from your Discard to your field.'
    },
    effect: {
        canActivate: (state, context) => state.pendingReactions?.some(entry => entry.card.instanceId === context.card.instanceId && entry.trigger === 'destroyed')
            || Condition.OnceWhileOnField()(state, context),
        onActivate: buildEffect([Require.Target('any'), Effect.SetOnceWhileOnField(), Effect.DestroyTarget()]),
        onDestroyed: buildEffect([Effect.SpecialSummonCards('discard', soldier, 2)])
    }
}] satisfies CardModule;
