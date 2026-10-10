import { Attribute, CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Condition } from '../../engine/Requirements';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { canTribute } from '../../../game/cardHelpers';

export default [{
    cardData: {
        id: 'P_Gluttonous_Tyrano', name: 'Gluttonous Tyrano', type: CardType.PAWN,
        attribute: Attribute.EARTH, pawnType: PawnType.PRIMAL, level: 6, atk: 230, def: 150, rarity: 'Common',
        effectText: 'This card cant attack. Once per turn: tribute a Pawn; this card can gains an attack, and you gain LP equal to the LV of the tributed Pawn x 10. If this card is in Defence it cant change its position to Attack, except with card effects.'
    },
    effect: {
        canAttack: (state, _context, zone) => zone.effectUsedTurn?.attackGrant === state.turnNumber,
        canManuallyChangePosition: (_state, _context, zone) => zone.position !== Position.DEFENSE,
        canActivate: (state, context) => Condition.SoftOncePerTurn()(state, context)
            && state.players[context.playerIndex].pawnZones.some(zone => zone && canTribute(zone.card)),
        onActivate: buildEffect([
            Effect.SetSoftOncePerTurn(), Cost.TributePawns(1),
            Effect.RestoreLP((_state, context) => context.playerIndex, (_state, context) => (context.tributeCards?.[0]?.level ?? 0) * 10),
            Effect.GrantSelfAttacks(1)
        ])
    }
}] satisfies CardModule;
