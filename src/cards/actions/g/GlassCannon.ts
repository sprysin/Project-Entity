import { Card, CardType, Phase } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Condition } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { sourceZone } from '../../../game/field';
import { matchesCardGroup } from '../../../game/cardHelpers';
import { CardModule } from '../../CardRegistry';

const glass = (card: Card) => card.type === CardType.PAWN && matchesCardGroup(card, 'Glass');

export default [{
    cardData: {
        id: 'A_Glass_Cannon',
        name: 'Glass Cannon',
        type: CardType.ACTION,
        rarity: 'Epic',
        isLingering: true,
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'During either Main Phase: Special Summon up to 3 "Glass" Pawns from your hand. If you activate this effect, destroy this card during the End Phase.'
    },
    effect: {
        timing: 'quick',
        canActivate: (state, context) => !sourceZone(state, context) || [Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase)
            && Condition.OnceWhileOnField()(state, context) && state.players[context.playerIndex].pawnZones.includes(null)
            && state.players[context.playerIndex].hand.some(glass),
        onFieldActivate: buildEffect([Effect.RequireFaceUpSource(), Effect.SetOnceWhileOnField(), Effect.SpecialSummonHandCards(glass, 3)]),
        onPhaseChange: buildEffect([
            (state, context) => { if (state.currentPhase !== Phase.END || !sourceZone(state, context)?.hasUsedWhileOnField) return { halt: true }; },
            Effect.DestroySelf()
        ])
    }
}] satisfies CardModule;

