import { Dispatch, SetStateAction, useCallback } from 'react';
import { Card, CardTarget, GameState, Phase, Player, Position, TargetSelectMode } from '../types';
import { clonePlayers } from '../game/cloneState';
import { checkVictory } from '../game/finishEffect';

const quote = (value: string) => `"${value}"`;

const lpLoss = (player: Player, amount: number) => `${quote(player.name)} -${amount} LP.`;

export const useCombatActions = (
    gameState: GameState | null,
    setGameState: Dispatch<SetStateAction<GameState | null>>,
    isInteractionBlocked: boolean,
    triggerVisual: (source: string, target: string, type: 'discard' | 'void' | 'retrieve', card?: Card) => void,
    triggerShatter: (zoneKey: string) => void,
    setTargetSelectMode: (mode: TargetSelectMode) => void,
    setSelectedFieldSlot: (slot: CardTarget | null) => void
) => useCallback((attackerIndex: number, targetIndex: number | 'direct') => {
    if (!gameState || gameState.winner || gameState.currentPhase !== Phase.BATTLE || gameState.turnNumber === 1 || isInteractionBlocked) return;
    const activeIndex = gameState.activePlayerIndex;
    const opponentIndex = (activeIndex + 1) % 2;
    const attacker = gameState.players[activeIndex].pawnZones[attackerIndex];
    if (!attacker || attacker.position !== Position.ATTACK) return;
    if (attacker.attacksRemaining !== undefined ? attacker.attacksRemaining <= 0 : attacker.hasAttacked) return;
    if (targetIndex === 'direct' && gameState.players[opponentIndex].pawnZones.some(Boolean)) return;

    const logs: string[] = [];
    const players = clonePlayers(gameState.players);
    const activePlayer = players[activeIndex];
    const opponent = players[opponentIndex];
    const attackingPawn = { ...activePlayer.pawnZones[attackerIndex]! };

    if (targetIndex === 'direct') {
        opponent.lp -= attackingPawn.card.atk;
        logs.push(`${quote(attackingPawn.card.name)} attacked directly. ${lpLoss(opponent, attackingPawn.card.atk)}`);
    } else {
        const defending = opponent.pawnZones[targetIndex];
        if (!defending) return;
        const defendingPawn = { ...defending, position: defending.position === Position.HIDDEN ? Position.DEFENSE : defending.position };
        const reveal = defending.position === Position.HIDDEN
            ? `${quote(defendingPawn.card.name)} flipped face up. `
            : '';
        if (defending.position === Position.HIDDEN) {
            opponent.pawnZones[targetIndex] = defendingPawn;
        }

        if (defendingPawn.position === Position.ATTACK) {
            const difference = attackingPawn.card.atk - defendingPawn.card.atk;
            if (difference > 0) {
                triggerShatter(`${opponentIndex}-pawn-${targetIndex}`);
                opponent.lp -= difference;
                triggerVisual(`${opponentIndex}-pawn-${targetIndex}`, `discard-${opponentIndex}`, 'discard', defendingPawn.card);
                opponent.discard.push(defendingPawn.card);
                opponent.pawnZones[targetIndex] = null;
                logs.push(`${reveal}${quote(attackingPawn.card.name)} destroyed ${quote(defendingPawn.card.name)} by battle. ${lpLoss(opponent, difference)}`);
            } else if (difference < 0) {
                triggerShatter(`${activeIndex}-pawn-${attackerIndex}`);
                activePlayer.lp += difference;
                triggerVisual(`${activeIndex}-pawn-${attackerIndex}`, `discard-${activeIndex}`, 'discard', attackingPawn.card);
                activePlayer.discard.push(attackingPawn.card);
                activePlayer.pawnZones[attackerIndex] = null;
                logs.push(`${reveal}${quote(defendingPawn.card.name)} destroyed ${quote(attackingPawn.card.name)} by battle. ${lpLoss(activePlayer, -difference)}`);
            } else {
                triggerShatter(`${activeIndex}-pawn-${attackerIndex}`);
                triggerShatter(`${opponentIndex}-pawn-${targetIndex}`);
                triggerVisual(`${activeIndex}-pawn-${attackerIndex}`, `discard-${activeIndex}`, 'discard', attackingPawn.card);
                triggerVisual(`${opponentIndex}-pawn-${targetIndex}`, `discard-${opponentIndex}`, 'discard', defendingPawn.card);
                activePlayer.discard.push(attackingPawn.card);
                opponent.discard.push(defendingPawn.card);
                activePlayer.pawnZones[attackerIndex] = null;
                opponent.pawnZones[targetIndex] = null;
                logs.push(`${reveal}${quote(attackingPawn.card.name)} and ${quote(defendingPawn.card.name)} destroyed each other by battle.`);
            }
        } else if (attackingPawn.card.atk > defendingPawn.card.def) {
            triggerShatter(`${opponentIndex}-pawn-${targetIndex}`);
            triggerVisual(`${opponentIndex}-pawn-${targetIndex}`, `discard-${opponentIndex}`, 'discard', defendingPawn.card);
            opponent.discard.push(defendingPawn.card);
            opponent.pawnZones[targetIndex] = null;
            logs.push(`${reveal}${quote(attackingPawn.card.name)} destroyed ${quote(defendingPawn.card.name)} by battle.`);
        } else if (attackingPawn.card.atk < defendingPawn.card.def) {
            const recoil = defendingPawn.card.def - attackingPawn.card.atk;
            activePlayer.lp -= recoil;
            logs.push(`${reveal}${quote(attackingPawn.card.name)} attacked ${quote(defendingPawn.card.name)}. ${lpLoss(activePlayer, recoil)}`);
        } else {
            logs.push(`${reveal}${quote(attackingPawn.card.name)} attacked ${quote(defendingPawn.card.name)}; neither Pawn was destroyed.`);
        }
    }

    const placedAttacker = activePlayer.pawnZones[attackerIndex];
    if (placedAttacker) {
        if (placedAttacker.attacksRemaining !== undefined) {
            placedAttacker.attacksRemaining -= 1;
            placedAttacker.hasAttacked = placedAttacker.attacksRemaining <= 0;
        } else {
            placedAttacker.hasAttacked = true;
        }
    }
    players[activeIndex] = activePlayer;
    players[opponentIndex] = opponent;
    setGameState(checkVictory({ ...gameState, players: players as [Player, Player], log: [...logs, ...gameState.log].slice(0, 50) }));
    setTargetSelectMode(null);
    setSelectedFieldSlot(null);
}, [gameState, isInteractionBlocked, setGameState, triggerVisual, triggerShatter, setTargetSelectMode, setSelectedFieldSlot]);
