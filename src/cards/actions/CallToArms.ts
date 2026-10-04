import { Attribute, Card, CardContext, CardType, GameState, Position } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect, buildEffectChoice } from '../engine/Builder';
import { Effect } from '../engine/Effects';
import { Condition } from '../engine/Requirements';
import { matchesCardGroup } from '../../game/cardHelpers';

const normal = (card: Card) => card.type === CardType.PAWN && card.attribute === Attribute.NORMAL;
const summonable = (card: Card) => normal(card) && card.level <= 5;
const soldier = (card: Card) => card.type === CardType.PAWN && matchesCardGroup(card, 'Soldier');
const eligible = (id: string) => (state: GameState, context: CardContext) => {
    const player = state.players[context.playerIndex];
    if (!Condition.SoftOncePerTurn(id)(state, context)) return false;
    return id === 'summon'
        ? player.pawnZones.includes(null) && player.hand.some(summonable)
        && player.pawnZones.some(zone => zone && zone.position !== Position.HIDDEN && normal(zone.card) && zone.card.level <= 3)
        : state.attacksThisTurn?.some(event => event.turn === state.turnNumber && soldier(event.card)) === true
        && player.deck.some(soldier);
};
const choices = buildEffectChoice(['summon', 'search'].map(id => ({
    id, unavailable: (state: GameState, context: CardContext) => !eligible(id)(state, context),
    execute: buildEffect([
        (state, context) => { if (context.execution !== 'resolve' && !eligible(id)(state, context)) return { halt: true }; },
        Effect.SetSoftOncePerTurn(id),
        id === 'summon' ? Effect.SpecialSummonFromHand(summonable) : Effect.SearchDeck(soldier)
    ])
})));
export default [{
    cardData: {
        id: 'action_call_to_arms', name: 'Call to Arms', type: CardType.ACTION, rarity: 'Legendary',
        isLingering: true, level: 0, atk: 0, def: 0,
        effectText: 'You can activate both effects once per turn:\n- If you control a level 3 or lower NORMAL Pawn, special summon 1 level 5 or lower NORMAL Pawn from your hand.\n- If a "Soldier" Pawn attacked this turn, add 1 "Soldier" Pawn from your deck to your hand.'
    }, effect: { onFieldActivate: choices }
}] satisfies CardModule;
