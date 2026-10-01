import { Attribute, CardType, PawnType, Position } from '../../types';
import { CardModule } from '../CardRegistry';

export const INFANTRY_SOLDIER_ID = 'pawn_infantry_soldier';

export default [{
    cardData: {
        id: INFANTRY_SOLDIER_ID,
        name: 'Infantry Soldier',
        type: CardType.PAWN,
        rarity: 'Common',
        level: 2,
        attribute: Attribute.NORMAL,
        pawnType: PawnType.WARRIOR,
        atk: 40,
        def: 40,
        effectText: 'This pawn gains 100 ATK for every other "Infantry Soldier" on the field.'
    },
    effect: {
        fieldStatModifier: (state, context) => ({
            atk: 100 * state.players.flatMap(player => player.pawnZones).filter(zone =>
                zone?.card.id === context.card.id && zone.card.instanceId !== context.card.instanceId
                && zone.position !== Position.HIDDEN
            ).length
        })
    }
}] satisfies CardModule;
