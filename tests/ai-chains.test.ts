import './fixtures/attachedCondition';
import { describe, expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, CardType, GameState, Phase, Player, Position, ResponseTiming } from '../src/types';
import { addChainLink, effectChoices, openResponse, passPriority, resolveChain, resolveChainStep, startPendingResponse } from '../src/game/chains';
import { applyCommand, applySystemCommand } from '../src/game/engine';
import { shouldPromptResponse } from '../src/game/responseTiming';
import { chooseAIAction, observeGame, updateKnownCards } from '../src/game/opponentAI';
import { buildEffect } from '../src/cards/engine/Builder';
import { Effect } from '../src/cards/engine/Effects';
import { Require } from '../src/cards/engine/Requirements';

let serial = 0;
const card = (id: string, pi = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `card-${serial++}`, ownerId: `player${pi + 1}` });
const zone = (card: Card, position = Position.ATTACK, turn = 1) => ({ card, position, hasAttacked: false, hasChangedPosition: false, summonedTurn: turn, isSetTurn: position === Position.HIDDEN });
function game(): GameState {
    const player = (i: number): Player => ({ id: `player${i + 1}`, name: `Player ${i + 1}`, lp: 800, hand: [], deck: [], reserve: [], initialDeck: [], discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null), normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [] });
    return { players: [player(0), player(1)], activePlayerIndex: 0, currentPhase: Phase.MAIN1, turnNumber: 3, log: [], winner: null, pendingEffects: [] };
}
function passAll(state: GameState) {
    for (let i = 0; i < 20 && state.response && !state.response.ready && !state.winner; i++)
        state = state.resolvingChain ? resolveChainStep(state) : passPriority(state);
    return state;
}

