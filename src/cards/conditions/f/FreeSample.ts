import { Card, CardType, Position } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { matchesCardName } from '../../../game/cardHelpers';
import { CardModule } from '../../CardRegistry';

const oven = (card: Card) => matchesCardName(card, 'Monstrous Oven');
const counter = 'Oven Counters';

export default [{
    cardData: {
        id: 'C_Free_Sample',
        name: 'Free Sample',
        type: CardType.CONDITION,
        rarity: 'Common',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'When your opponent declares an attack: remove 1 counter from "Monstrous Oven", then negate that attack.'
    },
    effect: {
        canActivate: (state, context) => state.deferredAction?.kind === 'attack' && !state.deferredAction.battleStep
            && state.activePlayerIndex !== context.playerIndex && state.players[context.playerIndex].actionZones.some(zone =>
                zone && zone.position !== Position.HIDDEN && oven(zone.card) && (zone.counters?.[counter] ?? 0) > 0),
        onActivate: buildEffect([Require.Target('action', 'faceup', 'active', 0, oven), Cost.RemoveCounters(counter, 1), Effect.NegateAttack()])
    }
}] satisfies CardModule;

