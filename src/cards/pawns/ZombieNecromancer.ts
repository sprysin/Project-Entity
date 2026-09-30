import { isToken } from '../../game/cardHelpers';
import { Attribute, CardType, IEffect, PawnType, Position } from '../../types';
import { CardModule } from '../CardRegistry';

const effect: IEffect = {
    onBattleDestroy: (state, context) => {
        if (isToken(context.destroyedCard)) return { newState: state };
        const next = structuredClone(state);
        const own = next.players[context.playerIndex];
        const slot = own.pawnZones.indexOf(null);
        if (slot < 0 || !own.pawnZones.some(z => z?.card.instanceId === context.card.instanceId)) return { newState: next };
        let revived = context.destroyedCard;
        for (const player of next.players) {
            const index = player.discard.findIndex(card => card.instanceId === context.destroyedCard.instanceId);
            if (index >= 0) { [revived] = player.discard.splice(index, 1); break; }
        }
        own.pawnZones[slot] = { card: revived, position: Position.DEFENSE, hasAttacked: false,
            hasChangedPosition: false, summonedTurn: next.turnNumber, isSetTurn: false,
            returnToOwnerEndPhase: true };
        return { newState: next };
    }
};

export default [
{ cardData: { id: 'pawn_14', name: 'Zombie Necromancer', type: CardType.PAWN,
    level: 4, attribute: Attribute.DARK, pawnType: PawnType.UNDEAD,
    atk: 145, def: 0,
    effectText: 'If this Pawn destroys a Pawn by battle, Special Summon that Pawn to your field in Defense Position. Send it to its owner’s Discard Pile during the End Phase.'
}, effect }
] satisfies CardModule;
