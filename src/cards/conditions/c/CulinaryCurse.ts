import { CardType, PawnType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'C_Culinary_Curse',
        name: 'Culinary Curse',
        type: CardType.CONDITION,
        isLingering: true,
        rarity: 'Uncommon',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Whenever your opponent destroys a face-up Plant or Primal Pawn you control by battle or card effect, your opponent takes 25 damage.'
    },
    effect: {
        onActivate: buildEffect([]),
        onFieldCardDestroyed: (state, context) => {
            if (context.controllerIndex !== context.playerIndex || context.destroyingPlayerIndex === context.playerIndex
                || context.position === Position.HIDDEN || !['battle', 'effect'].includes(context.cause)
                || ![PawnType.PLANT, PawnType.PRIMAL].includes(context.destroyedCard.pawnType!)) return { newState: state, halted: true };
            return buildEffect([Effect.DealDamage(1 - context.playerIndex, 25)])(state, context);
        }
    }
}] satisfies CardModule;

