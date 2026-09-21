import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { Card, GameState, Phase } from '../types';
import { chooseAIAction, observeGame, simulateSummon } from '../game/opponentAI';
import { applyCommand } from '../game/engine';
import { cardRegistry } from '../cards/CardRegistry';
import type { useEffectResolution } from './useEffectResolution';

export function useOpponentAI({ gameState, setGameState, enabled, busy, nextPhase, requestAttack, resolveEffect }: {
    gameState: GameState | null; setGameState: Dispatch<SetStateAction<GameState | null>>; enabled: boolean; busy: boolean;
    nextPhase: () => void; requestAttack: (index: number, target: number | 'direct') => void;
    resolveEffect: ReturnType<typeof useEffectResolution>['resolveEffect'];
}) {
    const pendingSummon = useRef<Card | undefined>(undefined);
    const moves = useRef({ turn: 0, count: 0 });
    useEffect(() => {
        if (!enabled || !gameState || gameState.winner || busy || gameState.response?.ready) return;
        if (gameState.response ? gameState.response.priority !== 1 : gameState.activePlayerIndex !== 1) return;
        if (!gameState.response && ![Phase.MAIN1, Phase.MAIN2, Phase.BATTLE].includes(gameState.currentPhase)) return;
        const timer = setTimeout(() => {
            if (moves.current.turn !== gameState.turnNumber) moves.current = { turn: gameState.turnNumber, count: 0 };
            const summon = pendingSummon.current;
            pendingSummon.current = undefined;
            const action = chooseAIAction(observeGame(gameState, 1), 1, summon);
            if (moves.current.count++ > 70 && !gameState.response) { nextPhase(); return; }
            if (action.kind === 'pass') {
                if (gameState.response) setGameState(prev => prev ? applyCommand(prev, 1, { type: 'pass' }).state : prev);
                else if (summon) setGameState(prev => prev ? { ...prev } : prev);
                else nextPhase();
            } else if (action.kind === 'attack') requestAttack(action.index, action.target);
            else if (action.kind === 'summon') {
                if (!action.hidden && cardRegistry.getEffect(action.card.id)?.onSummon) pendingSummon.current = action.card;
                setGameState(prev => prev ? simulateSummon(prev, action.card, action.hidden, action.tributes) : prev);
            } else if (action.kind === 'position') {
                setGameState(prev => prev ? applyCommand(prev, 1, { type: 'position', index: action.index }).state : prev);
            } else if (action.kind === 'set' || action.kind === 'effect' && action.fromHand) {
                setGameState(prev => {
                    if (!prev) return prev;
                    const card = action.kind === 'set' ? action.card : action.context.card;
                    const next = applyCommand(prev, 1, { type: 'play', cardId: card.instanceId, set: action.kind === 'set', slot: prev.players[1].actionZones.indexOf(null) }).state;
                    if (next === prev || action.kind === 'set') return next;
                    const context = { ...action.context, deckIndex: action.deckId ? next.players[1].deck.findIndex(c => c.instanceId === action.deckId) : undefined };
                    return applyCommand(next, 1, { type: 'activate', context, trigger: action.trigger }).state;
                });
            } else if (action.kind === 'effect') {
                const c = action.context;
                const deckIndex = action.deckId ? gameState.players[1].deck.findIndex(card => card.instanceId === action.deckId) : undefined;
                // A human opponent chooses which of their cards Glass Witch reveals.
                resolveEffect(c.card, c.target, c.discardIndex, c.handIndex, deckIndex, action.trigger, c.tributeIndices, c.targets, undefined);
            }
        }, 650);
        return () => clearTimeout(timer);
    }, [gameState, enabled, busy, nextPhase, requestAttack, resolveEffect, setGameState]);
}
