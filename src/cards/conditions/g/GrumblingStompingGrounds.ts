import { CardType, PawnType, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { setPawnPosition } from '../../../game/cardHelpers';

export default [{ cardData: {
    id: 'C_Grumbling_Stomping_Grounds', name: 'Grumbling Stomping Grounds', type: CardType.CONDITION,
    isLingering: true, rarity: 'Rare', level: 0, atk: 0, def: 0,
    effectText: 'When you summon a Primal Pawn, all Pawns on the field with a lower level than the summoned Pawn are switched to Defense Position. If your Primal Pawns are destroyed by battle, send the top card from your opponent’s Deck to the Discard.'
}, effect: {
    onActivate: buildEffect([]),
    onPawnSummoned: (state, context) => {
        if (context.summoningPlayerIndex !== context.playerIndex || context.summonedCard.pawnType !== PawnType.PRIMAL) return { newState: state, halted: true };
        const next = structuredClone(state);
        for (const player of next.players) for (const zone of player.pawnZones) {
            if (zone && zone.card.level < context.summonedCard.level) setPawnPosition(zone, Position.DEFENSE);
        }
        return { newState: next };
    },
    onFieldCardDestroyed: (state, context) => context.cause === 'battle' && context.controllerIndex === context.playerIndex
        && context.destroyedCard.type === CardType.PAWN && context.destroyedCard.pawnType === PawnType.PRIMAL
        ? buildEffect([Effect.MillDeck(1, (_state, context) => 1 - context.playerIndex)])(state, context)
        : { newState: state, halted: true }
} }] satisfies CardModule;
