import { Attribute, Card, CardType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { fieldStats, isReservePawn } from '../../../game/cardHelpers';

const eligible = (card: Card) => card.type === CardType.PAWN && card.attribute === Attribute.FIRE && !isReservePawn(card);

export default [{
    cardData: {
        id: 'action_flaming_phenix_rebirth', name: 'Flaming Phenix Rebirth', type: CardType.ACTION,
        rarity: 'Rare', level: 0, atk: 0, def: 0,
        effectText: 'Select 2 FIRE Pawns in your Discard, randomly summon 1 of those Pawns in attack position and if you do take damage equal to its ATK.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].pawnZones.includes(null)
            && state.players[context.playerIndex].discard.filter(eligible).length >= 2,
        onActivate: buildEffect([
            Effect.SelectDiscardCards(eligible, 2, 'summon'),
            Effect.RequirePawnPlacement(Position.ATTACK),
            Effect.randomSelection({ location: 'discard', filter: eligible,
                candidateIds: (_state, context) => context.discardCardIds ?? [] }),
            Effect.SummonSelected(Position.ATTACK),
            Effect.DealDamage((_state, context) => context.playerIndex, (state, context) => {
                const zone = state.players[context.playerIndex].pawnZones[context.pawnPlacement!.slot]!;
                return fieldStats(state, zone).atk;
            })
        ])
    }
}] satisfies CardModule;
