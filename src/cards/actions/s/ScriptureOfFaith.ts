import { ActionSubtype, CardType, IEffect, PawnSubtype } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { canPayLevelTribute } from '../../../game/levelTributes';
import { matchesCardName } from '../../../game/cardHelpers';

const matchesPatron = (card: Parameters<typeof matchesCardName>[0]) => matchesCardName(card, 'Patron of Judgement');
const effect: IEffect = {
    canActivate: (state, context) => {
        const player = state.players[context.playerIndex];
        if (!player.reserve.some(card => card.pawnSubtype === PawnSubtype.VASSAL && matchesPatron(card))) return false;
        return canPayLevelTribute(state, { playerIndex: context.playerIndex, totalLevel: 10 });
    },
    onActivate: buildEffect([Cost.TributeExactLevels(10), Effect.SummonFromReserve(PawnSubtype.VASSAL, matchesPatron)])
};

export default [{
    cardData: {
        id: 'A_Scripture_Of_Faith',
        name: 'Scripture of faith',
        type: CardType.ACTION,
        actionSubtype: ActionSubtype.CONTRACT,
        rarity: 'Epic',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Tribute Pawns from your hand or field whose levels total exactly 10, then Vassal summon "Patron of Judgement" from your Reserve.'
    },
    effect
}] satisfies CardModule;
