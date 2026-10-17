import { Attribute, CardType, PawnType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'P_Dragonion', name: 'Dragonion', type: CardType.PAWN, attribute: Attribute.AIR, pawnType: PawnType.PLANT,
        level: 9, atk: 270, def: 150, rarity: 'Epic',
        effectText: 'Once per turn: discard 1 card; target 1 face-up Primal Pawn your opponent controls and destroy it.'
    },
    effect: {
        canActivate: (state, context) => Condition.SoftOncePerTurn()(state, context) && state.players[context.playerIndex].hand.length > 0
            && Condition.PawnMatchesFilter('opponent', zone => zone.position !== Position.HIDDEN && zone.card.pawnType === PawnType.PRIMAL)(state, context),
        onActivate: buildEffect([Effect.SetSoftOncePerTurn(), Cost.DiscardCardFilter(),
            Require.Target('pawn', 'faceup', 'opponent', 0, card => card.pawnType === PawnType.PRIMAL), Effect.DestroyTarget()])
    }
}] satisfies CardModule;

