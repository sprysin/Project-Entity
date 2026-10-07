import { GameState, Phase, Player, Position } from '../types';
import { clonePlayers } from './cloneState';
import { checkVictory } from './finishEffect';
import { cardRegistry } from '../cards/CardRegistry';
import { destroyFieldCard } from './attachments';
import { fieldStats, canPawnAttack, canAttackDirectly } from './cardHelpers';

const quote = (value: string) => `"${value}"`;
const lpLoss = (player: Player, amount: number) => `${quote(player.name)} -${amount} LP.`;

/** Resolve already-authorized combat. No timers, DOM access, or animation callbacks. */
export function resolveCombat(gameState: GameState, attackerIndex: number, targetIndex: number | 'direct'): GameState {
    if (!gameState || gameState.winner || gameState.currentPhase !== Phase.BATTLE || gameState.turnNumber === 1) return gameState;
    const activeIndex = gameState.activePlayerIndex;
    const opponentIndex = (activeIndex + 1) % 2;
    const attacker = gameState.players[activeIndex].pawnZones[attackerIndex];
    if (!attacker || attacker.position !== Position.ATTACK) return gameState;
    if (attacker.attacksRemaining !== undefined ? attacker.attacksRemaining <= 0 : attacker.hasAttacked) return gameState;
    if (!canPawnAttack(gameState, activeIndex, attacker)) return gameState;
    if (targetIndex === 'direct' && !canAttackDirectly(gameState, activeIndex, attacker.card)) return gameState;

    const logs: string[] = [];
    let damageSource = attacker.card;
    let damagePlayerIndex = activeIndex;
    const players = clonePlayers(gameState.players);
    const activePlayer = players[activeIndex];
    const opponent = players[opponentIndex];
    const attackingPawn = { ...activePlayer.pawnZones[attackerIndex]! };
    const attackingAtk = fieldStats(gameState, attackingPawn).atk;
    let destroyedByAttacker: typeof attackingPawn.card | undefined;
    const battleDestroyed: typeof attackingPawn.card[] = [];
    const destructionState = { ...gameState, players };
    const battleOpponent = targetIndex === 'direct' ? undefined : players[opponentIndex].pawnZones[targetIndex]?.card;
    const destroyByBattle = (card: typeof attackingPawn.card) => {
        const other = card.instanceId === attackingPawn.card.instanceId ? battleOpponent : attackingPawn.card;
        if (other && cardRegistry.getEffect(other.id)?.preventsBattleDestructionOfOpponent) return false;
        if (!players.some(player => player.pawnZones.some(zone => zone?.card.instanceId === card.instanceId))) return false;
        destroyFieldCard(destructionState, card.instanceId);
        if (players.some(player => player.discard.some(value => value.instanceId === card.instanceId))) battleDestroyed.push(card);
        return true;
    };
    let revealedSwitch: typeof attackingPawn.card | undefined;

    if (targetIndex === 'direct') {
        opponent.lp -= attackingAtk;
        logs.push(`${quote(attackingPawn.card.name)} attacked directly. ${lpLoss(opponent, attackingAtk)}`);
    } else {
        const defending = opponent.pawnZones[targetIndex];
        if (!defending) return gameState;
        const defendingPawn = { ...defending, position: defending.position === Position.HIDDEN ? Position.DEFENSE : defending.position };
        const defendingStats = fieldStats(gameState, defendingPawn);
        const reveal = defending.position === Position.HIDDEN
            ? `${quote(defendingPawn.card.name)} flipped face up. `
            : '';
        if (defending.position === Position.HIDDEN) {
            opponent.pawnZones[targetIndex] = defendingPawn;
            if (cardRegistry.getEffect(defendingPawn.card.id)?.onSwitch) revealedSwitch = defendingPawn.card;
        }

        if (defendingPawn.position === Position.ATTACK) {
            const difference = attackingAtk - defendingStats.atk;
            if (difference > 0) {
                opponent.lp -= difference;
                const destroyed = destroyByBattle(defendingPawn.card);
                if (destroyed) destroyedByAttacker = defendingPawn.card;
                logs.push(`${reveal}${quote(attackingPawn.card.name)} ${destroyed ? 'destroyed' : 'battled'} ${quote(defendingPawn.card.name)} by battle. ${lpLoss(opponent, difference)}`);
            } else if (difference < 0) {
                damageSource = defendingPawn.card;
                damagePlayerIndex = opponentIndex;
                activePlayer.lp += difference;
                const destroyed = destroyByBattle(attackingPawn.card);
                logs.push(`${reveal}${quote(defendingPawn.card.name)} ${destroyed ? 'destroyed' : 'battled'} ${quote(attackingPawn.card.name)} by battle. ${lpLoss(activePlayer, -difference)}`);
            } else {
                destroyByBattle(attackingPawn.card);
                destroyByBattle(defendingPawn.card);
                logs.push(`${reveal}${quote(attackingPawn.card.name)} and ${quote(defendingPawn.card.name)} battled with equal ATK.`);
            }
        } else if (attackingAtk > defendingStats.def) {
            const destroyed = destroyByBattle(defendingPawn.card);
            if (destroyed) destroyedByAttacker = defendingPawn.card;
            logs.push(`${reveal}${quote(attackingPawn.card.name)} ${destroyed ? 'destroyed' : 'battled'} ${quote(defendingPawn.card.name)} by battle.`);
        } else if (attackingAtk < defendingStats.def) {
            const recoil = defendingStats.def - attackingAtk;
            damageSource = defendingPawn.card;
            damagePlayerIndex = opponentIndex;
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
    const damagedIndex = 1 - damagePlayerIndex;
    const amount = gameState.players[damagedIndex].lp - players[damagedIndex].lp;
    const damageEvents = amount > 0 ? [...(gameState.damageEvents ?? []), {
        card: { ...damageSource }, playerIndex: damagePlayerIndex, amount, kind: 'battle' as const
    }] : gameState.damageEvents;
    let next: GameState = { ...gameState, pendingEffects: destructionState.pendingEffects, pendingReactions: destructionState.pendingReactions, attacksThisTurn: [...(gameState.attacksThisTurn ?? []).filter(event => event.turn === gameState.turnNumber), { turn: gameState.turnNumber, card: { ...attackingPawn.card }, playerIndex: activeIndex }], damageEvents, players: players as [Player, Player], log: [...logs, ...gameState.log].slice(0, 50) };
    for (const card of battleDestroyed) {
        const playerIndex = next.players.findIndex(player => player.discard.some(value => value.instanceId === card.instanceId));
        if (playerIndex >= 0 && cardRegistry.getEffect(card.id)?.onBattleDestroyed) {
            next.pendingReactions = [...(next.pendingReactions ?? []), { card, playerIndex, trigger: 'battle_destroyed', battleAttacker: attackingPawn.card }];
        }
    }
    if (destroyedByAttacker) {
        const handler = cardRegistry.getEffect(attackingPawn.card.id)?.onBattleDestroy;
        if (handler && activePlayer.pawnZones.some(z => z?.card.instanceId === attackingPawn.card.instanceId)) {
            next.pendingTriggers = [...(next.pendingTriggers ?? []), {
                context: { card: attackingPawn.card, playerIndex: activeIndex, destroyedCard: destroyedByAttacker },
                trigger: 'battle_destroy'
            }];
        }
    }
    if (cardRegistry.getEffect(attackingPawn.card.id)?.onAttackCompleted) {
        next.pendingReactions = [...(next.pendingReactions ?? []), { card: attackingPawn.card, playerIndex: activeIndex, trigger: 'attack_completed' }];
    }
    if (revealedSwitch) next.pendingReactions = [...(next.pendingReactions ?? []), { card: revealedSwitch, playerIndex: opponentIndex, trigger: 'switch' }];
    return checkVictory(next);

}
