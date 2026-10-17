import { CardType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';
import { canTribute } from '../../../game/cardHelpers';

export default [{
    cardData: {
        id: 'A_For_The_Greater_Good',
        name: 'For the Greater Good',
        type: CardType.ACTION,
        rarity: 'Rare',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Discard 1 card and tribute 1 Level 3 or lower Pawn; Special Summon 1 Level 4 or lower Pawn from your Discard pile.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].hand.some(card => card.instanceId !== context.card.instanceId)
            && state.players[context.playerIndex].pawnZones.some(zone => zone && zone.card.level <= 3 && canTribute(zone.card)),
        onActivate: buildEffect([Cost.DiscardCardFilter(), Cost.TributePawns(1, card => card.level <= 3),
        Effect.SpecialSummonFromDiscard(card => card.level <= 4)])
    }
}] satisfies CardModule;

