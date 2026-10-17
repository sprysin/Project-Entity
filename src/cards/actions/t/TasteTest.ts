import { Card, CardType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { Require } from '../../engine/Requirements';
import { matchesCardName } from '../../../game/cardHelpers';
import { CardModule } from '../../CardRegistry';

const oven = (card: Card) => matchesCardName(card, 'Monstrous Oven');
const counter = 'Oven Counters';

export default [{
    cardData: {
        id: 'A_Taste_Test',
        name: 'Taste Test',
        type: CardType.ACTION,
        rarity: 'Common',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'Remove 1 counter from "Monstrous Oven", then add 1 Pawn from your Discard pile to your hand.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].actionZones.some(zone =>
            zone && zone.position !== Position.HIDDEN && oven(zone.card) && (zone.counters?.[counter] ?? 0) > 0)
            && state.players[context.playerIndex].discard.some(card => card.type === CardType.PAWN),
        onActivate: buildEffect([
            Require.Target('action', 'faceup', 'active', 0, oven),
            Cost.RemoveCounters(counter, 1),
            Cost.SelectDiscardRecovery(card => card.type === CardType.PAWN),
            Effect.RecoverFromDiscardToHand()
        ])
    }
}] satisfies CardModule;

