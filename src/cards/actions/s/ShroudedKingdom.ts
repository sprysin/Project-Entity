import { ActionSubtype, Attribute, Card, CardType, Position } from '../../../types';
import { canSetPawn, isReservePawn } from '../../../game/cardHelpers';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { Condition } from '../../engine/Requirements';

const darkPawn = (card: Card) => card.type === CardType.PAWN && card.attribute === Attribute.DARK;
const summonable = (card: Card) => darkPawn(card) && !isReservePawn(card) && canSetPawn(card);

export default [{ cardData: {
    id: 'A_Shrouded_Kingdom', name: 'Shrouded Kingdom', type: CardType.ACTION,
    actionSubtype: ActionSubtype.LAND, rarity: 'Rare', level: 0, atk: 0, def: 0,
    effectText: 'Once per turn: Void 2 DARK Pawns from your Discard pile; special summon 1 DARK Pawn from your hand in face-down Defense.\nDARK Pawns gain 20 DEF.'
}, effect: {
    LingeringStatModifier: (_state, _context, target) => ({ def: darkPawn(target.card) ? 20 : 0 }),
    canActivate: (state, context) => {
        const player = state.players[context.playerIndex];
        return Condition.SoftOncePerTurn('summon')(state, context)
            && player.pawnZones.includes(null) && player.hand.some(summonable)
            && player.discard.filter(darkPawn).length >= 2;
    },
    onFieldActivate: buildEffect([
        Effect.SetSoftOncePerTurn('summon'), Cost.VoidDiscardCards(2, darkPawn),
        Effect.SpecialSummonFromHand(summonable, Position.HIDDEN)
    ])
} }] satisfies CardModule;
