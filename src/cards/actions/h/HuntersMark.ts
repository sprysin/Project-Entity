import { PawnType, CardType, Phase, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildCondition, buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { canTargetWithEffect } from '../../../game/cardHelpers';

const id = 'A_Hunters_Mark';
const eligible = (card: { pawnType?: PawnType }) => card.pawnType === PawnType.WARRIOR || card.pawnType === PawnType.BEAST;

export default [{
    cardData: {
        id, name: "Hunter's Mark", type: CardType.ACTION, rarity: 'Rare', level: 0, atk: 0, def: 0,
        effectText: 'Target 1 Pawn your opponent controls, then target 1 Warrior or Beast Pawn you control; your Pawn gains 30 ATK for the turn. If your Pawn destroys the other target by battle this turn, draw 2 cards. You can only use "Hunter\'s Mark" once per turn.'
    },
    effect: {
        canActivate: buildCondition([
            Condition.HardOncePerTurn(id),
            Condition.PawnMatchesFilter('opponent', zone => canTargetWithEffect(zone.card)),
            Condition.PawnMatchesFilter('active', zone => zone.position !== Position.HIDDEN && eligible(zone.card) && canTargetWithEffect(zone.card))
        ]),
        onActivate: buildEffect([
            Require.Target('pawn', 'both', 'opponent'),
            Require.Target('pawn', 'faceup', 'active', 1, eligible),
            Effect.SetHardOncePerTurn(id),
            Effect.ModifyTargetStats(30, 0, 1, Phase.END),
            Effect.RewardTargetBattleVictory(1, 0)
        ]),
        onBattleDestroy: buildEffect([Effect.DrawCards(2)])
    }
}] satisfies CardModule;
