import { Card, CardContext, CardType, ConditionSubtype, GameState, PawnSubtype } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { canPayLevelTribute } from '../../../game/levelTributes';
import { matchesCardGroup } from '../../../game/cardHelpers';

const matchesRouter = (card: Card) => card.pawnSubtype === PawnSubtype.VASSAL && matchesCardGroup(card, 'Router');
const payableRouter = (state: GameState, context: CardContext) => (card: Card) => matchesRouter(card)
    && canPayLevelTribute(state, { playerIndex: context.playerIndex, totalLevel: card.level, location: 'field' });

export default [{
    cardData: {
        id: 'C_Signal_Routing',
        name: 'Signal Routing',
        type: CardType.CONDITION,
        conditionSubtype: ConditionSubtype.CONTRACT,
        rarity: 'Epic',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Tribute Pawns you control whose levels total exactly the level of 1 "Router" Vassal in your Reserve, then Special Summon that Vassal from your Reserve.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].reserve.some(payableRouter(state, context)),
        onActivate: buildEffect([
            Effect.SelectReservePawn(PawnSubtype.VASSAL, matchesRouter, { location: 'field' }),
            Cost.TributeExactLevels((state, context) => state.players[context.playerIndex].reserve[context.reserveIndex!]?.level ?? NaN, { location: 'field' }),
            Effect.SummonFromReserve(PawnSubtype.VASSAL, matchesRouter)
        ])
    }
}] satisfies CardModule;
