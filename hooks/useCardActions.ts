import { useCallback, Dispatch, SetStateAction } from 'react';
import { GameState, Card, CardType, Phase, Position, Player, CardContext, CardTarget, EffectTrigger, TargetSelectMode } from '../types';
import { cardRegistry } from '../src/cards/CardRegistry';
import { clonePlayers } from '../src/game/cloneState';
import { useCombatActions } from './useCombatActions';
import { formatSummonLog } from '../src/game/effectLog';

/**
 * Hook for card action handlers: summon, tribute, action cards, field activation, and combat.
 */
export const useCardActions = (
    gameState: GameState | null,
    setGameState: Dispatch<SetStateAction<GameState | null>>,
    resolveEffect: (card: Card, target?: CardTarget, discardIndex?: number, handIndex?: number, deckIndex?: number, triggerType?: EffectTrigger, tributeIndices?: number[]) => void,
    triggerVisual: (src: string, tgt: string, type: 'discard' | 'void' | 'retrieve', card?: Card) => void,
    triggerShatter: (zoneKey: string) => void,
    selectedHandIndex: number | null,
    setSelectedHandIndex: (idx: number | null) => void,
    setSelectedFieldSlot: (slot: CardTarget | null) => void,
    setTargetSelectMode: (mode: TargetSelectMode) => void,
    isPeekingField: boolean,
    targetSelectMode: TargetSelectMode,
) => {
    const handleAttack = useCombatActions(
        gameState, setGameState, isPeekingField, triggerVisual, triggerShatter,
        setTargetSelectMode, setSelectedFieldSlot
    );

    /** Core logic for Summoning or Setting an Pawn. */
    const handleSummon = useCallback((
        card: Card, mode: 'normal' | 'hidden' | 'tribute',
        tributeState: {
            setPendingTributeCard: (c: Card | null) => void,
            setTributeSummonMode: (m: 'normal' | 'hidden') => void,
            setTributeSelection: (s: number[]) => void,
            setPendingPlayCard: (c: Card | null) => void,
            setPlayMode: (m: 'normal' | 'hidden' | 'activate' | 'set' | null) => void,
            setTriggeredEffect?: (c: Card | null) => void,
            setPendingTriggerType?: (t: 'summon' | 'activate' | 'phase' | null) => void,
        },
        autoSlotIndex?: number
    ) => {
        if (!gameState || gameState.winner || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;

        const pIdx = gameState.activePlayerIndex;
        const p = gameState.players[pIdx];

        if (card.level >= 5 && mode !== 'tribute') {
            const pawnCount = p.pawnZones.filter(z => z !== null).length;
            const required = card.level <= 7 ? 1 : 2;
            if (pawnCount < required) {
                return;
            }
            tributeState.setPendingTributeCard(card);
            tributeState.setTributeSummonMode(mode === 'hidden' ? 'hidden' : 'normal');
            tributeState.setTributeSelection([]);
            setTargetSelectMode('tribute');
            return;
        }

        if (card.level <= 4) {
            if (mode === 'normal' && p.normalSummonUsed) return;
            if (mode === 'hidden' && p.hiddenSummonUsed) return;
        }

        if (autoSlotIndex !== undefined) {
            if (p.pawnZones[autoSlotIndex] !== null) return;
            setGameState(prev => {
                if (!prev) return null;
                const players = clonePlayers(prev.players);
                const p = players[pIdx];
                if (p.pawnZones[autoSlotIndex] !== null) { return prev; }

                p.pawnZones[autoSlotIndex] = {
                    card: { ...card }, position: mode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                    hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: mode === 'hidden'
                };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== card.instanceId);

                if (mode === 'normal') p.normalSummonUsed = true;
                if (mode === 'hidden') p.hiddenSummonUsed = true;

                players[pIdx] = p;
                const log = mode === 'hidden' ? prev.log : [formatSummonLog(card), ...prev.log].slice(0, 50);
                return { ...prev, players: players as [Player, Player], log };
            });

            if (mode !== 'hidden') {
                const effect = cardRegistry.getEffect(card.id);
                if (effect?.onSummon && tributeState.setTriggeredEffect && tributeState.setPendingTriggerType) {
                    tributeState.setPendingTriggerType('summon');
                    tributeState.setTriggeredEffect(card);
                } else {
                    resolveEffect(card, undefined, undefined, undefined, undefined, 'summon');
                }
            }
            setSelectedHandIndex(null);
            return;
        }

        // Enter Placement Mode
        tributeState.setPendingPlayCard(card);
        tributeState.setPlayMode(mode === 'normal' ? 'normal' : 'hidden');
        setTargetSelectMode('place_pawn');
        setSelectedHandIndex(null);
    }, [gameState, isPeekingField, setGameState, resolveEffect, setSelectedHandIndex, setTargetSelectMode]);

    /** Finalizes a tribute summon once required sacrifices are selected. */
    const handleTributeSummon = useCallback((
        pendingTributeCard: Card | null,
        tributeSelection: number[],
        tributeSummonMode: 'normal' | 'hidden',
        tributeState: {
            setPendingTributeCard: (c: Card | null) => void,
            setTributeSelection: (s: number[]) => void,
            setPendingPlayCard: (c: Card | null) => void,
            setPlayMode: (m: 'normal' | 'hidden' | 'activate' | 'set' | null) => void,
        }
    ) => {
        if (!gameState || !pendingTributeCard || isPeekingField) return;
        const activeIndex = gameState.activePlayerIndex;
        const required = pendingTributeCard.level <= 7 ? 1 : 2;
        if (tributeSelection.length !== required) return;

        // Visual discard effect for tributes
        tributeSelection.forEach(idx => {
            const sacrifice = gameState.players[activeIndex].pawnZones[idx];
            if (sacrifice) triggerVisual(`${activeIndex}-pawn-${idx}`, `discard-${activeIndex}`, 'discard', sacrifice.card);
        });

        // Execute Tribute Logic (remove sacrifices)
        setGameState(prev => {
            if (!prev) return null;
            const players = clonePlayers(prev.players);
            const p = players[activeIndex];
            tributeSelection.forEach(idx => {
                const tribute = p.pawnZones[idx];
                if (tribute) { p.discard = [...p.discard, tribute.card]; p.pawnZones[idx] = null; }
            });
            players[activeIndex] = p;
            return { ...prev, players: players as [Player, Player] };
        });

        // Transition to Placement Mode
        tributeState.setPendingPlayCard(pendingTributeCard);
        tributeState.setPlayMode(tributeSummonMode);
        tributeState.setPendingTributeCard(null);
        tributeState.setTributeSelection([]);
        setTargetSelectMode('place_pawn');
        setSelectedHandIndex(null);

    }, [gameState, isPeekingField, setGameState, resolveEffect, triggerVisual, setSelectedHandIndex, setTargetSelectMode]);

    /** Handles playing Action or Condition cards from hand. */
    const handleActionFromHand = useCallback((
        card: Card, mode: 'activate' | 'set',
        playState: {
            setPendingPlayCard: (c: Card | null) => void,
            setPlayMode: (m: 'normal' | 'hidden' | 'activate' | 'set' | null) => void,
            setTriggeredEffect?: (c: Card | null) => void,
            setPendingTriggerType?: (t: 'summon' | 'activate' | 'phase' | null) => void,
        },
        autoSlotIndex?: number
    ) => {
        if (!gameState || gameState.winner || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;
        const activeIndex = gameState.activePlayerIndex;

        if (mode !== 'set') {
            if (card.type === CardType.CONDITION) return;
            const context: CardContext = { card, playerIndex: activeIndex };
            const effect = cardRegistry.getEffect(card.id);
            if (effect?.canActivate && !effect.canActivate(gameState, context)) {
                return;
            }
        }

        if (autoSlotIndex !== undefined) {
            if (gameState.players[activeIndex].actionZones[autoSlotIndex] !== null) return;
            triggerVisual(`${activeIndex}-hand-container`, `${activeIndex}-action-${autoSlotIndex}`, 'discard', card);
            setGameState(prev => {
                if (!prev) return null;
                const players = clonePlayers(prev.players);
                const p = players[activeIndex];
                if (p.actionZones[autoSlotIndex] !== null) { return prev; }

                p.actionZones[autoSlotIndex] = { card: { ...card }, position: mode === 'set' ? Position.HIDDEN : Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: mode === 'set' };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== card.instanceId);
                players[activeIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            if (mode === 'activate') {
                resolveEffect(card, undefined, undefined, undefined, undefined, 'activate');
            }
            setSelectedHandIndex(null);
            return;
        }

        if (mode === 'set') {
            // Enter Placement Mode for Set
            playState.setPendingPlayCard(card);
            playState.setPlayMode('set');
            setTargetSelectMode('place_action');
        } else {
            playState.setPendingPlayCard(card);
            playState.setPlayMode('activate');
            setTargetSelectMode('place_action');
        }
        setSelectedHandIndex(null);
    }, [gameState, isPeekingField, selectedHandIndex, setGameState, resolveEffect, triggerVisual, setSelectedHandIndex, setTargetSelectMode]);

    /** Executes the actual placement of the card into the selected slot. */
    const handlePlacement = useCallback((
        slotIndex: number,
        pendingPlayCard: Card | null,
        playMode: 'normal' | 'hidden' | 'activate' | 'set' | null,
        playState: {
            setPendingPlayCard: (c: Card | null) => void,
            setPlayMode: (m: 'normal' | 'hidden' | 'activate' | 'set' | null) => void,
            setTriggeredEffect?: (c: Card | null) => void,
            setPendingTriggerType?: (t: 'summon' | 'activate' | 'phase' | null) => void,
        }
    ) => {
        if (!gameState || gameState.winner || isPeekingField || !pendingPlayCard || !playMode) return;
        const pIdx = gameState.activePlayerIndex;

        if (targetSelectMode === 'place_pawn' && pendingPlayCard.type === CardType.PAWN) {
            if (gameState.players[pIdx].pawnZones[slotIndex] !== null) return;
            setGameState(prev => {
                if (!prev) return null;
                const players = clonePlayers(prev.players);
                const p = players[pIdx];
                if (p.pawnZones[slotIndex] !== null) { return prev; } // Should be prevented by UI

                p.pawnZones[slotIndex] = {
                    card: { ...pendingPlayCard }, position: playMode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                    hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: playMode === 'hidden'
                };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== pendingPlayCard.instanceId);

                // Mark summons used
                if (playMode === 'normal') {
                    if (pendingPlayCard.level <= 4) p.normalSummonUsed = true;
                    // If level >= 5, it counts as a tribute summon which might track separately or as normal.
                    // For now, let's treat it as using the normal summon slot.
                    else p.normalSummonUsed = true;
                }
                if (playMode === 'hidden') {
                    if (pendingPlayCard.level <= 4) p.hiddenSummonUsed = true;
                    else p.hiddenSummonUsed = true;
                }

                players[pIdx] = p;
                const log = playMode === 'hidden' ? prev.log : [formatSummonLog(pendingPlayCard), ...prev.log].slice(0, 50);
                return { ...prev, players: players as [Player, Player], log };
            });

            if (playMode !== 'hidden') {
                const effect = cardRegistry.getEffect(pendingPlayCard.id);
                if (effect?.onSummon && playState.setTriggeredEffect && playState.setPendingTriggerType) {
                    playState.setPendingTriggerType('summon');
                    playState.setTriggeredEffect(pendingPlayCard);
                } else {
                    resolveEffect(pendingPlayCard, undefined, undefined, undefined, undefined, 'summon');
                }
            }

        } else if (targetSelectMode === 'place_action') {
            if (gameState.players[pIdx].actionZones[slotIndex] !== null) return;
            triggerVisual(`${pIdx}-hand-container`, `${pIdx}-action-${slotIndex}`, 'discard', pendingPlayCard);
            setGameState(prev => {
                if (!prev) return null;
                const players = clonePlayers(prev.players);
                const p = players[pIdx];
                if (p.actionZones[slotIndex] !== null) { return prev; }

                if (playMode === 'set') {
                    p.actionZones[slotIndex] = { card: { ...pendingPlayCard }, position: Position.HIDDEN, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: true };
                    p.hand = p.hand.filter((h: Card) => h.instanceId !== pendingPlayCard.instanceId);
                } else {
                    // Activate Action
                    p.actionZones[slotIndex] = { card: { ...pendingPlayCard }, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: false }; // Place temporarily
                    p.hand = p.hand.filter((h: Card) => h.instanceId !== pendingPlayCard.instanceId);
                    // Do not add to discard here; handle post-resolution cleanup
                }
                players[pIdx] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            if (playMode === 'activate') {
                resolveEffect(pendingPlayCard, undefined, undefined, undefined, undefined, 'activate');
            }
        }

        // Keep any selection mode requested by the activated effect.
        playState.setPendingPlayCard(null);
        playState.setPlayMode(null);
        if (playMode !== 'activate') setTargetSelectMode(null);

    }, [gameState, isPeekingField, setGameState, resolveEffect, triggerVisual, setTargetSelectMode, targetSelectMode]);


    /** Activates a card already on the field (flipping or triggering). */
    const activateOnField = useCallback((playerIndex: number, type: 'pawn' | 'action', index: number) => {
        if (!gameState || gameState.winner || isPeekingField) return;
        const p = gameState.players[playerIndex];
        const zone = type === 'pawn' ? p.pawnZones : p.actionZones;
        const placed = zone[index];
        if (!placed) return;

        if (gameState.currentPhase === Phase.BATTLE && placed.card.type === CardType.ACTION) {
            if (!placed.card.isLingering) {
                return;
            } else if (placed.position === Position.HIDDEN) {
                return;
            }
        }

        const context: CardContext = { card: placed.card, playerIndex };
        const effect = cardRegistry.getEffect(placed.card.id);
        if (effect?.canActivate && !effect.canActivate(gameState, context)) {
            return;
        }
        if (placed.card.type === CardType.CONDITION && gameState.turnNumber <= placed.summonedTurn) return;

        if (placed.position === Position.HIDDEN) {
            setGameState(prev => {
                if (!prev) return null;
                const players = clonePlayers(prev.players);
                const ply = players[playerIndex];
                const zn = type === 'pawn' ? ply.pawnZones : ply.actionZones;
                zn[index] = { ...zn[index]!, position: Position.ATTACK };
                players[playerIndex] = ply;
                return { ...prev, players: players as [Player, Player] };
            });
        }

        const trigger = (type === 'action' && placed.position !== Position.HIDDEN) ? 'field_activate' : 'activate';
        resolveEffect(placed.card, undefined, undefined, undefined, undefined, trigger);

        setGameState(prev => {
            if (!prev) return null;
            const players = clonePlayers(prev.players);
            const ply = players[playerIndex];
            const zn = type === 'pawn' ? ply.pawnZones : ply.actionZones;
            if (zn[index]) zn[index].hasActivatedEffect = true;
            players[playerIndex] = ply;
            return { ...prev, players: players as [Player, Player] };
        });
        setSelectedFieldSlot(null);
    }, [gameState, isPeekingField, setGameState, resolveEffect, triggerVisual, setSelectedFieldSlot]);

    return {
        handleSummon,
        handleTributeSummon,
        handleActionFromHand,
        handlePlacement,
        activateOnField,
        handleAttack,
    };
};