describe('response windows and chains', () => {
    it('opens legal timing windows and distinguishes Off, Auto, and On', () => {
        for (const timing of ['summon', 'attack', 'activation', 'turn_end', 'phase_exit', 'phase_entry', 'battle_step', 'chain_resolved', 'minor_action', 'draw'] as ResponseTiming[]) {
            for (const priority of [0, 1]) {
                const window = { ...game(), response: { priority, passes: 0, reason: timing, timing } };
                expect(shouldPromptResponse('off', window)).toBe(false);
                expect(shouldPromptResponse('on', window)).toBe(true);
                expect(shouldPromptResponse('auto', window)).toBe(['summon', 'attack', 'activation', 'phase_exit'].includes(timing) || timing === 'turn_end' && priority === 1);
                expect(shouldPromptResponse('on', { ...window, response: { ...window.response, ready: true } })).toBe(false);
                if (timing === 'phase_exit') for (const currentPhase of Object.values(Phase)) {
                    expect(shouldPromptResponse('auto', { ...window, currentPhase })).toBe([Phase.MAIN1, Phase.BATTLE, Phase.MAIN2].includes(currentPhase));
                }
            }
        }
        // Human and AI End requests visit only the origin and End, even in On mode.
        for (const actor of [0, 1]) for (const currentPhase of [Phase.MAIN1, Phase.BATTLE, Phase.MAIN2]) {
            const skipping = game();
            skipping.activePlayerIndex = actor;
            skipping.currentPhase = currentPhase;
            const responder = 1 - actor;
            const pawn = zone(card('P_Void_Caster', responder));
            skipping.players[responder].pawnZones[0] = { ...pawn, attacksRemaining: 0, nextBattleAttacks: 2 };
            skipping.players[responder].actionZones[0] = zone(card('C_Dark_Draw', responder), Position.HIDDEN);
            skipping.players[responder].deck = [card('P_Solstice_Sentinel', responder)];
            const requested = applyCommand(skipping, actor, { type: 'end' }).state;
            expect(requested.currentPhase).toBe(currentPhase);
            expect(requested.response).toMatchObject({ timing: 'phase_exit', priority: responder });
            expect(shouldPromptResponse('auto', requested)).toBe(true);
            const ended = applySystemCommand(passAll(requested), { type: 'completeDeferred' }).state;
            expect(ended.currentPhase).toBe(Phase.END);
            expect(ended.activePlayerIndex).toBe(actor);
            expect(ended.turnNumber).toBe(skipping.turnNumber);
            expect(ended.players[responder].pawnZones[0]).toMatchObject({ attacksRemaining: 0, nextBattleAttacks: 2 });
            expect(ended.deferredAction).toBeUndefined();
            const entry = startPendingResponse(ended);
            expect(entry.response?.timing).toBe('phase_entry');
            expect(shouldPromptResponse('auto', entry)).toBe(false);
            expect(shouldPromptResponse('on', entry)).toBe(true);

            // Either player's accepted activation cancels the request, not the effect.
            for (const playerIndex of [actor, responder]) {
                const interrupted = game();
                interrupted.activePlayerIndex = actor;
                interrupted.currentPhase = currentPhase;
                interrupted.players[playerIndex].pawnZones[0] = zone(card('P_Void_Caster', playerIndex));
                interrupted.players[playerIndex].actionZones[0] = zone(card('C_Dark_Draw', playerIndex), Position.HIDDEN);
                interrupted.players[playerIndex].deck = [card('P_Solstice_Sentinel', playerIndex)];
                const exit = applyCommand(interrupted, actor, { type: 'end' }).state;
                const context = effectChoices(exit, exit.players[playerIndex].actionZones[0]!.card, 'activate')[0];
                const activated = applyCommand(exit, playerIndex, { type: 'activate', context, trigger: 'activate' }).state;
                expect(activated.deferredAction).toBeUndefined();
                const resolved = passAll(activated);
                expect(resolved.currentPhase).toBe(currentPhase);
                expect(resolved.players[playerIndex].hand).toHaveLength(1);
                expect(resolved.players[playerIndex].lp).toBe(600);
                const resumed = startPendingResponse(resolved);
                expect(resumed.response).toBeUndefined();
                expect(applySystemCommand(resumed, { type: 'completeDeferred' }).state).toBe(resumed);
                // A fresh request still works after the player has reconsidered.
                const retry = passAll(applyCommand(resumed, actor, { type: 'end' }).state);
                expect(applySystemCommand(retry, { type: 'completeDeferred' }).state.currentPhase).toBe(Phase.END);
            }
        }
    });

    it('responds during the other turn, resolves LIFO, and rechecks revealed targets', () => {
        const s = game(), blast = card('A_Void_Blast'), draw = card('C_Dark_Draw', 1), reinforcement = card('test_attached_condition');
        s.players[0].actionZones[0] = zone(blast);
        s.players[0].actionZones[1] = zone(reinforcement, Position.HIDDEN);
        s.players[1].actionZones[0] = zone(draw, Position.HIDDEN);
        s.players[1].pawnZones[0] = zone(card('P_Void_Caster', 1));
        s.players[1].deck = [card('P_Solstice_Sentinel', 1)];
        let next = addChainLink(s, { card: blast, playerIndex: 0 }, 'activate');
        expect(next.players[1].lp).toBe(800);
        expect(next.response?.priority).toBe(1);
        next = addChainLink(next, { card: draw, playerIndex: 1 }, 'activate');
        expect(next.players[1].lp).toBe(800); // cost waits for this chain link
        expect(next.players[1].actionZones[0]?.position).toBe(Position.FACE_UP);
        expect(next.log).toEqual(s.log);
        expect(next.players[1].hand).toHaveLength(0);
        next = addChainLink(next, { card: reinforcement, playerIndex: 0, target: { playerIndex: 1, type: 'pawn', index: 0 } }, 'activate');
        next = resolveChainStep(next);
        expect(next.players[1].lp).toBe(800);
        next = resolveChainStep(next);
        expect(next.players[1].lp).toBe(600);
        expect(next.players[1].hand).toHaveLength(1);
        next = passAll(next);
        expect(next.players[1].lp).toBe(550);
        expect(next.players[0].lp).toBe(800);
        expect(next.players[1].hand).toHaveLength(1);
        expect(next.players[1].pawnZones[0]!.card.atk).toBe(120);
        const resolutionLogs = next.log.slice(0, 3);
        expect(resolutionLogs[0]).toContain('Void Blast');
        expect(resolutionLogs[1]).toContain('Dark Draw');
        expect(resolutionLogs[1]).toContain('draws 1 card');
        expect(next.log.join(' ')).not.toContain('to ATTACK');
        expect(resolutionLogs[2]).toContain('Reinforcement');
        expect(next.chain).toHaveLength(0);

        // A later protection link takes effect before an earlier targeted removal.
        for (const protect of [false, true]) {
            const duel = game(), outlander = card('P_Future_Outlander'), dragon = card('P_Everlasting_Dragonlord', 1);
            duel.players[0].pawnZones[0] = zone(outlander);
            duel.players[1].pawnZones[0] = zone(dragon);
            const alternative = card('P_Quickstrike_Serpent', 1);
            duel.players[1].pawnZones[1] = zone(alternative);
            let removal = applyCommand(duel, 0, {
                type: 'activate', trigger: 'activate', context: {
                    card: outlander, playerIndex: 0, target: { playerIndex: 1, type: 'pawn', index: 0 }
                }
            }).state;
            expect(removal.players[1].pawnZones[0]?.card.instanceId).toBe(dragon.instanceId);
            expect(removal.players[1].void).toEqual([]);
            expect(removal.temporaryVoidReturns ?? []).toEqual([]);
            expect(removal.chain?.[0].context.target).toBeUndefined();
            expect(removal.chain?.[0].targetIds).toEqual([]);
            if (protect) {
                removal = applyCommand(removal, 1, { type: 'activate', trigger: 'activate', context: { card: dragon, playerIndex: 1 } }).state;
                removal = resolveChainStep(removal);
                expect(removal.players[1].pawnZones[0]?.card.effectTargetBlockedThisTurn).toBe(true);
                expect(removal.chain).toHaveLength(1);
            }
            removal = passAll(removal);
            expect(removal.pendingChainTarget).toBe(true);
            expect(resolveChain(removal)).toBe(removal);
            expect(applyCommand(removal, 1, { type: 'chainTargets', targets: [{ playerIndex: 1, type: 'pawn', index: 1 }] }).state).toBe(removal);
            const target = { playerIndex: 1, type: 'pawn' as const, index: 0 };
            if (protect) {
                expect(applyCommand(removal, 0, { type: 'chainTargets', targets: [target] }).state).toBe(removal);
                target.index = 1;
            }
            removal = applyCommand(removal, 0, { type: 'chainTargets', targets: [target] }).state;
            expect(removal.pendingChainTarget).toBeUndefined();
            expect(removal.chain).toEqual([]);
            expect(removal.players[1].pawnZones[0]?.card.instanceId).toBe(protect ? dragon.instanceId : undefined);
            expect(removal.players[1].void.map(card => card.instanceId)).toEqual([protect ? alternative.instanceId : dragon.instanceId]);
            expect(removal.temporaryVoidReturns ?? []).toHaveLength(1);
            expect(effectChoices(removal, outlander, 'activate')).toEqual([]);
        }
    });
});

