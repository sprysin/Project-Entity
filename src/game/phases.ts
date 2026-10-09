import { fieldEntries } from './field';
import { GameState, Phase, Player, Position } from '../types';
import { notifyAttachedActivation } from './attachments';
import { cardRegistry } from '../cards/CardRegistry';
import { formatEffectLog } from './effectLog';
import { checkVictory } from './finishEffect';
import { drawCards } from './draw';
import { sendToOwnerPile } from './cardOwnership';
import { prepareVoidReturn } from './voidReturns';
import { isAwaitingDecision } from './decisions';
import { notifyFieldEvent } from './fieldEvents';

function resetTurnPlayer(player: Player): void {
    player.normalSummonUsed = false;
    player.hiddenSummonUsed = false;
    player.pawnZones.forEach(zone => {
        if (zone) { zone.hasAttacked = false; zone.hasChangedPosition = false; delete zone.nextBattleAttacks; delete zone.attacksRemaining; }
    });
}

/** Applies one complete phase transition, including phase-entry maintenance. */
export const advancePhaseState = (prev: GameState, destination?: Phase.END): GameState => {
    if (prev.winner || isAwaitingDecision(prev)) return prev;
    prev = structuredClone(prev);
    let nextPhase = prev.currentPhase;
    let activeIndex = prev.activePlayerIndex;
    let turnNumber = prev.turnNumber;

    if (destination === Phase.END || prev.turnNumber === 1 && prev.currentPhase === Phase.MAIN1) {
        nextPhase = Phase.END;
    } else {
        switch (prev.currentPhase) {
            case Phase.DRAW: nextPhase = Phase.STANDBY; break;
            case Phase.STANDBY: nextPhase = Phase.MAIN1; break;
            case Phase.MAIN1: nextPhase = Phase.BATTLE; break;
            case Phase.BATTLE: nextPhase = Phase.MAIN2; break;
            case Phase.MAIN2: nextPhase = Phase.END; break;
            case Phase.END:
                nextPhase = Phase.DRAW;
                activeIndex = (activeIndex + 1) % 2;
                turnNumber += 1;
                break;
        }
    }

    if (nextPhase === Phase.DRAW && prev.players[activeIndex].skipNextDrawPhase) {
        delete prev.players[activeIndex].skipNextDrawPhase;
        resetTurnPlayer(prev.players[activeIndex]);
        nextPhase = Phase.STANDBY;
        prev.log = [`${prev.players[activeIndex].name} skips their Draw Phase.`, ...prev.log].slice(0, 50);
    }

    let currentPendingEffects = prev.pendingEffects || [];
    let updatedPlayers = [...prev.players];
    let updatedLog = prev.log;

    // Explicit phase durations end before entering the following phase.
    const expired = currentPendingEffects.filter(effect => effect.duePhase === prev.currentPhase && effect.dueTurn <= prev.turnNumber);
    for (const effect of expired) for (const player of updatedPlayers) for (const zone of player.pawnZones) {
        if (zone?.card.instanceId !== effect.targetInstanceId) continue;
        const stat = effect.type === 'RESET_ATK' ? 'atk' : 'def';
        zone.card[stat] = effect.delta === undefined ? effect.value : zone.card[stat] - effect.delta;
    }
    currentPendingEffects = currentPendingEffects.filter(effect => !expired.includes(effect));
    prev.pendingEffects = currentPendingEffects;

    if (nextPhase === Phase.BATTLE) {
        updatedPlayers = updatedPlayers.map(p => ({
            ...p,
            pawnZones: p.pawnZones.map(z => z ? {
                ...z,
                attacksRemaining: z.nextBattleAttacks ?? 1,
                nextBattleAttacks: undefined,
            } : null)
        })) as [Player, Player];
    }

    {
        const dueReturns = (prev.temporaryVoidReturns ?? []).filter(entry => entry.phase === nextPhase && entry.dueTurn <= turnNumber);
        prev.pendingVoidReturns = [...(prev.pendingVoidReturns ?? []), ...dueReturns.map(({ cardId, playerIndex, position }) => ({ cardId, playerIndex, position }))];
        prev.temporaryVoidReturns = prev.temporaryVoidReturns?.filter(entry => !dueReturns.includes(entry));
        prev.log = updatedLog;
        const returnState = { ...prev, players: updatedPlayers as [Player, Player] };
        prepareVoidReturn(returnState);
        prev = returnState;
        updatedLog = returnState.log;
    }
    if (nextPhase === Phase.STANDBY) {
        let phaseState: GameState = { ...prev, players: updatedPlayers as [Player, Player], currentPhase: nextPhase, activePlayerIndex: activeIndex, turnNumber };
        const standbyPlayer = phaseState.players[activeIndex];
        for (const card of [...standbyPlayer.discard]) {
            if (!card.tributedByAction) continue;
            const phaseEffect = cardRegistry.getEffect(card.id)?.onPhaseChange;
            if (!phaseEffect) continue;
            const context = { card, playerIndex: activeIndex };
            const result = phaseEffect(phaseState, context);
            if (result?.newState && !result.halted) {
                const log = formatEffectLog(phaseState, result.newState, card, context, 'phase');
                phaseState = notifyFieldEvent({ ...result.newState, log: [log, ...phaseState.log].slice(0, 50) },
                    'onEffectActivated', { activatedCard: card, activatingPlayerIndex: activeIndex });
            }
        }
        const fieldEffects = fieldEntries(phaseState).flatMap(({ zone, target }) =>
            target.type !== 'pawn' && zone.position !== Position.HIDDEN && cardRegistry.getEffect(zone.card.id)?.onPhaseChange
                ? [{ card: zone.card, playerIndex: target.playerIndex }] : []);
        for (const context of fieldEffects) {
            const result = cardRegistry.getEffect(context.card.id)!.onPhaseChange!(phaseState, context);
            if (result.halted) continue;
            const next = notifyFieldEvent(notifyAttachedActivation(phaseState, result.newState, context.card),
                'onEffectActivated', { activatedCard: context.card, activatingPlayerIndex: context.playerIndex });
            next.log = [formatEffectLog(phaseState, next, context.card, context, 'phase'), ...next.log].slice(0, 50);
            phaseState = checkVictory(next);
            if (phaseState.winner) return phaseState;
        }
        prev = phaseState;
        currentPendingEffects = phaseState.pendingEffects;
        if (phaseState.winner) return phaseState;
        updatedPlayers = phaseState.players;
        updatedLog = phaseState.log;
    }

    // Expire only after End Phase responses finish, immediately before the next turn.
    if (prev.currentPhase === Phase.END) {
        for (const land of prev.landStack ?? []) {
            if (land.card.effectText.includes('Once per turn')) land.hasActivatedEffect = false;
            delete land.card.effectTargetBlockedThisTurn;
        }
        for (const player of updatedPlayers) for (const zone of [...player.pawnZones, ...player.actionZones]) {
            if (!zone) continue;
            delete zone.attackOverride;
            delete zone.card.tributeBlockedThisTurn;
            delete zone.card.effectTargetBlockedThisTurn;
        }
        for (const player of updatedPlayers) player.pawnZones.forEach((zone, index) => {
            if (!zone?.returnToOwnerEndPhase) return;
            const leaving = { ...prev, players: updatedPlayers as [Player, Player] };
            sendToOwnerPile(leaving, zone.card, 'discard');
            prev.pendingReactions = leaving.pendingReactions;
            player.pawnZones[index] = null;
        });
        const effectsToResolve = currentPendingEffects.filter(e => !e.duePhase && e.dueTurn === prev.turnNumber && (e.type === 'RESET_ATK' || e.type === 'RESET_DEF'));
        const remainingEffects = currentPendingEffects.filter(e => !effectsToResolve.includes(e));
        updatedPlayers = updatedPlayers.map(p => ({
            ...p,
            activatedHardOncePerTurns: [],
            pawnZones: p.pawnZones.map(z => {
                if (!z) return null;
                let newZ = { ...z };
                if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                const atkEffects = effectsToResolve.filter(e => e.type === 'RESET_ATK' && e.targetInstanceId === z.card.instanceId);
                for (const atkEffect of atkEffects) newZ = { ...newZ, card: { ...newZ.card, atk: atkEffect.delta === undefined ? atkEffect.value : newZ.card.atk - atkEffect.delta } };
                const defEffect = effectsToResolve.find(e => e.type === 'RESET_DEF' && e.targetInstanceId === z.card.instanceId);
                if (defEffect) newZ = { ...newZ, card: { ...newZ.card, def: defEffect.value } };
                return newZ;
            }),
            actionZones: p.actionZones.map(z => {
                if (!z) return null;
                const newZ = { ...z };
                if (z.card.effectText?.includes('Once per turn')) newZ.hasActivatedEffect = false;
                return newZ;
            })
        })) as [Player, Player];
        currentPendingEffects = remainingEffects;
    }

    if (turnNumber !== prev.turnNumber) {
        updatedLog = [`Turn ${turnNumber}`, ...updatedLog].slice(0, 50);
    }

    return checkVictory({ ...prev, currentPhase: nextPhase, activePlayerIndex: activeIndex, turnNumber, players: updatedPlayers as [Player, Player], pendingEffects: currentPendingEffects, log: updatedLog });
};


