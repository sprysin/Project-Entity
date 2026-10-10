import { setPawnPosition } from '../../../game/cardHelpers';
import { CardType, IEffect, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';

const effect: IEffect = {
    canActivate: (state, context) => {
        const ownPawns = state.players[context.playerIndex].pawnZones.filter(Boolean).length;
        const opposingPawns = state.players[1 - context.playerIndex].pawnZones;
        return opposingPawns.filter(Boolean).length > ownPawns
            && opposingPawns.some(zone => zone?.position === Position.ATTACK);
    },
    onActivate: buildEffect([(state, context) => {
        let routed = 0;
        for (const zone of state.players[1 - context.playerIndex].pawnZones) {
            if (zone?.position !== Position.ATTACK) continue;
            setPawnPosition(zone, Position.DEFENSE);
            routed++;
        }
        state.players[context.playerIndex].lp += routed * 20;
    }])
};

export default [{
    cardData: {
        id: 'A_Thunder_Strike',
        name: 'Thunder Strike',
        type: CardType.ACTION,
        rarity: 'Uncommon',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'If your opponent controls more Pawns than you: change all their Attack Position Pawns to Defense Position, then gain 20 LP for each Pawn changed.'
    }, effect
}] satisfies CardModule;
