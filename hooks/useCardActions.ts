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
    setTargetSelectMode: (mode: 'attack' | 'tribute' | 'effect' | null) => void,
    isPeekingField: boolean,
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
        }
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

        const emptySlot = p.entityZones.findIndex(z => z === null);
        if (emptySlot === -1) { addLog("SECTOR FULL: No field space available."); return; }

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const ply = players[pIdx];
            ply.entityZones[emptySlot] = {
                card: { ...card }, position: mode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: mode === 'hidden'
            };
            ply.hand = ply.hand.filter((h: Card) => h.instanceId !== card.instanceId);
            if (card.level <= 4) {
                if (mode === 'normal') ply.normalSummonUsed = true;
                if (mode === 'hidden') ply.hiddenSummonUsed = true;
            }
            players[pIdx] = ply;
            return { ...prev, players: players as [Player, Player] };
        });

        if (mode !== 'hidden') resolveEffect(card, undefined, undefined, undefined, 'summon');
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
        }
    ) => {
        if (!gameState || !pendingTributeCard || isPeekingField) return;
        const activeIndex = gameState.activePlayerIndex;
        const required = pendingTributeCard.level <= 7 ? 1 : 2;
        if (tributeSelection.length !== required) return;

        tributeSelection.forEach(idx => {
            const sacrifice = gameState.players[activeIndex].entityZones[idx];
            if (sacrifice) triggerVisual(`${activeIndex}-entity-${idx}`, `discard-${activeIndex}`, 'discard', sacrifice.card);
        });

        setGameState(prev => {
            if (!prev) return null;
            const players = JSON.parse(JSON.stringify(prev.players));
            const p = players[activeIndex];
            tributeSelection.forEach(idx => {
                const tribute = p.entityZones[idx];
                if (tribute) { p.discard = [...p.discard, tribute.card]; p.entityZones[idx] = null; }
            });
            const emptySlot = p.entityZones.findIndex((z: any) => z === null);
            if (emptySlot !== -1) {
                p.entityZones[emptySlot] = {
                    card: { ...pendingTributeCard }, position: tributeSummonMode === 'hidden' ? Position.HIDDEN : Position.ATTACK,
                    hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: tributeSummonMode === 'hidden'
                };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== pendingTributeCard.instanceId);
            }
            players[activeIndex] = p;
            return { ...prev, players: players as [Player, Player] };
        });

        tributeState.setPendingTributeCard(null);
        tributeState.setTributeSelection([]);
        setTargetSelectMode(null);
        setSelectedHandIndex(null);

        if (tributeSummonMode !== 'hidden') resolveEffect(pendingTributeCard, undefined, undefined, undefined, 'summon');
    }, [gameState, isPeekingField, setGameState, resolveEffect, triggerVisual, setSelectedHandIndex, setTargetSelectMode]);

    /** Handles playing Action or Condition cards from hand. */
    const handleActionFromHand = useCallback((card: Card, mode: 'activate' | 'set') => {
        if (!gameState || isPeekingField) return;
        if (gameState.currentPhase !== Phase.MAIN1 && gameState.currentPhase !== Phase.MAIN2) return;
        const activeIndex = gameState.activePlayerIndex;

        if (mode === 'set') {
            triggerVisual(`${activeIndex}-hand-${selectedHandIndex}`, `${activeIndex}-action-0`, 'discard', card);
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[prev.activePlayerIndex];
                const slot = p.actionZones.findIndex((z: any) => z === null);
                if (slot === -1) return prev;
                p.actionZones[slot] = { card: { ...card }, position: Position.HIDDEN, hasAttacked: false, hasChangedPosition: false, summonedTurn: prev.turnNumber, isSetTurn: true };
                p.hand = p.hand.filter((h: Card) => h.instanceId !== card.instanceId);
                players[prev.activePlayerIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });
        } else {
            if (card.type === CardType.CONDITION) return;
            const context: CardContext = { card, playerIndex: activeIndex };
            const effect = cardRegistry.getEffect(card.id);
            if (effect?.canActivate && !effect.canActivate(gameState, context)) {
                addLog(`RESTRICTION: Activation conditions for ${card.name} not met.`);
                return;
            }
            if (selectedHandIndex !== null) triggerVisual(`${gameState.activePlayerIndex}-hand-${selectedHandIndex}`, `discard-${gameState.activePlayerIndex}`, 'discard', card);
            setGameState(prev => {
                if (!prev) return null;
                const players = JSON.parse(JSON.stringify(prev.players));
                const p = players[prev.activePlayerIndex];
                p.hand = p.hand.filter((h: Card) => h.instanceId !== card.instanceId);
                p.discard = [...p.discard, { ...card }];
                players[prev.activePlayerIndex] = p;
                return { ...prev, players: players as [Player, Player] };
            });
            resolveEffect(card, undefined, undefined, undefined, 'activate');
        }
        setSelectedHandIndex(null);
    }, [gameState, isPeekingField, selectedHandIndex, setGameState, resolveEffect, addLog, triggerVisual, setSelectedHandIndex]);

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

        if (type !== 'entity') {
            setTimeout(() => {
                if (placed) triggerVisual(`${playerIndex}-${type}-${index}`, `discard-${playerIndex}`, 'discard', placed.card);
                setGameState(prev => {
                    if (!prev) return null;
                    const players = JSON.parse(JSON.stringify(prev.players));
                    const ply = players[playerIndex];
                    const zn = ply.actionZones;
                    if (zn[index]) { ply.discard = [...ply.discard, { ...zn[index]!.card }]; zn[index] = null; }
                    players[playerIndex] = ply;
                    return { ...prev, players: players as [Player, Player] };
                });
            }, 3000);
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
        activateOnField,
        handleAttack,
    };
};
