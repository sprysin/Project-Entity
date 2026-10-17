import { Card, CardType, PawnType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { Condition, Require } from '../../engine/Requirements';
import { sourceZone } from '../../../game/field';
import { CardModule } from '../../CardRegistry';

const duelType = (card: Card) => card.pawnType === PawnType.PLANT || card.pawnType === PawnType.PRIMAL;

export default [{
    cardData: {
        id: 'A_Monstrous_Oven',
        name: 'Monstrous Oven',
        type: CardType.ACTION,
        rarity: 'Legendary',
        isLingering: true,
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Once per turn: discard 1 card, target 1 face-up Primal or Plant Pawn on either field; send it to the Discard pile. If a Pawn is sent to the Discard pile by this effect, put 1 Oven Counter on this card.'
    },
    effect: {
        canActivate: (state, context) => !sourceZone(state, context) || Condition.SoftOncePerTurn()(state, context)
            && state.players[context.playerIndex].hand.length > 0
            && Condition.PawnMatchesFilter('both', zone => zone.position !== Position.HIDDEN && duelType(zone.card))(state, context),
        onFieldActivate: buildEffect([
            Effect.RequireFaceUpSource(),
            Effect.SetSoftOncePerTurn(),
            Cost.DiscardCardFilter(),
            Require.Target('pawn', 'faceup', 'both', 0, duelType),
            Effect.SendTargetToDiscard(0, Effect.ModulateCounter('Oven Counters', 1))
        ])
    }
}] satisfies CardModule;

