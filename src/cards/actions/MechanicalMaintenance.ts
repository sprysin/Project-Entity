import { IEffect, CardType, PawnType, Card, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { EffectStep } from '../libs/Builder';
import { Cost } from '../libs/Costs';

const tributePawns = Cost.TributePawns(2, "Select 2 Mechanical Pawns to Sacrifice", c => c.pawnType === PawnType.MECHANICAL);

const selectFromDiscard: EffectStep = (draftState, context) => {
    if (context.discardIndex === undefined) {
        return {
            requireDiscardSelection: {
                playerIndex: context.playerIndex,
                title: "Select Mechanical Pawn to Special Summon",
                filter: (c: Card) => c.pawnType === PawnType.MECHANICAL
            }
        };
    }
};

const specialSummonFromDiscard: EffectStep = (draftState, context) => {
    if (context.discardIndex !== undefined) {
        const p = draftState.players[context.playerIndex];
        const card = p.discard[context.discardIndex];

        if (card) {
            // Find empty zone
            const emptyIdx = p.pawnZones.findIndex(z => z === null);
            if (emptyIdx !== -1) {
                p.discard.splice(context.discardIndex, 1);
                p.pawnZones[emptyIdx] = {
                    card,
                    position: Position.ATTACK,
                    hasAttacked: false,
                    hasChangedPosition: false,
                    summonedTurn: draftState.turnNumber,
                    isSetTurn: false
                };
                return { log: `Special Summoned ${card.name} from discard pile.` };
            } else {
                return { log: `No empty zone to Special Summon.`, halt: true };
            }
        }
    }
};

const effect: IEffect = {
    onActivate: buildEffect([
        tributePawns,
        selectFromDiscard,
        specialSummonFromDiscard
    ]),
    canActivate: (state, context) => {
        const p = state.players[context.playerIndex];

        // Count Mechanical Pawns on field
        let mechanicalCount = 0;
        for (const zone of p.pawnZones) {
            if (zone && zone.card.pawnType === PawnType.MECHANICAL) mechanicalCount++;
        }
        if (mechanicalCount < 2) return false;
        return p.discard.some(c => c.pawnType === PawnType.MECHANICAL);
    }
};

cardRegistry.register({
    id: 'action_04',
    name: 'Mechanical Maintenance',
    type: CardType.ACTION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Tribute 2 Mechanical Pawns you control, special summon 1 Mechanical Pawn from the Discard Pile.',
}, effect);
