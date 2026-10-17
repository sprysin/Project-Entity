import { CardType } from '../../../types';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'C_Shared_Healing',
        name: 'Shared Healing',
        type: CardType.CONDITION,
        rarity: 'Common',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'When your opponent gains LP: gain the same amount of LP, then draw 1 additional card during your next Draw Phase.'
    },
    effect: {
        canActivate: (state, context) => !!state.response?.lpGain && state.response.lpGain.playerIndex !== context.playerIndex,
        onActivate: buildEffect([
            (_state, context) => { if (!context.lpGain || context.lpGain.playerIndex === context.playerIndex) return { halt: true }; },
            Effect.RestoreLP((_state, context) => context.playerIndex, (_state, context) => context.lpGain!.amount),
            Effect.BonusNextDraw(1)
        ])
    }
}] satisfies CardModule;

