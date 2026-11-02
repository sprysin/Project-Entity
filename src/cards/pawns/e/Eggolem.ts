import { Attribute, CardType, PawnType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'P_Eggolem', name: 'Eggolem', type: CardType.PAWN, attribute: Attribute.EARTH, pawnType: PawnType.PRIMAL,
        level: 8, atk: 150, def: 210, rarity: 'Rare',
        effectText: 'Once per turn: Target 1 face-up Pawn your opponent controls; it becomes Primal type. If this card is destroyed, Special Summon 1 Level 1 Primal or Plant Pawn from your Discard.'
    },
    effect: {
        mandatoryReactions: ['destroyed'],
        canActivate: (state, context) => state.pendingReactions?.some(entry => entry.card.instanceId === context.card.instanceId && entry.trigger === 'destroyed')
            || Condition.SoftOncePerTurn()(state, context),
        onActivate: buildEffect([Require.Target('pawn', 'faceup', 'opponent'), Effect.SetSoftOncePerTurn(),
            Effect.ChangePawnInfo({ pawnType: PawnType.PRIMAL })]),
        onDestroyed: buildEffect([Effect.SpecialSummonFromDiscard(card => card.level === 1
            && (card.pawnType === PawnType.PRIMAL || card.pawnType === PawnType.PLANT))])
    }
}] satisfies CardModule;

