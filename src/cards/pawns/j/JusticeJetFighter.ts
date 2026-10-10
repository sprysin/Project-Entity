import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition, Require } from '../../engine/Requirements';

const id = 'P_Justice_Jet_Fighter';

export default [{
    cardData: {
        id,
        name: 'Justice Jet Fighter',
        type: CardType.PAWN,
        rarity: 'Uncommon',
        level: 4,
        attribute: Attribute.AIR,
        pawnType: PawnType.MECHANICAL,
        atk: 110,
        def: 80,
        effectText: 'If this Pawn is special summoned double it\'s ATK until the end of the turn. If you control an AIR pawn return it to the hand, then special summon this card from your hand.  You can only use this effect of "Justice Jet Fighter" once per turn.'
    }, effect: {
        canActivateFromHand: (state, context) => Condition.HardOncePerTurn(id)(state, context)
            && state.players[context.playerIndex].pawnZones.some(zone => zone?.card.attribute === Attribute.AIR),
        onHandActivate: buildEffect([
            Effect.SetHardOncePerTurn(id),
            Require.Target('pawn', 'faceup', 'active', 0, card => card.attribute === Attribute.AIR),
            Effect.ReturnTargetToHand(), Effect.SpecialSummonSelfFromHand()
        ]),
        onSpecialSummon: buildEffect([Effect.MultiplySelfAttackForTurn(2)])
    }
}] satisfies CardModule;
