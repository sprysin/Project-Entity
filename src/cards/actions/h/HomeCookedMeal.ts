import { CardType, PawnType, Position } from '../../../types';

import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'A_Home_Cooked_Meal',
        name: 'Home Cooked Meal',
        type: CardType.ACTION,
        rarity: 'Uncommon',
        isLingering: true,
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'All Beast Pawns your opponent controls become Primal. All Pawns your opponent controls lose 10 ATK for each Plant or Primal Pawn they control.'
    },
    effect: {
        pawnTypeModifier: (_state, context, target, controllerIndex) =>
            controllerIndex !== context.playerIndex && target.card.pawnType === PawnType.BEAST ? PawnType.PRIMAL : undefined,
        LingeringStatModifier: (state, context, _target, controllerIndex) =>
            controllerIndex === context.playerIndex ? {} : ({
                atk: -10 * state.players[controllerIndex].pawnZones.filter(zone => zone && zone.position !== Position.HIDDEN
                    && (zone.card.pawnType === PawnType.PLANT || zone.card.pawnType === PawnType.PRIMAL)).length
            })
    }
}] satisfies CardModule;

