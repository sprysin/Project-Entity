import { ActionSubtype, Attribute, CardType, PawnSubtype, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Condition, Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';

export default [{ cardData: {
    id: 'A_Phantasmagoria', name: 'Phantasmagoria', type: CardType.ACTION, actionSubtype: ActionSubtype.LAND,
    rarity: 'Epic', level: 0, atk: 0, def: 0,
    effectText: 'Once per turn: destroy 1 Undead Pawn you control and summon a "Spirit" token with the same original stats but with no effect. Any Pawn summoned from the Discard becomes Undead type.'
}, effect: {
    pawnTypeModifier: (_state, _context, target) => target.summonedFromDiscard ? PawnType.UNDEAD : undefined,
    canActivate: Condition.SoftOncePerTurn(),
    onFieldActivate: buildEffect([
        Require.Target('pawn', 'faceup', 'active', 0, card => card.pawnType === PawnType.UNDEAD),
        Effect.SetSoftOncePerTurn(), Effect.ReplaceTargetWithToken('P_Spirit_Token')
    ])
} }, { cardData: {
    id: 'P_Spirit_Token', name: 'Spirit', type: CardType.PAWN, pawnSubtype: PawnSubtype.TOKEN,
    pawnType: PawnType.UNDEAD, attribute: Attribute.DARK, rarity: 'Common', level: 1, atk: 0, def: 0, effectText: ''
}, effect: {} }] satisfies CardModule;
