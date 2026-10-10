import { IEffect, CardType, Phase } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { Cost } from '../../engine/Costs';

const effect: IEffect = {
    canActivate: (state, context) => state.currentPhase === Phase.BATTLE
        && state.deferredAction?.kind === 'attack' && !state.deferredAction.battleStep
        && (state.response?.timing === 'attack' || !!state.chain?.length && state.response?.timing === 'activation')
        && state.players[context.playerIndex].lp >= 50,
    onActivate: buildEffect([
        Cost.PayLP(50),
        Require.Target('pawn'),
        Effect.ModifyTargetStats(50, 0, 0, Phase.BATTLE)
    ])
};

export default [
    {
        cardData: {
            id: 'C_Last_Resort',
            name: 'Last resort',
            type: CardType.CONDITION,
            rarity: 'Common',
            level: 0,
            atk: 0,
            def: 0,
            effectText: 'During attack declaration, pay 50 LP; target 1 pawn on the field, it gains 50 ATK until the end of the battle phase.',
        }, effect
    }
] satisfies CardModule;
