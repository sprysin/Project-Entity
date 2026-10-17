import { CardType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'C_Cast_To_Oblivion',
        name: 'Cast to Oblivion',
        type: CardType.CONDITION,
        rarity: 'Uncommon',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Void 3 Pawns from your Discard pile; gain 30 LP, then all Pawns your opponent controls lose 30 ATK until the end of this turn.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].discard.filter(card => card.type === CardType.PAWN).length >= 3,
        onActivate: buildEffect([Cost.VoidDiscardCards(3, card => card.type === CardType.PAWN),
        Effect.RestoreLP((_state, context) => context.playerIndex, 30),
        Effect.ModifyAllPawnStats('opponent', -30, 0, 'end_of_turn')])
    }
}] satisfies CardModule;

