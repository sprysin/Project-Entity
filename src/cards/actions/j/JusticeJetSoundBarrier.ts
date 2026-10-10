import { Attribute, CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition } from '../../engine/Requirements';

export default [{ cardData: {
    id: 'A_Justice_Jet_Sound_Barrier', name: 'Justice Jet Sound Barrier', type: CardType.ACTION,
    isLingering: true, rarity: 'Legendary', level: 0, atk: 0, def: 0,
    effectText: 'Once per turn: When a "Justice Jet" Pawn is sent to the hand you can draw 1 card. Then special summon 1 AIR pawn from your hand.'
}, effect: {
    onCardSentToHand: (state, context) => {
        if (context.returnedCard.type !== CardType.PAWN || !context.returnedCard.name.includes('Justice Jet')
            || !Condition.SoftOncePerTurn('hand_return')(state, context)) return { newState: state, halted: true };
        state.pendingReactions = [...(state.pendingReactions ?? []), {
            card: context.card, playerIndex: context.playerIndex, trigger: 'hand_return'
        }];
        return { newState: state };
    },
    onHandReturn: buildEffect([Effect.RequireFaceUpSource(), Effect.SetSoftOncePerTurn('hand_return'), Effect.DrawCards(1), Effect.QueueHandSummon(true)]),
    handSummonFilter: card => card.attribute === Attribute.AIR,
    handSummonPrompt: 'Choose 1 AIR Pawn from your hand'
} }] satisfies CardModule;