/** A host may step draws individually for presentation; rules own the remaining count. */
export function stepDraw(state: GameState): GameState {
    if (state.winner || isAwaitingDecision(state) || state.currentPhase !== Phase.DRAW || state.response) return state;
    let next = state;
    if (next.drawProgress?.turn !== next.turnNumber) {
        next = structuredClone(state);
        const player = next.players[next.activePlayerIndex];
        resetTurnPlayer(player);
        next.drawProgress = { turn: next.turnNumber, remaining: next.turnNumber === 1 ? 0 : Math.max(1, 5 - player.hand.length) };
    }
    if (!next.drawProgress!.remaining) return next;
    next = drawCards(next, next.activePlayerIndex, 1);
    return { ...next, drawProgress: { turn: next.turnNumber, remaining: next.drawProgress!.remaining - 1 } };
}

export function pendingDrawCount(state: GameState): number {
    if (state.winner || state.currentPhase !== Phase.DRAW || state.turnNumber === 1) return 0;
    return state.drawProgress?.turn === state.turnNumber ? state.drawProgress.remaining : Math.max(1, 5 - state.players[state.activePlayerIndex].hand.length);
}

/** The entire required turn draw completes before either player can activate effects. */
export function isDrawingForTurn(state: GameState): boolean {
    return state.currentPhase === Phase.DRAW && !state.winner
        && (state.drawProgress?.turn !== state.turnNumber || state.drawProgress.remaining > 0);
}
