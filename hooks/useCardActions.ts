import { useCallback, Dispatch, SetStateAction } from 'react';
import { GameState, Card, CardType, Phase, Position, Player, CardContext, EffectResult } from '../types';
import { cardRegistry } from '../src/cards/CardRegistry';

/**
 * Hook for card action handlers: summon, tribute, action cards, field activation, and combat.
 */
export const useCardActions = (
    gameState: GameState | null,
    setGameState: Dispatch<SetStateAction<GameState | null>>,
    resolveEffect: (card: Card, target?: any, discardIndex?: number, handIndex?: number, triggerType?: 'summon' | 'activate' | 'phase') => void,
    addLog: (msg: string) => void,
    triggerVisual: (src: string, tgt: string, type: 'discard' | 'void' | 'retrieve', card?: Card) => void,
    triggerShatter: (zoneKey: string) => void,
    selectedHandIndex: number | null,
    setSelectedHandIndex: (idx: number | null) => void,
    setSelectedFieldSlot: (slot: any) => void,
    setTargetSelectMode: (mode: 'attack' | 'tribute' | 'effect' | 'place_entity' | 'place_action' | null) => void,
    isPeekingField: boolean,
    targetSelectMode: 'attack' | 'tribute' | 'effect' | 'place_entity' | 'place_action' | null,
) => {
    // Tribute summon state is managed in the main hook and passed down
    // These are provided by the main hook via closure

    /** Core logic for Summoning or Setting an Entity. */
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
        if (!gameState || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;

        const pIdx = gameState.activePlayerIndex;
        const p = gameState.players[pIdx];

        if (card.level >= 5 && mode !== 'tribute') {
            const entityCount = p.entityZones.filter(z => z !== null).length;
            const required = card.level <= 7 ? 1 : 2;
            if (entityCount < required) {
                addLog(`ACCESS DENIED: Level ${card.level} requires ${required} sacrifices.`);
                return;
            }
            tributeState.setPendingTributeCard(card);
            tributeState.setTributeSummonMode(mode === 'hidden' ? 'hidden' : 'normal');
            tributeState.setTributeSelection([]);
            setTargetSelectMode('tribute');
            addLog(`TRIBUTE MODE (${mode === 'hidden' ? 'SET' : 'SUMMON'}): Select ${required} entities for sacrifice.`);
            return;
        }

        if (card.level <= 4) {
            if (mode === 'normal' && p.normalSummonUsed) { addLog("Normal Summon limit reached for this turn."); return; }
            if (mode === 'hidden' && p.hiddenSummonUsed) { addLog("Set limit reached for this turn."); return; }
        }

        if (autoSlotIndex !== undefined) {
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[pIdx];
                if (p.entityZones[autoSlotIndex] !== null) { addLog("SLOT OCCUPIED."); return prev; }

                p.entityZones[autoSlotIndex] = {
                    card: { ...card }, position: mode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                    hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: mode === 'hidden'
                };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== card.instanceId);

                if (mode === 'normal') p.normalSummonUsed = true;
                if (mode === 'hidden') p.hiddenSummonUsed = true;

                players[pIdx] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            if (mode !== 'hidden') {
                const effect = cardRegistry.getEffect(card.id);
                if (effect?.onSummon && tributeState.setTriggeredEffect && tributeState.setPendingTriggerType) {
                    tributeState.setPendingTriggerType('summon');
                    tributeState.setTriggeredEffect(card);
                } else {
                    resolveEffect(card, undefined, undefined, undefined, 'summon');
                }
            }
            setSelectedHandIndex(null);
            return;
        }

        // Enter Placement Mode
        tributeState.setPendingPlayCard(card);
        tributeState.setPlayMode(mode === 'normal' ? 'normal' : 'hidden');
        setTargetSelectMode('place_entity');
        addLog(`SELECT ZONE: Choose a slot for ${card.name}.`);
        setSelectedHandIndex(null);
    }, [gameState, isPeekingField, setGameState, resolveEffect, addLog, setSelectedHandIndex, setTargetSelectMode]);

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
            const sacrifice = gameState.players[activeIndex].entityZones[idx];
            if (sacrifice) triggerVisual(`${activeIndex}-entity-${idx}`, `discard-${activeIndex}`, 'discard', sacrifice.card);
        });

        // Execute Tribute Logic (remove sacrifices)
        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const p = players[activeIndex];
            tributeSelection.forEach(idx => {
                const tribute = p.entityZones[idx];
                if (tribute) { p.discard = [...p.discard, tribute.card]; p.entityZones[idx] = null; }
            });
            players[activeIndex] = p;
            return { ...prev, players: players as [Player, Player] };
        });

        // Transition to Placement Mode
        tributeState.setPendingPlayCard(pendingTributeCard);
        tributeState.setPlayMode(tributeSummonMode);
        tributeState.setPendingTributeCard(null);
        tributeState.setTributeSelection([]);
        setTargetSelectMode('place_entity');
        addLog(`SELECT ZONE: Choose a slot for ${pendingTributeCard.name}.`);
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
        if (!gameState || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;
        const activeIndex = gameState.activePlayerIndex;

        if (mode !== 'set') {
            if (card.type === CardType.CONDITION) return;
            const context: CardContext = { card, playerIndex: activeIndex };
            const effect = cardRegistry.getEffect(card.id);
            if (effect?.canActivate && !effect.canActivate(gameState, context)) {
                addLog(`RESTRICTION: Activation conditions for ${card.name} not met.`);
                return;
            }
        }

        if (autoSlotIndex !== undefined) {
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[activeIndex];
                if (p.actionZones[autoSlotIndex] !== null) { addLog("SLOT OCCUPIED."); return prev; }

                triggerVisual(`${activeIndex}-hand-container`, `${activeIndex}-action-${autoSlotIndex}`, 'discard', card);
                p.actionZones[autoSlotIndex] = { card: { ...card }, position: mode === 'set' ? Position.HIDDEN : Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: mode === 'set' };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== card.instanceId);
                players[activeIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            if (mode === 'activate') {
                resolveEffect(card, undefined, undefined, undefined, 'activate');
                if (!card.isLingering) {
                    setTimeout(() => {
                        triggerVisual(`${activeIndex}-action-${autoSlotIndex}`, `discard-${activeIndex}`, 'discard', card);
                        setGameState(current => {
                            if (!current) return null;
                            const players = JSON.parse(JSON.stringify(current.players));
                            const ply = players[activeIndex];
                            if (ply.actionZones[autoSlotIndex] !== null) {
                                ply.discard = [...ply.discard, { ...ply.actionZones[autoSlotIndex].card }];
                                ply.actionZones[autoSlotIndex] = null;
                            }
                            players[activeIndex] = ply;
                            return { ...current, players: players as [Player, Player] };
                        });
                    }, 1500);
                }
            }
            setSelectedHandIndex(null);
            return;
        }

        if (mode === 'set') {
            // Enter Placement Mode for Set
            playState.setPendingPlayCard(card);
            playState.setPlayMode('set');
            setTargetSelectMode('place_action');
            addLog(`SELECT ZONE: Choose a slot to Set ${card.name}.`);
        } else {
            playState.setPendingPlayCard(card);
            playState.setPlayMode('activate');
            setTargetSelectMode('place_action');
            addLog(`SELECT ZONE: Choose a slot to Activate ${card.name}.`);
        }
        setSelectedHandIndex(null);
    }, [gameState, isPeekingField, selectedHandIndex, setGameState, resolveEffect, addLog, triggerVisual, setSelectedHandIndex, setTargetSelectMode]);

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
        if (!gameState || !pendingPlayCard || !playMode) return;
        const pIdx = gameState.activePlayerIndex;

        if (targetSelectMode === 'place_entity' && pendingPlayCard.type === CardType.ENTITY) {
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[pIdx];
                if (p.entityZones[slotIndex] !== null) { addLog("SLOT OCCUPIED."); return prev; } // Should be prevented by UI

                p.entityZones[slotIndex] = {
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
                return { ...prev, players: players as [Player, Player] };
            });

            if (playMode !== 'hidden') {
                const effect = cardRegistry.getEffect(pendingPlayCard.id);
                if (effect?.onSummon && playState.setTriggeredEffect && playState.setPendingTriggerType) {
                    playState.setPendingTriggerType('summon');
                    playState.setTriggeredEffect(pendingPlayCard);
                } else {
                    resolveEffect(pendingPlayCard, undefined, undefined, undefined, 'summon');
                }
            }

        } else if (targetSelectMode === 'place_action') {
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[pIdx];
                if (p.actionZones[slotIndex] !== null) { addLog("SLOT OCCUPIED."); return prev; }

                if (playMode === 'set') {
                    triggerVisual(`${pIdx}-hand-container`, `${pIdx}-action-${slotIndex}`, 'discard', pendingPlayCard); // Visual move
                    p.actionZones[slotIndex] = { card: { ...pendingPlayCard }, position: Position.HIDDEN, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: true };
                    p.hand = p.hand.filter((h: Card) => h.instanceId !== pendingPlayCard.instanceId);
                } else {
                    // Activate Action
                    triggerVisual(`${pIdx}-hand-container`, `${pIdx}-action-${slotIndex}`, 'discard', pendingPlayCard);
                    p.actionZones[slotIndex] = { card: { ...pendingPlayCard }, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: false }; // Place temporarily
                    p.hand = p.hand.filter((h: Card) => h.instanceId !== pendingPlayCard.instanceId);
                    // Do not add to discard here; handle post-resolution cleanup
                }
                players[pIdx] = p;
                return { ...prev, players: players as [Player, Player] };
            });

            if (playMode === 'activate') {
                resolveEffect(pendingPlayCard, undefined, undefined, undefined, 'activate');

                if (!pendingPlayCard.isLingering) {
                    setTimeout(() => {
                        triggerVisual(`${pIdx}-action-${slotIndex}`, `discard-${pIdx}`, 'discard', pendingPlayCard!);
                        setGameState(current => {
                            if (!current) return null;
                            const players = JSON.parse(JSON.stringify(current.players));
                            const ply = players[pIdx];
                            if (ply.actionZones[slotIndex] !== null) {
                                ply.discard = [...ply.discard, { ...ply.actionZones[slotIndex].card }];
                                ply.actionZones[slotIndex] = null;
                            }
                            players[pIdx] = ply;
                            return { ...current, players: players as [Player, Player] };
                        });
                    }, 1500);
                }
            }
        }

        // Reset State
        playState.setPendingPlayCard(null);
        playState.setPlayMode(null);
        setTargetSelectMode(null);

    }, [gameState, isPeekingField, setGameState, resolveEffect, addLog, triggerVisual, setTargetSelectMode, targetSelectMode]);


    /** Activates a card already on the field (flipping or triggering). */
    const activateOnField = useCallback((playerIndex: number, type: 'entity' | 'action', index: number) => {
        if (!gameState || isPeekingField) return;
        const p = gameState.players[playerIndex];
        const zone = type === 'entity' ? p.entityZones : p.actionZones;
        const placed = zone[index];
        if (!placed) return;

        const context: CardContext = { card: placed.card, playerIndex };
        const effect = cardRegistry.getEffect(placed.card.id);
        if (effect?.canActivate && !effect.canActivate(gameState, context)) {
            addLog(`RESTRICTION: Activation conditions for ${placed.card.name} not met.`);
            return;
        }
        if (placed.card.type === CardType.CONDITION && gameState.turnNumber <= placed.summonedTurn) return;

        if (placed.position === Position.HIDDEN) {
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const ply = players[playerIndex];
                const zn = type === 'entity' ? ply.entityZones : ply.actionZones;
                zn[index] = { ...zn[index]!, position: Position.ATTACK };
                players[playerIndex] = ply;
                return { ...prev, players: players as [Player, Player] };
            });
        }

        resolveEffect(placed.card, undefined, undefined, undefined, 'activate');

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const ply = players[playerIndex];
            const zn = type === 'entity' ? ply.entityZones : ply.actionZones;
            if (zn[index]) zn[index].hasActivatedEffect = true;
            players[playerIndex] = ply;
            return { ...prev, players: players as [Player, Player] };
        });

        if (type !== 'entity') {
            if (!placed.card.isLingering) {
                setTimeout(() => {
                    const currentPlaced = gameState?.players[playerIndex].actionZones[index];
                    if (currentPlaced) triggerVisual(`${playerIndex}-${type}-${index}`, `discard-${playerIndex}`, 'discard', currentPlaced.card);
                    setGameState(prev => {
                        if (!prev) return null;
                        const players = JSON.parse(JSON.stringify(prev.players));
                        const ply = players[playerIndex];
                        const zn = ply.actionZones;
                        if (zn[index]) { ply.discard = [...ply.discard, { ...zn[index]!.card }]; zn[index] = null; }
                        players[playerIndex] = ply;
                        return { ...prev, players: players as [Player, Player] };
                    });
                }, 1500);
            }
        }
        setSelectedFieldSlot(null);
    }, [gameState, isPeekingField, setGameState, resolveEffect, addLog, triggerVisual, setSelectedFieldSlot]);

    /** Combat resolution: Attack vs Attack, Attack vs Defense, Direct Attacks. */
    const handleAttack = useCallback((attackerIdx: number, targetIdx: number | 'direct') => {
        if (!gameState || gameState.turnNumber === 1 || isPeekingField) return;
        const activeIndex = gameState.activePlayerIndex;
        const oppIndex = (activeIndex + 1) % 2;
        const attacker = gameState.players[activeIndex].entityZones[attackerIdx];
        if (!attacker) return;

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const p = players[activeIndex];
            const opp = players[oppIndex];
            const atkEntity = { ...p.entityZones[attackerIdx]! };

            if (targetIdx === 'direct') {
                opp.lp -= atkEntity.card.atk;
                addLog(`DIRECT IMPACT: -${atkEntity.card.atk} LP.`);
            } else {
                let defEntity = { ...opp.entityZones[targetIdx]! };
                if (!defEntity) return prev;

                if (defEntity.position === Position.HIDDEN) {
                    defEntity.position = Position.DEFENSE;
                    opp.entityZones[targetIdx] = defEntity;
                    addLog(`${defEntity.card.name} was flipped!`);
                }

                if (defEntity.position === Position.ATTACK) {
                    const diff = atkEntity.card.atk - defEntity.card.atk;
                    if (diff > 0) {
                        triggerShatter(`${oppIndex}-entity-${targetIdx}`);
                        opp.lp -= diff;
                        triggerVisual(`${oppIndex}-entity-${targetIdx}`, `discard-${oppIndex}`, 'discard', defEntity.card);
                        opp.discard = [...opp.discard, defEntity.card];
                        opp.entityZones[targetIdx] = null;
                        addLog(`ATTACK SUCCESS: ${defEntity.card.name} destroyed. -${diff} LP.`);
                    } else if (diff < 0) {
                        triggerShatter(`${activeIndex}-entity-${attackerIdx}`);
                        p.lp += diff;
                        triggerVisual(`${activeIndex}-entity-${attackerIdx}`, `discard-${activeIndex}`, 'discard', atkEntity.card);
                        p.discard = [...p.discard, atkEntity.card];
                        p.entityZones[attackerIdx] = null;
                        addLog(`ATTACK FAILED: ${atkEntity.card.name} destroyed. Recoil ${diff}.`);
                    } else {
                        triggerShatter(`${activeIndex}-entity-${attackerIdx}`);
                        triggerShatter(`${oppIndex}-entity-${targetIdx}`);
                        triggerVisual(`${activeIndex}-entity-${attackerIdx}`, `discard-${activeIndex}`, 'discard', atkEntity.card);
                        triggerVisual(`${oppIndex}-entity-${targetIdx}`, `discard-${oppIndex}`, 'discard', defEntity.card);
                        p.discard = [...p.discard, atkEntity.card];
                        opp.discard = [...opp.discard, defEntity.card];
                        p.entityZones[attackerIdx] = null;
                        opp.entityZones[targetIdx] = null;
                        addLog("MUTUAL DESTRUCTION.");
                    }
                } else {
                    if (atkEntity.card.atk > defEntity.card.def) {
                        triggerShatter(`${oppIndex}-entity-${targetIdx}`);
                        triggerVisual(`${oppIndex}-entity-${targetIdx}`, `discard-${oppIndex}`, 'discard', defEntity.card);
                        opp.discard = [...opp.discard, defEntity.card];
                        opp.entityZones[targetIdx] = null;
                        addLog(`DEFENSE CRUSHED: ${defEntity.card.name} destroyed. 0 Damage.`);
                    } else if (atkEntity.card.atk < defEntity.card.def) {
                        const recoil = defEntity.card.def - atkEntity.card.atk;
                        p.lp -= recoil;
                        addLog(`DEFENSE HELD: Recoil -${recoil} LP.`);
                    } else {
                        addLog("STALEMATE: Defense equals Attack.");
                    }
                }
            }
            if (p.entityZones[attackerIdx]) p.entityZones[attackerIdx]!.hasAttacked = true;
            players[activeIndex] = p;
            players[oppIndex] = opp;

            let winner = null;
            if (opp.lp <= 0) winner = p.name;
            else if (p.lp <= 0) winner = opp.name;
            return { ...prev, players: players as [Player, Player], winner };
        });
        setTargetSelectMode(null);
        setSelectedFieldSlot(null);
    }, [gameState, isPeekingField, setGameState, addLog, triggerVisual, triggerShatter, setTargetSelectMode, setSelectedFieldSlot]);

    return {
        handleSummon,
        handleTributeSummon,
        handleActionFromHand,
        handlePlacement,
        activateOnField,
        handleAttack,
    };
};
