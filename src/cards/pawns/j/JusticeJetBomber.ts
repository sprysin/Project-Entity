import { ActionSubtype, Attribute, CardType, PawnType, Position } from '../../../types';
import { fieldEntries } from '../../../game/field';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Require } from '../../engine/Requirements';

export default [{
    cardData: {
        id: 'P_Justice_Jet_Bomber', name: 'Justice Jet Bomber', type: CardType.PAWN,
        rarity: 'Rare', level: 7, attribute: Attribute.AIR, pawnType: PawnType.MECHANICAL,
        atk: 200, def: 80,
        effectText: 'If you control another "Justice Jet" card, send 1 card you control to the Discard, then shuffle 2 "Jet Explosive" Bombs into your opponent’s deck. Jet Explosive: ON DRAW: Lose 80 life points. If you control an AIR Pawn, return it to the hand, then special summon this card from your hand.'
    },
    effect: {
        canActivate: (state, context) => fieldEntries(state).some(({ zone, target }) =>
            target.playerIndex === context.playerIndex && zone.position !== Position.HIDDEN
            && zone.card.instanceId !== context.card.instanceId && zone.card.name.includes('Justice Jet')),
        onActivate: buildEffect([
            Require.Target('any', 'both', 'active'), Effect.SendTargetToDiscard(),
            Effect.ShuffleBombsIntoDeck('A_Jet_Explosive', 2, (_state, context) => 1 - context.playerIndex)
        ]),
        canActivateFromHand: (state, context) => state.players[context.playerIndex].pawnZones.some(zone =>
            zone && zone.position !== Position.HIDDEN && zone.card.attribute === Attribute.AIR),
        onHandActivate: buildEffect([
            Require.Target('pawn', 'faceup', 'active', 0, card => card.attribute === Attribute.AIR),
            Effect.ReturnTargetToHand(), Effect.SpecialSummonSelfFromHand()
        ])
    }
}, {
    cardData: {
        id: 'A_Jet_Explosive', name: 'Jet Explosive', type: CardType.ACTION,
        actionSubtype: ActionSubtype.BOMB, rarity: 'Common', level: 0, atk: 0, def: 0,
        effectText: 'ON DRAW: Lose 80 life points.'
    },
    effect: { onDraw: buildEffect([Effect.LoseLP(80)]) }
}] satisfies CardModule;
