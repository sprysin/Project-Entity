import { CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'A_Hunters_Spoils',
        name: "Hunter's Spoils",
        type: CardType.ACTION,
        rarity: 'Common',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Target up to 3 Beast Pawns in your Discard Pile; shuffle them into the deck, then gain 20 LP for each card shuffled.'
    },
    effect: {
        onActivate: buildEffect([
            Effect.ShuffleFrom('discard', 3, card => card.type === CardType.PAWN && card.pawnType === PawnType.BEAST, true),
            Effect.RestoreLP((_state, context) => context.playerIndex, (_state, context) => (context.shuffleCardIds?.length ?? 0) * 20)
        ])
    }
}] satisfies CardModule;
