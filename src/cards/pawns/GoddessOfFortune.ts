import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';

const effect: IEffect = {
    onEffectActivated: (state, context) => {
        if (context.activatingPlayerIndex === context.playerIndex
            || ![CardType.PAWN, CardType.ACTION].includes(context.activatedCard.type)) return { newState: state, halted: true };
        return buildEffect([Effect.RestoreLP((_state, source) => source.playerIndex, 10)])(state, context);
    }
};

export default [
    {
        cardData: {
            id: 'pawn_goddess_of_fortune',
            name: 'Goddess of fortune',
            type: CardType.PAWN,
            rarity: 'Common',
            level: 9,
            attribute: Attribute.WATER,
            pawnType: PawnType.ANGEL,
            atk: 200,
            def: 250,
            effectText: 'When your opponent activates a Pawn or Action card effect, gain 10 LP.',
        }, effect
    }
] satisfies CardModule;
