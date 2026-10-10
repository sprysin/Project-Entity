import { Attribute, CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { fieldStats } from '../../../game/cardHelpers';

export default [{
    cardData: {
        id: 'P_Steadfast_Hummingbird',
        name: 'Steadfast Hummingbird',
        type: CardType.PAWN,
        attribute: Attribute.ELECTRIC,
        pawnType: PawnType.AVIAN,
        level: 1,
        atk: 30,
        def: 0,
        rarity: 'Common',
        effectText: 'If your opponent controls a pawn with higher ATK than you, this card can attack directly.'
    },
    effect: {
        canAttackDirectly: (state, context) => {
            const self = state.players[context.playerIndex].pawnZones.find(zone => zone?.card.instanceId === context.card.instanceId);
            return !!self && state.players[1 - context.playerIndex].pawnZones.some(zone => zone && zone.position !== Position.HIDDEN
                && fieldStats(state, zone).atk > fieldStats(state, self).atk);
        }
    }
}] satisfies CardModule;
