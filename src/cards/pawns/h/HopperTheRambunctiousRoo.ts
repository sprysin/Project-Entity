import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';

export default [{
    cardData: {
        id: 'P_Hopper_The_Rambunctious_Roo',
        name: 'Hopper the rambunctious Roo',
        type: CardType.PAWN,
        attribute: Attribute.EARTH,
        pawnType: PawnType.BEAST,
        level: 5,
        atk: 220,
        def: 160,
        rarity: 'Rare',
        effectText: 'Once while on the field: If this card would be destroyed by battle or card effect, it is not destroyed.'
    },
    effect: {
        destructionProtection: { uses: 1, causes: ['battle', 'effect'] }
    }
}] satisfies CardModule;
