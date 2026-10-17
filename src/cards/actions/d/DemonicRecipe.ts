import { ActionSubtype, Card, CardType, PawnSubtype } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { canPayLevelTribute } from '../../../game/levelTributes';
import { matchesCardName } from '../../../game/cardHelpers';
import { CardModule } from '../../CardRegistry';

const amalgamation = (card: Card) => matchesCardName(card, 'Gluttonous Amalgamation');

export default [{
    cardData: {
        id: 'A_Demonic_Recipe', name: 'Demonic Recipe', type: CardType.ACTION, actionSubtype: ActionSubtype.CONTRACT, rarity: 'Rare', level: 0, atk: 0, def: 0,
        effectText: 'Send Pawns from your hand or field whose levels total exactly 10 to the Discard pile, then Vassal Summon "Gluttonous Amalgamation" from your Reserve.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].reserve.some(card => card.pawnSubtype === PawnSubtype.VASSAL && amalgamation(card))
            && canPayLevelTribute(state, { playerIndex: context.playerIndex, totalLevel: 10, sendOnly: true }),
        onActivate: buildEffect([Cost.SendExactLevels(10), Effect.SummonFromReserve(PawnSubtype.VASSAL, amalgamation)])
    }
}] satisfies CardModule;

