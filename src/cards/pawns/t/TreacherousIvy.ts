import { Attribute, CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { matchesCardName } from '../../../game/cardHelpers';

export default [{
    cardData: {
        id: 'pawn_treacherous_ivy',
        name: 'Treacherous Ivy',
        type: CardType.PAWN,
        attribute: Attribute.DARK,
        pawnType: PawnType.PLANT,
        level: 3,
        atk: 0,
        def: 150,
        rarity: 'Uncommon',
        effectText: 'If this card is destroyed by battle, the attacking Pawn loses 20 ATK. Then summon another "Treacherous Ivy" from your deck in defence.'
    },
    effect: {
        mandatoryReactions: true,
        onBattleDestroyed: buildEffect([
            (state, context) => {
                const attacker = state.players.flatMap(player => player.pawnZones).find(zone => zone?.card.instanceId === context.battleAttacker?.instanceId);
                if (attacker) attacker.card.atk = Math.max(0, attacker.card.atk - 20);
            },
            (state, context) => {
                const player = state.players[context.playerIndex];
                if (player.pawnZones.includes(null) && player.deck.some(card => matchesCardName(card, context.card.name))) {
                    return Effect.SpecialSummonFromDeck(card => matchesCardName(card, context.card.name), Position.DEFENSE)(state, context);
                }
            }
        ])
    }
}] satisfies CardModule;
