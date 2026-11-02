import { ActionSubtype, CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';

export default [{
    cardData: {
        id: 'C_Explosive_Exit', name: 'Explosive Exit', type: CardType.CONDITION,
        rarity: 'Uncommon', level: 0, atk: 0, def: 0,
        effectText: 'When a Pawn you control is destroyed, add 1 "Time Bomb" Bomb to your opponent’s deck. If the Pawn was Level 8 or higher, add 2 "Time Bomb" Bombs instead. Time Bomb: ON DRAW: Send the top 2 cards from your deck to the Discard.'
    },
    effect: {
        canActivate: (state, context) => !!state.response?.fieldDestructions?.some(event =>
            event.controllerIndex === context.playerIndex && event.card.type === CardType.PAWN),
        onActivate: buildEffect([(state, context) => {
            const pawns = context.fieldDestructions?.filter(event => event.controllerIndex === context.playerIndex && event.card.type === CardType.PAWN);
            if (!pawns?.length) return { halt: true };
            return Effect.ShuffleBombsIntoDeck('A_Time_Bomb', pawns.some(event => event.card.level >= 8) ? 2 : 1,
                (_state, context) => 1 - context.playerIndex)(state, context);
        }])
    }
}, {
    cardData: {
        id: 'A_Time_Bomb', name: 'Time Bomb', type: CardType.ACTION, actionSubtype: ActionSubtype.BOMB,
        rarity: 'Common', level: 0, atk: 0, def: 0,
        effectText: 'ON DRAW: Send the top 2 cards from your deck to the Discard.'
    },
    effect: { onDraw: buildEffect([Effect.MillDeck(2, (_state, context) => context.playerIndex)]) }
}] satisfies CardModule;
