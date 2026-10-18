import { Attribute, Card, CardContext, CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { canTribute } from '../../../game/cardHelpers';

const tributeFilter = (card: Card, context: CardContext) => card.pawnType === PawnType.MECHANICAL
    && card.instanceId !== context.card.instanceId;

export default [{
    cardData: {
        id: 'P_Engine_Interloper',
        name: 'Engine Interloper',
        type: CardType.PAWN,
        attribute: Attribute.ELECTRIC,
        pawnType: PawnType.MECHANICAL,
        level: 8,
        atk: 220,
        def: 160,
        rarity: 'Epic',
        effectText: "ON FIELD: tribute 1 Mechanical Pawn, increase this Pawn's attack by 20"
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].pawnZones.some(zone => zone && zone.position !== Position.HIDDEN
            && tributeFilter(zone.card, context) && canTribute(zone.card)),
        onActivate: buildEffect([Cost.TributePawns(1, tributeFilter), Effect.ModifySelfStats(20, 0)])
    }
}] satisfies CardModule;
