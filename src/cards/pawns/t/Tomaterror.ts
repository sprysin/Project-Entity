import { Attribute, CardType, PawnType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'P_Tomaterror', name: 'Tomaterror', type: CardType.PAWN, attribute: Attribute.EARTH, pawnType: PawnType.PLANT,
        level: 1, atk: 30, def: 30, rarity: 'Common',
        effectText: 'Pay 100 LP; Special Summon 1 Level 1 Primal or Plant Pawn from your hand.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].lp >= 100 && state.players[context.playerIndex].pawnZones.includes(null)
            && state.players[context.playerIndex].hand.some(card => card.type === CardType.PAWN && card.level === 1 && [PawnType.PLANT, PawnType.PRIMAL].includes(card.pawnType!)),
        onActivate: buildEffect([Cost.PayLP(100), Effect.SpecialSummonFromHand(card => card.level === 1
        && (card.pawnType === PawnType.PRIMAL || card.pawnType === PawnType.PLANT))]) }
}] satisfies CardModule;

