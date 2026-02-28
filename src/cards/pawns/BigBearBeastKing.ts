import { IEffect, Position, GameState, CardContext } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildCondition } from '../libs/Builder';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Effect.RestoreLP((s, c) => c.playerIndex, 20),
        Effect.ChangeSelfPosition(Position.DEFENSE),
        Effect.ModifySelfStats(0, 60),
        Effect.RegisterSelfPendingEffect('RESET_DEF', 200, 1) // Base DEF is 200, resets in 1 turn
    ]),
    canActivate: buildCondition([
        (s: GameState, c: CardContext) => {
            const p = s.players[c.playerIndex];
            const zone = p.pawnZones.find(z => z && z.card.instanceId === c.card.instanceId);
            return zone ? zone.position === Position.ATTACK : false;
        }
    ])
};

cardRegistry.register('pawn_07', effect);
