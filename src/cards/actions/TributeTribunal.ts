import { Card, CardContext, CardType, GameState, IEffect, Phase, Position } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, buildEffectChoice } from '../engine/Builder';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';
import { Condition } from '../engine/Requirements';
import { canTribute } from '../../game/cardHelpers';

const COUNTER = 'Tribute Counters';
const source = (state: GameState, context: CardContext) =>
    state.players[context.playerIndex].actionZones.find(zone => zone?.card.instanceId === context.card.instanceId);
const canSummon = (card: Card, count: number) => card.type === CardType.PAWN
    && card.level >= 5 && count >= (card.level <= 7 ? 1 : 2);
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

cardRegistry.register({
    id: 'action_06', name: 'Tribute Tribunal', type: CardType.ACTION, isLingering: true,
    level: 0, atk: 0, def: 0,
    effectText: 'You can use both effects once per turn: - tribute 1 pawn you control, then place 1 Tribute Counter on this card. -Special summon a pawn requiring 1 tribute if this card has 1 Tribute Counter, or special summon a pawn requiring 2 tributes if this card has 2 Tribute Counters.'
}, effect);
