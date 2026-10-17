import { CardType, IEffect } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Require } from '../../engine/Requirements';
import { Effect } from '../../engine/Effects';
import { destroyFieldCard } from '../../../game/attachments';

const effect: IEffect = {
    canActivate: (state, context) => state.response?.battleDamage?.playerIndex === context.playerIndex,
    onActivate: buildEffect([
        (state, context) => {
            const damage = context.battleDamage;
            if (!damage || damage.playerIndex !== context.playerIndex) return { halt: true };
            if (damage.amount <= 300) return Require.Target('pawn')(state, context);
        },
        (state, context) => {
            const damage = context.battleDamage!;
            if (damage.amount <= 300) Effect.ModifyTargetStats(-damage.amount, 0, 0, 'end_of_next_turn')(state, context);
            if (damage.amount >= 300) destroyFieldCard(state, damage.attacker.instanceId, 'effect', context.playerIndex);
        }
    ])
};

export default [{
    cardData: {
        id: 'C_Damage_Deduction',
        name: 'Damage Deduction',
        type: CardType.CONDITION,
        rarity: 'Epic',
        level: 0,
        atk: 0,
        def: 0,
        effectText: 'When you take battle damage, apply these effects based on the damage taken (apply both at 300):\n- 300 or higher: destroy the attacking Pawn.\n- 300 or lower: target 1 Pawn on the field; it loses ATK equal to the damage until the end of the next turn.'
    }, effect
}] satisfies CardModule;
