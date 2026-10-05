import { IEffect, CardType, Attribute, PawnType, Phase } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect, buildCondition } from '../engine/Builder';
import { Effect } from '../engine/Effects';
import { Query } from '../engine/Queries';
import { Condition } from '../engine/Requirements';

const counter = 'Spark Counters';
const payout = 'counter_payout';

const effect: IEffect = {
    timing: 'quick',
    canActivate: buildCondition([
        (state, context) => state.currentPhase === Phase.END && state.activePlayerIndex !== context.playerIndex,
        Condition.SoftOncePerTurn('burn')
    ]),
    onActivate: buildEffect([
        Effect.RequireFaceUpSource(),
        Effect.SetSoftOncePerTurn('burn'),
        Effect.SkipNextDrawPhase(),
        Effect.DealDamage(Query.ActiveOpponent(), 50)
    ]),
    onEffectDamage: (state, context) => {
        if (state.currentPhase === Phase.END || context.damagedPlayerIndex === context.playerIndex
            || context.damageCard.instanceId === context.card.instanceId && context.damageEffectId === payout) {
            return { newState: state, halted: true };
        }
        return buildEffect([Effect.ModulateCounter(counter, 1)])(state, context);
    },
    onPhaseChange: buildEffect([
        Effect.RequireFaceUpSource(),
        (state, context) => {
            if (state.currentPhase !== Phase.END || !Effect.CounterCount(counter)(state, context)
                || !context.execution && !Condition.SoftOncePerTurn(payout)(state, context)) return { halt: true };
        },
        Effect.SetSoftOncePerTurn(payout),
        (state, context) => {
            const count = Effect.CounterCount(counter)(state, context);
            if (!count) return { halt: true };
            Effect.ModulateCounter(counter, -count)(state, context);
            return Effect.DealDamage(Query.ActiveOpponent(), count * 30)(state, { ...context, effectId: payout });
        }
    ])
};

export default [
    {
        cardData: {
            id: 'pawn_force_fire_sparkling_commander',
            name: 'Force Fire Sparkling Commander',
            type: CardType.PAWN,
            rarity: 'Epic',
            level: 6,
            attribute: Attribute.FIRE,
            pawnType: PawnType.DEMON,
            atk: 165,
            def: 150,
            effectText: 'Once during your opponent\'s End Phase, you can activate this effect: Skip your next Draw Phase, then inflict 50 damage to your opponent. Each time your opponent takes effect damage, place 1 Spark Counter on this card. During the End Phase, remove all Spark Counters from this card; inflict 30 damage to your opponent for each counter removed. (You cannot gain counters during the end phase.)',
        }, effect
    }
] satisfies CardModule;
