import { IEffect, CardType, Attribute, PawnType, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';

const effect: IEffect = {
    onPhaseChange: (state, context) => {
        const draftState = structuredClone(state);
        const player = draftState.players[context.playerIndex];
        const discardIndex = player.discard.findIndex(card => card.instanceId === context.card.instanceId && card.tributedByAction);
        const zoneIndex = player.pawnZones.findIndex(zone => zone === null);
        if (discardIndex === -1 || zoneIndex === -1) return { newState: draftState, halted: true };

        const [card] = player.discard.splice(discardIndex, 1);
        delete card.tributedByAction;
        player.pawnZones[zoneIndex] = {
            card,
            position: Position.ATTACK,
            hasAttacked: false,
            hasChangedPosition: false,
            summonedTurn: draftState.turnNumber,
            isSetTurn: false,
        };
        return { newState: draftState };
    }
};

cardRegistry.register({
    id: 'pawn_09',
    name: 'Lingering Lamb',
    type: CardType.PAWN,
    level: 1,
    attribute: Attribute.EARTH,
    pawnType: PawnType.BEAST,
    atk: 20,
    def: 50,
    effectText: 'During your Standby Phase if this card was tributed by an Action effect, special summon this card from the discard pile.',
}, effect);