describe('fair general AI', () => {
    it('uses only observed identities and avoids harmful attacks or buffs', () => {
        const s = game(); s.activePlayerIndex = 1; s.currentPhase = Phase.BATTLE;
        s.players[1].pawnZones[0] = zone(card('P_Quickstrike_Serpent', 1));
        s.players[0].hand = [card('A_Void_Blast')];
        s.players[0].pawnZones[0] = zone(card('P_Solstice_Sentinel'), Position.HIDDEN);
        s.log = ['Private match history'];
        s.players[1].initialDeck = [card('P_Quickstrike_Serpent', 1)];
        const snapshot = structuredClone(s);
        const first = observeGame(s, 1), decision = chooseAIAction(first, 1);
        expect(s).toEqual(snapshot);
        expect(first.log).toEqual([]);
        expect(first.players.map(player => player.initialDeck)).toEqual([[], []]);
        s.players[0].hand[0] = { ...card('P_High_Voltage_Charged_Dragon'), instanceId: s.players[0].hand[0].instanceId };
        s.players[0].pawnZones[0]!.card = { ...card('P_High_Voltage_Charged_Dragon'), instanceId: s.players[0].pawnZones[0]!.card.instanceId };
        expect(observeGame(s, 1)).toEqual(first);
        expect(chooseAIAction(observeGame(s, 1), 1)).toEqual(decision);
        expect(first.players[0].pawnZones[0]!.card.atk).toBe(0);
        const remembered = new Map<string, Card>();
        s.players[0].pawnZones[0]!.position = Position.DEFENSE;
        updateKnownCards(s, 1, remembered);
        s.players[0].pawnZones[0]!.position = Position.HIDDEN;
        expect(observeGame(s, 1, remembered).players[0].pawnZones[0]!.card.id).toBe('P_High_Voltage_Charged_Dragon');
        s.players[0].pawnZones[0] = null;
        updateKnownCards(s, 1, remembered);
        expect(remembered.size).toBe(0);

        const battle = game(); battle.activePlayerIndex = 1; battle.currentPhase = Phase.BATTLE;
        const defender = card('P_High_Voltage_Charged_Dragon'); defender.def = 200;
        battle.players[0].pawnZones[0] = zone(defender, Position.DEFENSE);
        battle.players[1].pawnZones[0] = zone(card('P_Solstice_Sentinel', 1));
        const battleKnown = new Map<string, Card>();
        updateKnownCards(battle, 1, battleKnown);
        battle.players[0].pawnZones[0]!.position = Position.HIDDEN;
        expect(chooseAIAction(observeGame(battle, 1, battleKnown), 1)).toEqual({ kind: 'pass' });

        battle.currentPhase = Phase.MAIN1;
        battle.players[0].pawnZones[0]!.position = Position.ATTACK;
        battle.players[1].hand = [card('C_Reinforcement', 1)];
        const choice = chooseAIAction(observeGame(battle, 1), 1);
        expect(choice.kind === 'effect' && choice.context.target?.playerIndex === 0).toBe(false);
    });

    it('chooses a quick defensive response that stops lethal damage', () => {
        cardRegistry.register({ id: 'test-quick-defense', name: 'Quick defense', type: CardType.PAWN, rarity: 'Common', level: 1, atk: 10, def: 20, effectText: 'Quick: switch an attacker to Defense.' }, {
            timing: 'quick', onActivate: buildEffect([Require.Target('pawn'), Require.TargetMatchesPosition(Position.ATTACK), Effect.ChangeTargetPosition(Position.DEFENSE)])
        });
        const s = game(), defender = card('test-quick-defense', 1), attacker = card('P_High_Voltage_Charged_Dragon');
        s.players[1].lp = 100;
        s.players[1].pawnZones[0] = zone(defender);
        s.players[0].pawnZones[0] = zone(attacker);
        const next = openResponse(s, { kind: 'attack', attackerId: attacker.instanceId, targetId: defender.instanceId }, 'Attack');
        expect(chooseAIAction(observeGame(next, 1), 1)).toMatchObject({ kind: 'effect', context: { target: { playerIndex: 0, index: 0 } } });
    });
});
