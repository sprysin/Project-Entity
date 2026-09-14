import { IEffect, CardType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, EffectStep } from '../libs/Builder';
import { Cost } from '../libs/Costs';

const resolveTributeAndGainAttack: EffectStep = (state, context) => {
    const player = state.players[context.playerIndex];
    const tributeIndex = context.tributeIndices?.[0];
    const fieldTribute = tributeIndex === undefined ? undefined : player.pawnZones[tributeIndex]?.card;
    const discardTribute = player.discard[player.discard.length - 1];
    const tributed = fieldTribute ?? discardTribute;
    if (!tributed || tributed.type !== CardType.PAWN || tributed.level > 3) return;

    if (fieldTribute && tributeIndex !== undefined) {
        player.discard.push({ ...fieldTribute, tributedByAction: true });
        player.pawnZones[tributeIndex] = null;
    }
    state.players[context.playerIndex].lp += tributed.atk;
    return { log: `Gained ${tributed.atk} LP from ${tributed.name}.` };
};

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.TributePawns(1, 'Tribute 1 Level 3 or lower Pawn.', card => card.type === CardType.PAWN && card.level <= 3),
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
