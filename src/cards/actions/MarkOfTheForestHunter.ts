import { IEffect, CardType, PawnType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, EffectStep } from '../libs/Builder';
import { Effect } from '../libs/Effects';
import { Condition } from '../libs/Requirements';

const payHalfLp: EffectStep = (draftState, context) => {
    const p = draftState.players[context.playerIndex];
    const cost = Math.floor(p.lp / 2);
    p.lp -= cost;
};

const effect: IEffect = {
    onFieldActivate: buildEffect([
        payHalfLp,
        Effect.SetSoftOncePerTurn(),
        Effect.SearchDeck("Select Beast Pawn", (c) => c.type === CardType.PAWN && c.level >= 5 && c.pawnType === PawnType.BEAST)
    ]),
    canActivate: (state, context) => {
        const p = state.players[context.playerIndex];
        if (!Condition.SoftOncePerTurn()(state, context)) return false;
        if (p.lp <= 1) return false;
        return true;
    }
};

cardRegistry.register({
    id: 'action_03',
    name: 'Mark of the Forest Hunter',
    type: CardType.ACTION,
    isLingering: true,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Once per turn: pay half your LP, then add 1 level 5 or higher Beast type Pawn from your deck to your hand.',
}, effect);
