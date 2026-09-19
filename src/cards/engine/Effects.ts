import { activationCost, EffectStep } from './Builder';
import { Dynamic, resolveDynamic } from './Dynamic';
import { CardFilter, Position, TargetSelectScope } from '../../types';
import { getEffectTarget } from './Targets';

export const Effect = {
    /** Changes every Pawn in a player scope to the requested position. */
    ChangeAllPawnPositions: (scope: TargetSelectScope, newPosition: Position): EffectStep => (draftState, context) => {
        draftState.players.forEach((player, playerIndex) => {
            const isOpponent = playerIndex !== context.playerIndex;
            if (scope === 'active' && isOpponent || scope === 'opponent' && !isOpponent) return;
            player.pawnZones.forEach(zone => {
                if (zone) zone.position = newPosition;
            });
        });
    },

    /** Modifies every Pawn in a player scope, optionally restoring its prior stats at a future End Phase. */
    ModifyAllPawnStats: (
        scope: TargetSelectScope,
        atkChange: number,
        defChange: number,
        duration: 'permanent' | 'end_of_next_turn' | 'end_of_turn' = 'permanent'
    ): EffectStep => (draftState, context) => {
        draftState.players.forEach((player, playerIndex) => {
            const isOpponent = playerIndex !== context.playerIndex;
            if (scope === 'active' && isOpponent || scope === 'opponent' && !isOpponent) return;
            player.pawnZones.forEach(zone => {
                if (!zone) return;
                const originalAtk = zone.card.atk;
                const originalDef = zone.card.def;
                zone.card.atk = Math.max(0, originalAtk + atkChange);
                zone.card.def = Math.max(0, originalDef + defChange);
                if (duration === 'permanent') return;
                const dueTurn = draftState.turnNumber + (duration === 'end_of_next_turn' ? 1 : 0);
                if (atkChange) draftState.pendingEffects.push({
                    type: 'RESET_ATK', targetInstanceId: zone.card.instanceId,
                    value: originalAtk, dueTurn
                });
                if (defChange) draftState.pendingEffects.push({
                    type: 'RESET_DEF', targetInstanceId: zone.card.instanceId,
                    value: originalDef, dueTurn
                });
            });
        });
    },

    /** Changes the position of the targeted pawn. */
    ChangeTargetPosition: (newPosition: Position, targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (target) {
            const player = draftState.players[target.playerIndex];
            const targetPawn = player.pawnZones[target.index];
            if (targetPawn && targetPawn.position !== newPosition) {
                targetPawn.position = newPosition;
            }
        }
    },

    /** Modifies the targeted Pawn's stats. */
    ModifyTargetStats: (atkChange: number, defChange: number, targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (target) {
            const p = draftState.players[target.playerIndex];
            const tE = p.pawnZones[target.index];
            if (tE) {
                tE.card.atk = Math.max(0, tE.card.atk + atkChange);
                tE.card.def = Math.max(0, tE.card.def + defChange);
            }
        }
    },

    /** Changes position of the activating card. */
    ChangeSelfPosition: (newPosition: Position): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone && selfZone.position !== newPosition) {
            selfZone.position = newPosition;
        }
    },

    /** Modifies the activating card's stats on the field. */
    ModifySelfStats: (atkChange: number, defChange: number): EffectStep => (draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone) {
            selfZone.card.atk = Math.max(0, selfZone.card.atk + atkChange);
            selfZone.card.def = Math.max(0, selfZone.card.def + defChange);
        }
    },

    /** Draws a dynamic number of cards. */
    DrawCards: (amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        if (resolvedAmount <= 0) return;

        const activePlayer = draftState.players[context.playerIndex];
        const drawnCards = activePlayer.deck.splice(0, resolvedAmount);
        activePlayer.hand.push(...drawnCards);

    },

    /** Deals damage to a specific player's LP. */
    DealDamage: (playerIndex: Dynamic<number>, amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        const resolvedPlayerIndex = resolveDynamic(playerIndex, draftState, context);

        if (resolvedAmount <= 0) return;

        draftState.players[resolvedPlayerIndex].lp -= resolvedAmount;
    },

    /** Restores LP to a specific player. */
    RestoreLP: (playerIndex: Dynamic<number>, amount: Dynamic<number>): EffectStep => (draftState, context) => {
        const resolvedAmount = resolveDynamic(amount, draftState, context);
        const resolvedPlayerIndex = resolveDynamic(playerIndex, draftState, context);

        if (resolvedAmount <= 0) return;

        draftState.players[resolvedPlayerIndex].lp += resolvedAmount;
    },

    /** Sends a targeted card to the Void. */
    BanishTargetToVoid: (targetIndex = 0): EffectStep => (draftState, context) => {
        const target = getEffectTarget(context, targetIndex);
        if (target) {
            const p = draftState.players[target.playerIndex];
            const zones = target.type === 'pawn' ? p.pawnZones : p.actionZones;
            const cardInZone = zones[target.index];

            if (cardInZone) {
                p.void.push(cardInZone.card);
                zones[target.index] = null;
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
            } else return { halt: true };
        }
    },

    /** Registers a Lingering Effect (e.g. ATK reset at End Phase). */
    RegisterPendingEffect: (type: 'RESET_ATK', targetInstanceId: string, value: number): EffectStep => (draftState, _context) => {
        draftState.pendingEffects.push({
            type,
            targetInstanceId,
            value,
            dueTurn: draftState.turnNumber
        });
    },

    /** Registers a Lingering Effect on the active activating card. */
    RegisterSelfPendingEffect: (type: 'RESET_ATK' | 'RESET_DEF', value: number, durationTurns: number = 0): EffectStep => (draftState, context) => {
        draftState.pendingEffects.push({
            type,
            targetInstanceId: context.card.instanceId,
            value,
            dueTurn: draftState.turnNumber + durationTurns
        });
    },

    /** Marks the card instance as having used its effect this turn. */
    SetSoftOncePerTurn: (): EffectStep => activationCost((draftState, context) => {
        const p = draftState.players[context.playerIndex];
        const selfZone = p.pawnZones.find(z => z && z.card.instanceId === context.card.instanceId) || p.actionZones.find(z => z && z.card.instanceId === context.card.instanceId);
        if (selfZone) selfZone.hasActivatedEffect = true;
    }),

    /** Marks the card ID as having used its effect globally for the rest of the turn. */
    SetHardOncePerTurn: (cardId: string): EffectStep => activationCost((draftState, context) => {
        const p = draftState.players[context.playerIndex];
        if (!p.activatedHardOncePerTurns) p.activatedHardOncePerTurns = [];
        if (!p.activatedHardOncePerTurns.includes(cardId)) p.activatedHardOncePerTurns.push(cardId);
    }),

    // --- DECK SEARCHING ---

    /** Prompts the player to select a card from their deck matching a filter, then adds it to hand and shuffles. */
    SearchDeck: (filter: CardFilter): EffectStep => (draftState, context) => {
        if (context.deckIndex === undefined) {
            return { requireDeckSelection: { playerIndex: context.playerIndex, filter } };
        } else {
            const p = draftState.players[context.playerIndex];
            const card = p.deck[context.deckIndex];
            if (card && filter(card)) {
                p.deck.splice(context.deckIndex, 1);
                p.hand.push(card);

                // Shuffle deck (Fisher-Yates)
                for (let i = p.deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]];
                }
            } else return { halt: true };
        }
    }
};
