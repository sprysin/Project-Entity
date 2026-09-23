import { GameState, Phase, Player, Position } from '../types';
import { clonePlayers } from './cloneState';
import { checkVictory } from './finishEffect';
import { cardRegistry } from '../cards/CardRegistry';
import { sendToOwnerPile } from './cardOwnership';

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
    if (targetIndex === 'direct' && gameState.players[opponentIndex].pawnZones.some(Boolean)) return gameState;

    const logs: string[] = [];
    let damageSource = attacker.card;
    let damagePlayerIndex = activeIndex;
    const players = clonePlayers(gameState.players);
    const activePlayer = players[activeIndex];
    const opponent = players[opponentIndex];
    const attackingPawn = { ...activePlayer.pawnZones[attackerIndex]! };
    let destroyedByAttacker: typeof attackingPawn.card | undefined;
    let revealedSwitch: typeof attackingPawn.card | undefined;

    if (targetIndex === 'direct') {
        opponent.lp -= attackingPawn.card.atk;
        logs.push(`${quote(attackingPawn.card.name)} attacked directly. ${lpLoss(opponent, attackingPawn.card.atk)}`);
    } else {
        const defending = opponent.pawnZones[targetIndex];
        if (!defending) return gameState;
        const defendingPawn = { ...defending, position: defending.position === Position.HIDDEN ? Position.DEFENSE : defending.position };
        const reveal = defending.position === Position.HIDDEN
            ? `${quote(defendingPawn.card.name)} flipped face up. `
            : '';
        if (defending.position === Position.HIDDEN) {
            opponent.pawnZones[targetIndex] = defendingPawn;
            if (cardRegistry.getEffect(defendingPawn.card.id)?.onSwitch) revealedSwitch = defendingPawn.card;
        }

        if (defendingPawn.position === Position.ATTACK) {
            const difference = attackingPawn.card.atk - defendingPawn.card.atk;
            if (difference > 0) {
                opponent.lp -= difference;
                sendToOwnerPile({ ...gameState, players }, defendingPawn.card, 'discard');
                destroyedByAttacker = defendingPawn.card;
                opponent.pawnZones[targetIndex] = null;
                logs.push(`${reveal}${quote(attackingPawn.card.name)} destroyed ${quote(defendingPawn.card.name)} by battle. ${lpLoss(opponent, difference)}`);
            } else if (difference < 0) {
                damageSource = defendingPawn.card;
                damagePlayerIndex = opponentIndex;
                activePlayer.lp += difference;
                sendToOwnerPile({ ...gameState, players }, attackingPawn.card, 'discard');
                activePlayer.pawnZones[attackerIndex] = null;
                logs.push(`${reveal}${quote(defendingPawn.card.name)} destroyed ${quote(attackingPawn.card.name)} by battle. ${lpLoss(activePlayer, -difference)}`);
            } else {
                sendToOwnerPile({ ...gameState, players }, attackingPawn.card, 'discard');
                sendToOwnerPile({ ...gameState, players }, defendingPawn.card, 'discard');
                activePlayer.pawnZones[attackerIndex] = null;
                opponent.pawnZones[targetIndex] = null;
                logs.push(`${reveal}${quote(attackingPawn.card.name)} and ${quote(defendingPawn.card.name)} destroyed each other by battle.`);
            }
        } else if (attackingPawn.card.atk > defendingPawn.card.def) {
            sendToOwnerPile({ ...gameState, players }, defendingPawn.card, 'discard');
            destroyedByAttacker = defendingPawn.card;
            opponent.pawnZones[targetIndex] = null;
            logs.push(`${reveal}${quote(attackingPawn.card.name)} destroyed ${quote(defendingPawn.card.name)} by battle.`);
        } else if (attackingPawn.card.atk < defendingPawn.card.def) {
            const recoil = defendingPawn.card.def - attackingPawn.card.atk;
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
    let next: GameState = { ...gameState, damageEvents, players: players as [Player, Player], log: [...logs, ...gameState.log].slice(0, 50) };
    if (destroyedByAttacker) {
        const handler = cardRegistry.getEffect(attackingPawn.card.id)?.onBattleDestroy;
        if (handler && activePlayer.pawnZones.some(z => z?.card.instanceId === attackingPawn.card.instanceId)) {
            const result = handler(next, { card: attackingPawn.card, playerIndex: activeIndex, destroyedCard: destroyedByAttacker });
            if (!result.halted) next = result.newState;
        }
    }
    if (revealedSwitch) next.pendingSwitches = [...(next.pendingSwitches ?? []), { card: revealedSwitch, playerIndex: opponentIndex }];
    return checkVictory(next);

}
