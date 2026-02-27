import { EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { Position } from '../../../types';

export const Effect = {
    /** Changes the position of the targeted entity. */
    ChangeTargetPosition: (newPosition: Position): EffectStep => (draftState, context) => {
        if (context.target) {
            const player = draftState.players[context.target.playerIndex];
            const targetEntity = player.entityZones[context.target.index];
            if (targetEntity && targetEntity.position !== newPosition) {
                targetEntity.position = newPosition;
                return { log: `Changed ${targetEntity.card.name} to ${newPosition} position.` };
            }
        }
    },

    /** Modifies the targeted Pawn's stats. */
    ModifyTargetStats: (atkChange: number, defChange: number): EffectStep => (draftState, context) => {
        if (context.target) {
            const p = draftState.players[context.target.playerIndex];
            const tE = p.entityZones[context.target.index];
            if (tE) {
                tE.card.atk = Math.max(0, tE.card.atk + atkChange);
                tE.card.def = Math.max(0, tE.card.def + defChange);
                const statStr = [atkChange !== 0 ? `${Math.abs(atkChange)} ATK` : '', defChange !== 0 ? `${Math.abs(defChange)} DEF` : ''].filter(s => s).join(' & ');
                const verb = atkChange > 0 || defChange > 0 ? 'gains' : 'loses';
                return { log: `${tE.card.name} ${verb} ${statStr}.` };
            }
        }
    },

    /** Modifies the activating card's stats on the field. */
    ModifySelfStats: (atkChange: number, defChange: number): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.entityZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone) {
            selfZone.card.atk = Math.max(0, selfZone.card.atk + atkChange);
            selfZone.card.def = Math.max(0, selfZone.card.def + defChange);
            const statStr = [atkChange !== 0 ? `${Math.abs(atkChange)} ATK` : '', defChange !== 0 ? `${Math.abs(defChange)} DEF` : ''].filter(s => s).join(' & ');
            const verb = atkChange > 0 || defChange > 0 ? 'gains' : 'loses';
            return { log: `${selfZone.card.name} ${verb} ${statStr}.` };
        }
    },

    /** Draws a dynamic number of cards. */
    DrawCards: (amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        if (resolvedAmount <= 0) return;

        const activePlayer = draftState.players[context.playerIndex];
        const drawnCards = activePlayer.deck.splice(0, resolvedAmount);
        activePlayer.hand.push(...drawnCards);

        return { log: `Drew ${drawnCards.length} card(s).` };
    },

    /** Deals damage to a specific player's LP. */
    DealDamage: (playerIndex: Dynamic<number>, amount: Dynamic<number>, reasonLog?: string): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        const resolvedPlayerIndex = resolveDynamic(playerIndex, draftState, context);

        if (resolvedAmount <= 0) return { log: reasonLog ? `${reasonLog} 0 Damage.` : "Dealt 0 Damage." };

        draftState.players[resolvedPlayerIndex].lp -= resolvedAmount;
        return { log: reasonLog ? `${reasonLog} Dealt ${resolvedAmount} Damage.` : `Dealt ${resolvedAmount} Damage.` };
    },

    /** Restores LP to a specific player. */
    RestoreLP: (playerIndex: Dynamic<number>, amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        const resolvedPlayerIndex = resolveDynamic(playerIndex, draftState, context);

        if (resolvedAmount <= 0) return;

        draftState.players[resolvedPlayerIndex].lp += resolvedAmount;
        return { log: `Restored ${resolvedAmount} LP.` };
    },

    /** Sends a targeted card to the Void. */
    BanishTargetToVoid: (): EffectStep => (draftState, context) => {
        if (context.target) {
            const p = draftState.players[context.target.playerIndex];
            const zones = context.target.type === 'entity' ? p.entityZones : p.actionZones;
            const cardInZone = zones[context.target.index];

            if (cardInZone) {
                p.void.push(cardInZone.card);
                zones[context.target.index] = null;
                return { log: `Banished ${cardInZone.card.name} to the Void.` };
            }
        }
    },

    /** Moves a specific card from Discard to Hand. */
    RecoverFromDiscardToHand: (): EffectStep => (draftState, context) => {
        if (context.discardIndex !== undefined) {
            const p = draftState.players[context.playerIndex];
            const card = p.discard[context.discardIndex];
            if (card) {
                p.discard.splice(context.discardIndex, 1);
                p.hand.push(card);
                return { log: `Returned ${card.name} to hand.` };
            }
        }
    },

    /** Registers a Lingering Effect (e.g. ATK reset at End Phase). */
    RegisterPendingEffect: (type: 'RESET_ATK', targetInstanceId: string, value: number): EffectStep => (draftState, context) => {
        draftState.pendingEffects.push({
            type,
            targetInstanceId,
            value,
            dueTurn: draftState.turnNumber
        });
        return { log: `(Effect resets during End Phase).` };
    },

    /** Registers a Lingering Effect on the active activating card. */
    RegisterSelfPendingEffect: (type: 'RESET_ATK', value: number): EffectStep => (draftState, context) => {
        draftState.pendingEffects.push({
            type,
            targetInstanceId: context.card.instanceId,
            value,
            dueTurn: draftState.turnNumber
        });
        return { log: `(Resets During End Phase).` };
    }
};
