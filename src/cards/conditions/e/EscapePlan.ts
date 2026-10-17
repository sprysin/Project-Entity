import { IEffect, CardType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter(),
        Effect.NegateAttack()
    ]),
    canActivate: (state, context) => state.deferredAction?.kind === 'attack'
        && state.deferredAction.targetId === 'direct'
        && state.activePlayerIndex !== context.playerIndex
        && state.players[context.playerIndex].hand.length > 0
};

export default [
{ cardData: {
    id: 'C_Escape_Plan',
    name: 'Escape Plan',
    type: CardType.CONDITION,
    rarity: 'Common',
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'When your Opponent declares a direct attack, discard 1 card then negate that attack.',
}, effect }
] satisfies CardModule;
