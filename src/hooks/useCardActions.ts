import { Dispatch, SetStateAction, useRef } from 'react';
import { Card, CardTarget, EffectTrigger, GameState, TargetSelectMode } from '../types';
import { cardRegistry } from '../cards/CardRegistry';
import { fieldActivations } from '../game/chains';
import { applyCommand, GameCommand } from '../game/engine';

type PlayMode = 'normal' | 'hidden' | 'activate' | 'set';
interface PlaySelection {
    setPendingPlayCard: (card: Card | null) => void;
    setPlayMode: (mode: PlayMode | null) => void;
    setTriggeredEffect?: (card: Card | null) => void;
    setPendingTriggerType?: (trigger: 'summon' | 'activate' | 'phase' | null) => void;
}
interface TributeSelection extends PlaySelection {
    setPendingTributeCard: (card: Card | null) => void;
    setTributeSelection: (indices: number[]) => void;
    setPendingTributeSlot: (slot: number | null) => void;
}

/** UI selection adapter. All committed card changes go through the shared engine. */
export function useCardActions(
    gameState: GameState | null,
    setGameState: Dispatch<SetStateAction<GameState | null>>,
    resolveEffect: (card: Card, target?: CardTarget, discardIndex?: number, handIndex?: number, deckIndex?: number, trigger?: EffectTrigger, tributes?: number[], targets?: CardTarget[]) => void,
    triggerVisual: (source: string, target: string, type: 'discard' | 'void' | 'retrieve', card?: Card) => void,
    setSelectedHandIndex: (index: number | null) => void,
    setSelectedFieldSlot: (slot: CardTarget | null) => void,
    setTargetSelectMode: (mode: TargetSelectMode) => void,
    blocked: boolean,
) {
    const pendingTributes = useRef<{ cardId: string; indices: number[] } | null>(null);
    const commit = (command: GameCommand): boolean => {
        if (!gameState || blocked) return false;
        const result = applyCommand(gameState, gameState.activePlayerIndex, command);
        if (result.state === gameState) return false;
        setGameState(previous => previous ? applyCommand(previous, gameState.activePlayerIndex, command).state : previous);
        return true;
    };
    const afterSummon = (card: Card, hidden: boolean, selection: PlaySelection) => {
        if (hidden || !cardRegistry.getEffect(card.id)?.onSummon) return;
        selection.setPendingTriggerType?.('summon');
        selection.setTriggeredEffect?.(card);
    };
    const placePawn = (card: Card, hidden: boolean, slot: number, tributes: number[], selection: PlaySelection) => {
        if (!commit({ type: 'summon', cardId: card.instanceId, hidden, slot, tributes })) return false;
        tributes.forEach(index => {
            const sacrifice = gameState!.players[gameState!.activePlayerIndex].pawnZones[index];
            if (sacrifice) triggerVisual(`${gameState!.activePlayerIndex}-pawn-${index}`, `discard-${gameState!.activePlayerIndex}`, 'discard', sacrifice.card);
        });
        afterSummon(card, hidden, selection);
        setSelectedHandIndex(null);
        return true;
    };
    const handleSummon = (card: Card, mode: 'normal' | 'hidden' | 'tribute',
        selection: TributeSelection & { setTributeSummonMode: (mode: 'normal' | 'hidden') => void }, slot?: number) => {
        if (!gameState || blocked || gameState.winner) return;
        pendingTributes.current = null;
        if (card.level >= 5) {
            selection.setPendingTributeCard(card);
            selection.setTributeSummonMode(mode === 'hidden' ? 'hidden' : 'normal');
            selection.setTributeSelection([]);
            selection.setPendingTributeSlot(slot ?? null);
            setTargetSelectMode('tribute');
        } else if (slot !== undefined) {
            placePawn(card, mode === 'hidden', slot, [], selection);
        } else {
            selection.setPendingPlayCard(card);
            selection.setPlayMode(mode === 'hidden' ? 'hidden' : 'normal');
            setTargetSelectMode('place_pawn');
            setSelectedHandIndex(null);
        }
    };
    const handleTributeSummon = (card: Card | null, tributes: number[], mode: 'normal' | 'hidden',
        slot: number | null, selection: TributeSelection) => {
        if (!gameState || !card || blocked) return;
        if (slot === null) {
            // Keep choices local until placement; sacrifice and summon commit together.
            pendingTributes.current = { cardId: card.instanceId, indices: [...tributes] };
            selection.setPendingPlayCard(card);
            selection.setPlayMode(mode);
            setTargetSelectMode('place_pawn');
        } else {
            if (!placePawn(card, mode === 'hidden', slot, tributes, selection)) return;
            selection.setPendingPlayCard(null);
            selection.setPlayMode(null);
            setTargetSelectMode(null);
        }
        selection.setPendingTributeCard(null);
        selection.setTributeSelection([]);
        selection.setPendingTributeSlot(null);
        setSelectedHandIndex(null);
    };
    const placeAction = (card: Card, mode: 'activate' | 'set', slot: number) => {
        if (!commit({ type: 'play', cardId: card.instanceId, set: mode === 'set', slot })) return false;
        const actor = gameState!.activePlayerIndex;
        triggerVisual(`${actor}-hand-container`, `${actor}-action-${slot}`, 'discard', card);
        if (mode === 'activate') resolveEffect(card, undefined, undefined, undefined, undefined, 'activate');
        setSelectedHandIndex(null);
        return true;
    };
    const handleActionFromHand = (card: Card, mode: 'activate' | 'set', selection: PlaySelection, slot?: number) => {
        if (!gameState || blocked || gameState.winner) return;
        if (slot !== undefined) { placeAction(card, mode, slot); return; }
        selection.setPendingPlayCard(card);
        selection.setPlayMode(mode);
        setTargetSelectMode('place_action');
        setSelectedHandIndex(null);
    };
    const handlePlacement = (slot: number, card: Card | null, mode: PlayMode | null, selection: PlaySelection) => {
        if (!card || !mode) return;
        const placed = mode === 'normal' || mode === 'hidden'
            ? placePawn(card, mode === 'hidden', slot, pendingTributes.current?.cardId === card.instanceId ? pendingTributes.current.indices : [], selection)
            : placeAction(card, mode, slot);
        if (!placed) return;
        pendingTributes.current = null;
        selection.setPendingPlayCard(null);
        selection.setPlayMode(null);
        if (mode !== 'activate') setTargetSelectMode(null);
    };
    const activateOnField = (playerIndex: number, type: 'pawn' | 'action', index: number) => {
        if (!gameState || blocked) return;
        const activation = fieldActivations(gameState, playerIndex).find(a => a.slot.type === type && a.slot.index === index);
        if (!activation) return;
        resolveEffect(activation.card, undefined, undefined, undefined, undefined, activation.trigger);
        setSelectedFieldSlot(null);
    };
    const canPlacePawn = (card: Card | null, mode: PlayMode | null, slot: number) => {
        if (!gameState || !card || !mode) return false;
        return applyCommand(gameState, gameState.activePlayerIndex, {
            type: 'summon', cardId: card.instanceId, hidden: mode === 'hidden', slot,
            tributes: pendingTributes.current?.cardId === card.instanceId ? pendingTributes.current.indices : [],
        }).state !== gameState;
    };
    return { handleSummon, handleTributeSummon, handleActionFromHand, handlePlacement, activateOnField, canPlacePawn };
}
