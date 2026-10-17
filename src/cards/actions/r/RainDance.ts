import { ActionSubtype, Attribute, Card, CardType, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { canPayLevelTribute } from '../../../game/levelTributes';

const material = (card: Card) => card.attribute === Attribute.WATER || card.attribute === Attribute.ELECTRIC;
const reservePawn = (card: Card) => card.pawnSubtype === PawnSubtype.VASSAL && card.attribute === Attribute.ELECTRIC
    && card.pawnType === PawnType.AQUATIC && card.level === 7;

export default [{
    cardData: {
        id: 'A_Rain_Dance',
        name: 'Rain Dance',
        type: CardType.ACTION,
        actionSubtype: ActionSubtype.CONTRACT,
        rarity: 'Rare',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Tribute WATER or ELECTRIC Pawns from your hand or field whose levels total exactly 7, then Special Summon 1 ELECTRIC Aquatic Level 7 Pawn from your Reserve.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].reserve.some(reservePawn)
            && canPayLevelTribute(state, { playerIndex: context.playerIndex, totalLevel: 7, filter: material }),
        onActivate: buildEffect([
            Cost.TributeExactLevels(7, { filter: material }),
            Effect.SummonFromReserve(PawnSubtype.VASSAL, reservePawn)
        ])
    }
}] satisfies CardModule;
