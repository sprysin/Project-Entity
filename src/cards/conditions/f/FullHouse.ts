import { CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'C_Full_House', name: 'Full House', type: CardType.CONDITION,
        rarity: 'Legendary', level: 0, atk: 0, def: 0,
        effectText: 'If you control 5 Pawns, send them all to the Discard; Void all cards your opponent controls.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].pawnZones.filter(Boolean).length === 5,
        onActivate: buildEffect([Cost.SendControlledPawns(5), Effect.MoveControlledCards('opponent', 'void')])
    }
}] satisfies CardModule;
