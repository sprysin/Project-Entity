import { CardType, PawnType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'C_What_Grows_In_The_Graveyard',
        name: 'What Grows in the Graveyard',
        type: CardType.CONDITION,
        isAttached: true,
        rarity: 'Relic',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Void 1 Plant Pawn from your hand; all Undead Pawns in your Discard pile become Plant. Then Special Summon 1 Plant Pawn from your Discard pile and attach this card to it.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].pawnZones.includes(null)
            && state.players[context.playerIndex].hand.some(card => card.type === CardType.PAWN && card.pawnType === PawnType.PLANT)
            && state.players[context.playerIndex].discard.some(card => card.type === CardType.PAWN && [PawnType.PLANT, PawnType.UNDEAD].includes(card.pawnType!)),
        onActivate: buildEffect([Cost.VoidHandCard(card => card.type === CardType.PAWN && card.pawnType === PawnType.PLANT),
        Effect.ChangeDiscardPawnTypes(PawnType.UNDEAD, PawnType.PLANT),
        Effect.SpecialSummonFromDiscard(card => card.pawnType === PawnType.PLANT, true)])
    }
}] satisfies CardModule;

