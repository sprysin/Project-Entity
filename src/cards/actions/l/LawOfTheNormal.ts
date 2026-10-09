import { ActionSubtype, Attribute, CardType } from '../../../types';
import { CardModule, cardRegistry } from '../../CardRegistry';
import { fieldStats } from '../../../game/cardHelpers';
import { buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'action_law_of_the_normal',
        name: 'Law of the Normal',
        type: CardType.ACTION,
        actionSubtype: ActionSubtype.LAND,
        rarity: 'Rare',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'During your turn, all NORMAL Pawns you control gain 20 ATK.\nOnce: Target 1 Pawn on either field whose ATK differs from its original ATK; its ATK becomes its original ATK for the rest of the turn.'
    }, effect: {
        LingeringStatModifier: (state, _context, target, controllerIndex) => ({
            atk: controllerIndex === state.activePlayerIndex && target.card.attribute === Attribute.NORMAL ? 20 : 0
        }),
        canActivate: Condition.OnceWhileOnField(),
        onFieldActivate: buildEffect([
            (state, context) => Require.Target('pawn', 'both', 'both', 0, card => {
                const zone = state.players.flatMap(player => player.pawnZones)
                    .find(zone => zone?.card.instanceId === card.instanceId);
                const original = cardRegistry.getCard(card.id);
                return !!zone && !!original && fieldStats(state, zone).atk !== original.atk;
            })(state, context),
            Effect.SetOnceWhileOnField(), Effect.SetTargetOriginalAttack()
        ])
    }
}] satisfies CardModule;
