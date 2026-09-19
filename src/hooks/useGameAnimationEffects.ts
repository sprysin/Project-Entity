import { Dispatch, SetStateAction, useEffect } from 'react';
import { GameState, Phase, Player } from '../types';
import type { useAnimations } from './useAnimations';
import { useManagedTimeout } from './useManagedTimeout';

type AnimationController = ReturnType<typeof useAnimations>;

/** Synchronizes visual-only timers and counters with committed game state. */
export const useGameAnimationEffects = (
    gameState: GameState | null,
    setGameState: Dispatch<SetStateAction<GameState | null>>,
    animations: AnimationController,
    nextPhase: () => void
) => {
    const schedule = useManagedTimeout();

    useEffect(() => {
        if (!gameState) return;
        gameState.players.forEach((player, index) => {
            if (player.discard.length > animations.prevDiscardLengths.current[index]) {
                animations.setDiscardFlash(previous => { const next = [...previous] as [boolean, boolean]; next[index] = true; return next; });
                schedule(() => animations.setDiscardFlash(previous => { const next = [...previous] as [boolean, boolean]; next[index] = false; return next; }), 800);
            }
            animations.prevDiscardLengths.current[index] = player.discard.length;
            if (player.void.length > animations.prevVoidLengths.current[index]) {
                animations.setVoidFlash(previous => { const next = [...previous] as [boolean, boolean]; next[index] = true; return next; });
                schedule(() => animations.setVoidFlash(previous => { const next = [...previous] as [boolean, boolean]; next[index] = false; return next; }), 800);
            }
            animations.prevVoidLengths.current[index] = player.void.length;
        });
    }, [gameState?.players, schedule]);

    useEffect(() => {
        if (!gameState) return;
        gameState.players.forEach((player, index) => {
            const previousLp = animations.lastLp.current[index];
            if (player.lp !== previousLp) {
                const difference = player.lp - previousLp;
                const id = crypto.randomUUID();
                animations.setFloatingTexts(previous => [...previous, { id, text: difference > 0 ? `+${difference}` : `${difference}`, type: difference > 0 ? 'heal' : 'damage', x: 50, y: 50 }]);
                schedule(() => animations.setFloatingTexts(previous => previous.filter(text => text.id !== id)), 2500);
                animations.lastLp.current[index] = player.lp;
            }
        });

        const intervals: ReturnType<typeof setInterval>[] = [];
        gameState.players.forEach((player, index) => {
            if (player.lp === animations.displayedLp[index]) return;
            const difference = player.lp - animations.displayedLp[index];
            const flash = difference > 0 ? 'heal' : 'damage';
            animations.setLpFlash(previous => { const next = [...previous] as [string | null, string | null]; next[index] = flash; return next; });
            animations.setLpScale(previous => { const next = [...previous] as [boolean, boolean]; next[index] = true; return next; });
            schedule(() => {
                animations.setLpFlash(previous => { const next = [...previous] as [string | null, string | null]; next[index] = null; return next; });
                animations.setLpScale(previous => { const next = [...previous] as [boolean, boolean]; next[index] = false; return next; });
            }, 800);

            const step = Math.ceil(Math.abs(difference) / 10);
            const interval = setInterval(() => {
                animations.setDisplayedLp(previous => {
                    const next = [...previous] as [number, number];
                    if (next[index] < player.lp) next[index] = Math.min(next[index] + step, player.lp);
                    else if (next[index] > player.lp) next[index] = Math.max(next[index] - step, player.lp);
                    if (next[index] === player.lp) clearInterval(interval);
                    return next;
                });
            }, 20);
            intervals.push(interval);
        });
        return () => intervals.forEach(clearInterval);
    }, [gameState?.players[0]?.lp, gameState?.players[1]?.lp, schedule]);

    useEffect(() => {
        if (!gameState || gameState.winner) return;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const later = (callback: () => void, delay: number) => timers.push(setTimeout(callback, delay));
        const phase = gameState.currentPhase;
        const active = gameState.activePlayerIndex;
        const turn = gameState.turnNumber;

        if (phase === Phase.DRAW) {
            animations.setTurnFlash('TURN CHANGE');
            later(() => animations.setTurnFlash(null), 1500);
            later(() => animations.setPhaseFlash(Phase.DRAW), 1200);
            setGameState(previous => {
                if (!previous || previous.winner) return previous;
                const players = [...previous.players] as [Player, Player];
                const player = players[active];
                players[active] = { ...player, normalSummonUsed: false, hiddenSummonUsed: false, pawnZones: player.pawnZones.map(zone => zone ? { ...zone, hasAttacked: false, hasChangedPosition: false } : null) };
                return { ...previous, players };
            });
            const player = gameState.players[active];
            const count = turn === 1 ? 0 : Math.min(player.deck.length, Math.max(1, 5 - player.hand.length));
            for (let index = 0; index < count; index++) {
                later(() => setGameState(previous => {
                    if (!previous || previous.winner || previous.turnNumber !== turn || previous.currentPhase !== Phase.DRAW) return previous;
                    const currentPlayer = previous.players[active];
                    if (!currentPlayer.deck.length) return previous;
                    const players = [...previous.players] as [Player, Player];
                    players[active] = { ...currentPlayer, hand: [...currentPlayer.hand, currentPlayer.deck[0]], deck: currentPlayer.deck.slice(1) };
                    return { ...previous, players };
                }), (index + 1) * 300);
            }
            later(nextPhase, Math.max(1700, count * 300 + 500));
        } else if (phase === Phase.STANDBY || phase === Phase.END) {
            animations.setPhaseFlash(phase);
            later(nextPhase, 1200);
        } else {
            animations.setPhaseFlash(phase);
        }
        return () => timers.forEach(clearTimeout);
    }, [gameState?.currentPhase, gameState?.activePlayerIndex, gameState?.turnNumber, gameState?.winner, nextPhase, setGameState]);
};
