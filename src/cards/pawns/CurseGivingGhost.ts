import { Attribute, CardType, IEffect, PawnSubtype, PawnType, Position } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Require } from '../engine/Requirements';
import { getEffectTarget } from '../engine/Targets';

const effect: IEffect = {
    allowMissingTargets: true,
    onSwitch: buildEffect([
        Require.Target('pawn', 'both', 'opponent'),
        (state, context) => {
            const own = state.players[context.playerIndex];
            const ghost = own.pawnZones.some(z => z?.card.instanceId === context.card.instanceId);
            if (!ghost || !own.pawnZones.some(z => z && z.card.instanceId !== context.card.instanceId && z.card.pawnType === PawnType.UNDEAD && z.position !== Position.HIDDEN)) return;
            const target = getEffectTarget(context, 1);
            if (!target) return {
                requireTarget: 'pawn', requireTargetScope: 'active', requireTargetPosition: 'faceup',
                requireTargetIndex: 1, requireTargetFilter: (card: typeof context.card) => card.pawnType === PawnType.UNDEAD && card.instanceId !== context.card.instanceId
            };
            const receiver = target.type === 'pawn' && target.playerIndex === context.playerIndex && own.pawnZones[target.index];
            if (!receiver) return context.execution === 'resolve' ? undefined : { halt: true };
            if (receiver.card.instanceId === context.card.instanceId || receiver.card.pawnType !== PawnType.UNDEAD || receiver.position === Position.HIDDEN) return { halt: true };
        },
        (state, context) => {
            const foe = getEffectTarget(context);
            const opponent = foe && state.players[foe.playerIndex].pawnZones[foe.index];
            if (!opponent) return { halt: true };
            opponent.card.atk = Math.max(0, opponent.card.atk - 30);
        },
        (state, context) => {
            const own = state.players[context.playerIndex];
            if (!own.pawnZones.some(z => z?.card.instanceId === context.card.instanceId)) return;
            const target = getEffectTarget(context, 1);
            const receiver = target?.type === 'pawn' && target.playerIndex === context.playerIndex && own.pawnZones[target.index];
            if (!receiver || receiver.card.instanceId === context.card.instanceId || receiver.card.pawnType !== PawnType.UNDEAD || receiver.position === Position.HIDDEN) return;
            const foe = getEffectTarget(context);
            const opponent = foe && state.players[foe.playerIndex].pawnZones[foe.index];
            if (!opponent) return;
            const oldAtk = receiver.card.atk;
            const reducedOpponentAtk = opponent.card.atk;
            receiver.card.atk += reducedOpponentAtk;
            state.pendingEffects.push({ type: 'RESET_ATK', targetInstanceId: receiver.card.instanceId, value: oldAtk, dueTurn: state.turnNumber });
        }
    ])
};

cardRegistry.register({
    id: 'pawn_12', name: 'Curse Giving Ghost', type: CardType.PAWN,
    level: 1, attribute: Attribute.DARK, pawnType: PawnType.UNDEAD, pawnSubtype: PawnSubtype.SWITCH, switchMandatory: true,
    atk: 15, def: 0,
    effectText: 'Switch: Target 1 Pawn your opponent controls; it loses 30 ATK. Then if this card is still on the field, target another Undead Pawn you control; it gains ATK equal to that Pawn’s ATK until the End Phase.'
}, effect);
