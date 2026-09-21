import { Attribute, CardType, IEffect, PawnType, Phase } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';
import { Condition } from '../engine/Requirements';

const CARD_ID = 'pawn_11';

const effect: IEffect = {
    timing: 'quick',
    onActivate: buildEffect([
        Cost.DestroySelf(),
        Effect.SetHardOncePerTurn(CARD_ID),
        Effect.PeekOpponentHand()
    ]),
    canActivate: (state, context) =>
        (state.currentPhase === Phase.MAIN1 || state.currentPhase === Phase.MAIN2)
        && state.players[1 - context.playerIndex].hand.length > 0
        && Condition.HardOncePerTurn(CARD_ID)(state, context)
};

cardRegistry.register({
    id: CARD_ID,
    name: 'Glass Witch',
    type: CardType.PAWN,
    level: 4,
    attribute: Attribute.AIR,
    pawnType: PawnType.MAGICIAN,
    atk: 0,
    def: 110,
    effectText: 'During either player\'s Main Phase: You can destroy this card; then your opponent selects 1 card in their hand for you to view. You can only activate the effect of "Glass Witch" once per turn.'
}, effect);
