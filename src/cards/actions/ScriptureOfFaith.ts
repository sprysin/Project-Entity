import { ActionSubtype, CardType, IEffect, PawnSubtype } from '../../types';
import { CardModule } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Cost } from '../engine/Costs';
import { Effect } from '../engine/Effects';
import { levelTributeCandidates, levelTributeChoices } from '../../game/levelTributes';
import { matchesCardName } from '../../game/cardHelpers';

const matchesPatron = (card: Parameters<typeof matchesCardName>[0]) => matchesCardName(card, 'Patron of Judgement');
const effect: IEffect = {
    canActivate: (state, context) => {
        const player = state.players[context.playerIndex];
        if (!player.reserve.some(card => card.pawnSubtype === PawnSubtype.VASSAL && matchesPatron(card))) return false;
        const fieldIds = new Set(levelTributeCandidates(state, context.playerIndex).filter(entry => entry.location === 'field').map(entry => entry.card.instanceId));
        return levelTributeChoices(state, { playerIndex: context.playerIndex, totalLevel: 10 })
            .some(ids => player.pawnZones.includes(null) || ids.some(id => fieldIds.has(id)));
    },
    onActivate: buildEffect([Cost.TributeExactLevels(10), Effect.SummonFromReserve(PawnSubtype.VASSAL, matchesPatron)])
};

export default [{ cardData: {
    id: 'action_scripture_of_faith', name: 'Scripture of faith', type: CardType.ACTION,
    actionSubtype: ActionSubtype.CONTRACT, rarity: 'Common', level: 0, atk: 0, def: 0,
    effectText: 'Tribute Pawns from your hand or field whose levels total exactly 10, then Vassal summon "Patron of Judgement" from your Reserve.'
}, effect }] satisfies CardModule;
