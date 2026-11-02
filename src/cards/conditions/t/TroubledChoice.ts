import { CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Require } from '../../engine/Requirements';
import { getEffectTarget } from '../../engine/Targets';
import { targetZone } from '../../../game/field';

export default [{
    cardData: {
        id: 'C_Troubled_Choice', name: 'Troubled Choice', type: CardType.CONDITION,
        level: 0, rarity: 'Uncommon', atk: 0, def: 0,
        effectText: 'If you control at least 2 Pawns, target 2 Pawns you control; your opponent picks 1 of them to send to the Discard, and the other Pawn has its ATK doubled for the turn.'
    },
    effect: {
        canActivate: (state, context) => state.players[context.playerIndex].pawnZones.filter(Boolean).length >= 2,
        onActivate: buildEffect([
            Require.Target('pawn', 'both', 'active'),
            (state, context) => {
                const first = context.targets?.[0] ?? context.target;
                const id = first && state.players[first.playerIndex].pawnZones[first.index]?.card.instanceId;
                return Require.Target('pawn', 'both', 'active', 1, card => card.instanceId !== id)(state, context);
            },
            Effect.ChooseCard((state, context) => [0, 1].flatMap(index => {
                const target = getEffectTarget(context, index), zone = target && targetZone(state, target);
                return zone && target!.type === 'pawn' && target!.playerIndex === context.playerIndex
                    ? [{ card: zone.card, location: 'field' as const, playerIndex: context.playerIndex, isTarget: false }] : [];
            }), (_state, context) => 1 - context.playerIndex),
            Effect.MoveSelectedTo('discard'),
            (state, context) => Effect.MultiplyTargetAttackForTurn(2, context.peekIndex === 0 ? 1 : 0)(state, context)
        ])
    }
}] satisfies CardModule;
