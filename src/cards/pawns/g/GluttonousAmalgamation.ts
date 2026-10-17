import { Attribute, Card, CardType, PawnSubtype, PawnType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { Require } from '../../engine/Requirements';
import { Query } from '../../engine/Queries';
import { matchesCardName, canTargetWithEffect } from '../../../game/cardHelpers';
import { CardModule } from '../../CardRegistry';

const oven = (card: Card) => matchesCardName(card, 'Monstrous Oven');
const counter = 'Oven Counters';

export default [{
    cardData: {
        id: 'P_Gluttonous_Amalgamation', name: 'Gluttonous Amalgamation', type: CardType.PAWN, pawnSubtype: PawnSubtype.VASSAL,
        attribute: Attribute.EARTH, pawnType: PawnType.PRIMAL, level: 10, atk: 280, def: 250, rarity: 'Epic',
        effectText: 'Pay half your LP and remove any number of counters from "Monstrous Oven"; this Pawn gains 50 ATK per counter removed until the end of this turn. Then target the same number of face-up Pawns your opponent controls; they become Primal.'
    },
    effect: {
        onActivate: buildEffect([
            Require.Target('action', 'faceup', 'active', 0, oven),
            Cost.PayLP((state, context) => state.players[context.playerIndex].lp / 2),
            Cost.RemoveCounters(counter, 'any', 0, (state, context) => state.players[1 - context.playerIndex].pawnZones.filter(zone => zone && zone.position !== Position.HIDDEN && canTargetWithEffect(zone.card)).length),
            Require.Targets(Query.CounterPayment(), 'pawn', 'opponent', 1),
            Effect.ModifySelfStats((state, context) => Query.CounterPayment()(state, context) * 50, 0, true),
            (state, context) => {
                for (let index = 1; index <= Query.CounterPayment()(state, context); index++) Effect.ChangeTargetPawnType(PawnType.PRIMAL, 'field', index)(state, context);
            }
        ])
    }
}] satisfies CardModule;

