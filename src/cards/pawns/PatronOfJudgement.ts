import { Attribute, Card, CardType, GameState, IEffect, PawnSubtype, PawnType } from '../../types';
import { CardModule, cardRegistry } from '../CardRegistry';
import { buildCondition, buildEffect } from '../engine/Builder';
import { Condition, Require } from '../engine/Requirements';
import { Effect } from '../engine/Effects';
import { canTargetWithEffect, fieldStats } from '../../game/cardHelpers';

const attackIncrease = (state: GameState, card: Card) => {
    const placement = state.players.flatMap(player => player.pawnZones).find(zone => zone?.card.instanceId === card.instanceId);
    const printed = cardRegistry.getCard(card.id);
    return placement && printed ? fieldStats(state, placement).atk - printed.atk : 0;
};
const effect: IEffect = {
    canActivate: buildCondition([
        Condition.SoftOncePerTurn(),
        (state) => state.players.some(player => player.pawnZones.some(zone => zone && canTargetWithEffect(zone.card) && attackIncrease(state, zone.card) > 0))
    ]),
    onActivate: buildEffect([
        (state, context) => Require.Target('pawn', 'both', 'both', 0, card => attackIncrease(state, card) > 0)(state, context),
        Effect.SetSoftOncePerTurn(),
        (state, context) => {
            const target = context.targets?.[0] ?? context.target;
            const zone = target && state.players[target.playerIndex].pawnZones[target.index];
            if (!zone) return { halt: true };
            const difference = attackIncrease(state, zone.card);
            const id = zone.card.instanceId;
            Effect.DestroyTarget()(state, context);
            if (!state.players.some(player => player.pawnZones.some(value => value?.card.instanceId === id))) {
                Effect.DealDamage(context.playerIndex, difference)(state, context);
            }
        }
    ])
};

export default [{ cardData: {
    id: 'pawn_patron_of_judgement', name: 'Patron of Judgement', type: CardType.PAWN,
    pawnSubtype: PawnSubtype.VASSAL, rarity: 'Legendary', level: 10,
    attribute: Attribute.AIR, pawnType: PawnType.ANGEL, atk: 290, def: 220,
    effectText: 'Once per turn: Target 1 Pawn on the field whose ATK is higher than its original ATK; destroy it, and if you do, take damage equal to the difference.'
}, effect }] satisfies CardModule;
