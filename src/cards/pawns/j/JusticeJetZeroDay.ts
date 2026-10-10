import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition } from '../../engine/Requirements';

const id = 'P_Justice_Jet_Zero_Day';
const justiceJet = (card: { name: string }) => card.name.includes('Justice Jet');

export default [{
    cardData: {
        id,
        name: 'Justice Jet Zero Day',
        type: CardType.PAWN,
        rarity: 'Epic',
        level: 2,
        attribute: Attribute.AIR,
        pawnType: PawnType.MECHANICAL,
        atk: 10,
        def: 80,
        effectText: 'If you control no other Pawns; add 1 "Justice Jet" card to your hand, then send 1 card to the Discard. You can only use this effect of "Justice Jet Zero Day" once per turn.'
    }, effect: {
        canActivate: (state, context) => Condition.HardOncePerTurn(id)(state, context)
            && !state.players[context.playerIndex].pawnZones.some(zone => zone && zone.card.instanceId !== context.card.instanceId)
            && state.players[context.playerIndex].deck.some(justiceJet),
        onActivate: buildEffect([
            Effect.SetHardOncePerTurn(id), Effect.SearchDeck(justiceJet), Effect.DiscardFromHand()
        ])
    }
}] satisfies CardModule;
