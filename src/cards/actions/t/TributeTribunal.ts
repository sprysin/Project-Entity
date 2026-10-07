import { Card, CardContext, CardType, GameState, IEffect, Phase, Position } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect, buildEffectChoice } from '../../engine/Builder';
import { Cost } from '../../engine/Costs';
import { Effect } from '../../engine/Effects';
import { Condition } from '../../engine/Requirements';
import { canTribute } from '../../../game/cardHelpers';

const COUNTER = 'Tribute Counters';
const source = (state: GameState, context: CardContext) =>
    state.players[context.playerIndex].actionZones.find(zone => zone?.card.instanceId === context.card.instanceId);
const counterSummon = {
    counter: COUNTER,
    requiredCounters: (card: Card) => card.type === CardType.PAWN && card.level >= 5
        ? (card.level <= 7 ? 2 : 3) : undefined
};
const canSummon = (card: Card, count: number) => {
    const required = counterSummon.requiredCounters(card);
    return required !== undefined && count >= required;
};
const unavailable = (id: string) => (state: GameState, context: CardContext): boolean => {
    const zone = source(state, context);
    if (!zone || zone.position === Position.HIDDEN
        || state.activePlayerIndex !== context.playerIndex || ![Phase.MAIN1, Phase.MAIN2].includes(state.currentPhase)
        || !Condition.SoftOncePerTurn(id)(state, context)) return true;
    const player = state.players[context.playerIndex];
    if (id === 'tribute') return !player.pawnZones.some(pawn => pawn && canTribute(pawn.card));
    const count = Effect.CounterCount(COUNTER)(state, context);
    return !count || !player.pawnZones.includes(null) || !player.hand.some(card => canSummon(card, count));
};

const effect: IEffect = {
    counterSummon,
    onFieldActivate: buildEffectChoice([
        {
            id: 'tribute', unavailable: unavailable('tribute'),
            execute: buildEffect([Effect.RequireFaceUpSource(), Cost.TributePawns(1),
            Effect.SetSoftOncePerTurn('tribute'), Effect.ModulateCounter(COUNTER, 1)])
        },
        {
            id: 'summon', unavailable: unavailable('summon'),
            execute: buildEffect([Effect.RequireFaceUpSource(), Effect.SetSoftOncePerTurn('summon'),
            (state, context) => Effect.SpecialSummonFromHand(card =>
                canSummon(card, Effect.CounterCount(COUNTER)(state, context)))(state, context)])
        }
    ])
};

export default [
    {
        cardData: {
            id: 'action_06', name: 'Tribute Tribunal', type: CardType.ACTION, rarity: 'Epic', isLingering: true,
            level: 0, atk: 0, def: 0,
            effectText: 'You can activate both effects once per turn:\n- Tribute 1 pawn you control, then place 1 Tribute Counter on this card.\n- Special summon a level 5-7 Pawn if this card has at least 2 Tribute Counters, or a level 8-10 if this card has 3+.'
        }, effect
    }
] satisfies CardModule;
