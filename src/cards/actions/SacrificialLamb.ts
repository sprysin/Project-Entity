import { IEffect, CardType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, EffectStep } from '../engine/Builder';
import { Cost } from '../engine/Costs';
import { sendToOwnerPile } from '../../game/cardOwnership';

const resolveTributeAndGainAttack: EffectStep = (state, context) => {
    const player = state.players[context.playerIndex];
    const tributeIndex = context.tributeIndices?.[0];
    const fieldTribute = tributeIndex === undefined ? undefined : player.pawnZones[tributeIndex]?.card;
    const discardTribute = player.discard[player.discard.length - 1];
    const tributed = context.tributeCards?.[0] ?? fieldTribute ?? discardTribute;
    if (!tributed || tributed.type !== CardType.PAWN || tributed.level > 3) return;

    if (fieldTribute && tributeIndex !== undefined) {
        sendToOwnerPile(state, { ...fieldTribute, tributedByAction: true }, 'discard');
        player.pawnZones[tributeIndex] = null;
    }
    state.players[context.playerIndex].lp += tributed.atk;
};

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.TributePawns(1, card => card.type === CardType.PAWN && card.level <= 3),
        resolveTributeAndGainAttack
    ]),
    canActivate: (state, context) => state.players[context.playerIndex].pawnZones.some(zone => zone?.card.type === CardType.PAWN && zone.card.level <= 3)
};

cardRegistry.register({
    id: 'action_05',
    name: 'Sacrificial Lamb',
    type: CardType.ACTION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: "Tribute 1 Level 3 or lower Pawn you control and gain its ATK as Lifepoints.",
}, effect);
