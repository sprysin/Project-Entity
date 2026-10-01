import { IEffect, CardType, Attribute } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';

const effect: IEffect = {
    handSummonFilter: card => card.type === CardType.PAWN && card.attribute === Attribute.LIGHT && card.level <= 4,
    handSummonPrompt: 'Choose a LIGHT Pawn',
    onPawnSummoned: (state, context) => {
        const player = state.players[context.playerIndex];
        if (context.summoningPlayerIndex === context.playerIndex || !context.tributeCount
            || !player.pawnZones.includes(null) || !player.hand.some(effect.handSummonFilter!)) return { newState: state };
        return { newState: { ...state, pendingHandSummons: [...(state.pendingHandSummons ?? []),
            { sourceId: context.card.instanceId, playerIndex: context.playerIndex }] } };
    },
    onActivate: buildEffect([
        // Revealing the lingering Condition arms its summon trigger.
    ])
};

export default [
{ cardData: {
    id: 'condition_06',
    name: 'Orcustrated Frontline Unit',
    type: CardType.CONDITION,
    rarity: 'Epic',
    isLingering: true,
    level: 0,
    atk: 0,
    def: 0,
    // Note a special summon that doesnt denote the position means the player chooses whether it goes to face up attack or face up defense
    effectText: 'Whenever your opponent tribute summons a Pawn, special summon 1 level 4 or lower Light Attribute Pawn from your hand. ',
}, effect }
] satisfies CardModule;
