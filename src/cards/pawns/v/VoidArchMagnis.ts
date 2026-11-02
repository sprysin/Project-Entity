import { Attribute, CardType, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Condition, Require } from '../../engine/Requirements';
import { Cost } from '../../engine/Costs';

export default [{
    cardData: {
        id: 'P_Void_Arch_Magnis', name: 'Void Arch Magnis', type: CardType.PAWN,
        pawnType: PawnType.ARCANE, attribute: Attribute.DARK, level: 10, rarity: 'Mythic', atk: 220, def: 210,
        effectText: 'Once per turn: Send to the Void 1 "Void" card in your Discard pile, then target 1 Pawn on the field; destroy it. This card gains 10 ATK for every card in your Void.'
    },
    effect: {
        canActivate: Condition.SoftOncePerTurn(),
        fieldStatModifier: (state, context) => ({ atk: state.players[context.playerIndex].void.length * 10 }),
        onActivate: buildEffect([
            Effect.SetSoftOncePerTurn(),
            Cost.VoidDiscardCards(1, card => card.name.includes('Void')),
            Require.Target('pawn'), Effect.DestroyTarget()
        ])
    }
}] satisfies CardModule;
