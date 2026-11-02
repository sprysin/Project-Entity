import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'P_Enchanted_Water_Lilly', name: 'Enchanted Water Lilly', type: CardType.PAWN,
        pawnType: PawnType.PLANT, attribute: Attribute.WATER, level: 2, rarity: 'Common', atk: 100, def: 140,
        effectText: 'When this card is tributed by another Pawn, gain LP equal to half its ATK.'
    },
    effect: {
        onTributedByPawn: (state, context) => {
            Effect.RestoreLP(context.playerIndex, context.card.atk / 2)(state, context);
        }
    }
}] satisfies CardModule;
