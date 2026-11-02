import { ActionSubtype, Attribute, CardType, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { Query } from '../../engine/Queries';
import { getEffectTarget } from '../../engine/Targets';
import { targetZone } from '../../../game/field';

export default [{ cardData: {
    id: 'A_Phantasmagoria', name: 'Phantasmagoria', type: CardType.ACTION, actionSubtype: ActionSubtype.LAND,
    rarity: 'Epic', level: 0, atk: 0, def: 0,
    effectText: 'Once per turn: destroy 1 Undead Pawn you control and summon a "Spirit" token with the same original stats but with no effect. Any Pawn summoned from the Discard becomes Undead type.'
}, effect: {
    pawnTypeModifier: (_state, _context, target) => target.summonedFromDiscard ? PawnType.UNDEAD : undefined,
    canActivate: Condition.SoftOncePerTurn(),
    onFieldActivate: buildEffect([
        Require.Target('pawn', 'faceup', 'active', 0, card => card.pawnType === PawnType.UNDEAD),
        Effect.SetSoftOncePerTurn(),
        (state, context) => {
            const target = getEffectTarget(context), zone = target && targetZone(state, target);
            if (!zone || zone.card.type !== CardType.PAWN) return { halt: true };
            const properties = { atk: Query.OriginalStat('atk')(state, context), def: Query.OriginalStat('def')(state, context),
                level: zone.card.level, attribute: zone.card.attribute };
            return Effect.DestroyTarget(0, Effect.SummonToken('P_Spirit_Token', 1, properties))(state, context);
        }
    ])
} }, { cardData: {
    id: 'P_Spirit_Token', name: 'Spirit', type: CardType.PAWN, pawnSubtype: PawnSubtype.TOKEN,
    pawnType: PawnType.UNDEAD, attribute: Attribute.DARK, rarity: 'Common', level: 1, atk: 0, def: 0, effectText: ''
}, effect: {} }] satisfies CardModule;
