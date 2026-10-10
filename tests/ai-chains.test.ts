import './fixtures/attachedCondition';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { useOpponentAI } from '../src/hooks/useOpponentAI';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Attribute, Card, CardType, GameState, Phase, Player, Position, ResponseTiming } from '../src/types';
import { addChainLink, effectChoices, fieldActivations, openResponse, passPriority, resolveChain, resolveChainStep, startPendingResponse } from '../src/game/chains';
import { applyCommand, applySystemCommand } from '../src/game/engine';
import { shouldPromptResponse } from '../src/game/responseTiming';
import { chooseAIAction, chooseAIHandSummon, hasWorthwhileAttack, observeGame, updateKnownCards } from '../src/game/opponentAI';
import { buildEffect } from '../src/cards/engine/Builder';
import { Effect } from '../src/cards/engine/Effects';
import { Require } from '../src/cards/engine/Requirements';
import { Cost } from '../src/cards/engine/Costs';

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
        const s = game();
        const played = card('A_Void_Blast');
        s.players[0].hand = [played];
        expect(applyCommand(s, 0, { type: 'play', cardId: played.instanceId, set: false, slot: 0 }).state.players[0].actionZones[0]?.position).toBe(Position.FACE_UP);
        s.players[1].pawnZones[0] = zone(card('P_High_Voltage_Charged_Dragon', 1));
        s.players[1].hand = [card('A_Void_Blast', 1)];
        s.players[1].actionZones[0] = zone(card('test_attached_condition', 1), Position.HIDDEN, s.turnNumber);
        expect(fieldActivations(s, 1, true)).toHaveLength(0);
        expect(openResponse(s, { kind: 'phase' }, 'Leave Main').response?.ready).toBe(true);
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
        const events = game();
        events.players[0].pawnZones[1] = zone(card('P_Void_Caster'));
        events.players[1].actionZones[0] = zone(card('C_Dark_Draw', 1), Position.HIDDEN);
        events.players[1].actionZones[1] = zone(card('test_attached_condition', 1), Position.HIDDEN);
        events.players[1].deck = [card('P_Solstice_Sentinel', 1)];
        const pawn = { ...card('P_High_Voltage_Charged_Dragon'), level: 4 as const };
        events.players[0].hand = [pawn];
        let summoned = applyCommand(events, 0, { type: 'summon', cardId: pawn.instanceId, hidden: false, slot: 0 }).state;
        expect(startPendingResponse(summoned).response).toMatchObject({ timing: 'summon', priority: 1 });
        const hidden = applyCommand(events, 0, { type: 'summon', cardId: pawn.instanceId, hidden: true, slot: 0 }).state;
        expect(startPendingResponse(hidden).response?.timing).toBe('minor_action');
        const triggerPawn = card('P_Solstice_Sentinel');
        events.players[0].hand = [triggerPawn];
        const triggered = applyCommand(events, 0, { type: 'summon', cardId: triggerPawn.instanceId, hidden: false, slot: 0 }).state;
        expect(triggered.pendingReactions?.[0].trigger).toBe('summon');
        expect(startPendingResponse(triggered)).toBe(triggered);
        expect(startPendingResponse(applyCommand(triggered, 0, { type: 'cancelEffect', cardId: triggerPawn.instanceId }).state).response?.timing).toBe('summon');

        const setCard = card('A_Void_Blast');
        events.players[0].hand = [setCard];
        const set = applyCommand(events, 0, { type: 'play', cardId: setCard.instanceId, set: true, slot: 0 }).state;
        expect(startPendingResponse(set).response?.timing).toBe('minor_action');
        const phase = passAll(applyCommand(events, 0, { type: 'phase' }).state);
        expect(startPendingResponse(applySystemCommand(phase, { type: 'completeDeferred' }).state).response?.timing).toBe('phase_entry');
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
        const end = { ...events, currentPhase: Phase.END };
        expect(applyCommand(end, 0, { type: 'phase' }).state.response?.timing).toBe('turn_end');
        let draw = { ...structuredClone(events), currentPhase: Phase.DRAW };
        draw.players[0].hand = [];
        draw.players[0].deck = Array.from({ length: 5 }, () => card('P_Solstice_Sentinel'));
        expect(fieldActivations(draw, 1, true)).toEqual([]);
        expect(openResponse(draw, { kind: 'phase' }, 'Before draw')).toBe(draw);
        for (let i = 1; i <= 5; i++) {
            draw = applySystemCommand(draw, { type: 'draw' }).state;
            expect(draw.players[0].hand).toHaveLength(i);
            if (i < 5) {
                expect(draw.pendingResponse).toBeUndefined();
                expect(fieldActivations(draw, 1, true)).toEqual([]);
                expect(startPendingResponse(draw)).toBe(draw);
            }
        }
        expect(startPendingResponse(draw).response?.timing).toBe('draw');

        summoned = { ...summoned, pendingResponse: undefined, currentPhase: Phase.BATTLE };
        const attack = passAll(applyCommand(summoned, 0, { type: 'attack', attackerIndex: 0, targetIndex: 'direct' }).state);
        let battle = applySystemCommand(attack, { type: 'completeDeferred' }).state;
        expect(battle.response?.timing).toBe('battle_step');
        expect(battle.players[1].lp).toBe(800);
        battle = applySystemCommand(passAll(battle), { type: 'completeDeferred' }).state;
        expect(battle.players[1].lp).toBeLessThan(800);
        expect(startPendingResponse(battle).response?.timing).toBe('battle_step');
        const activation = effectChoices(events, events.players[1].actionZones[0]!.card, 'activate')[0];
        const chained = addChainLink(events, activation, 'activate');
        expect(chained.response?.timing).toBe('activation');
        expect(startPendingResponse(chained)).toBe(chained);
        expect(startPendingResponse(resolveChain(chained)).response?.timing).toBe('chain_resolved');

        const legal = game();
        legal.players[1].actionZones[0] = zone(card('C_Void_Call', 1), Position.HIDDEN);
        // Void Call cannot target itself: activation reveals its source.
        expect(fieldActivations(legal, 1, true)).toHaveLength(0);
        legal.players[0].actionZones[0] = zone(card('A_Void_Blast'), Position.HIDDEN);
        expect(fieldActivations(legal, 1, true)).toHaveLength(1);

        const depths = game();
        depths.players[1].actionZones[0] = zone(card('C_Call_From_The_Depths', 1), Position.HIDDEN);
        depths.players[1].pawnZones[0] = zone(card('P_Void_Caster', 1));
        depths.players[0].pawnZones[0] = zone(card('P_Solstice_Sentinel'), Position.HIDDEN);
        expect(fieldActivations(depths, 1, true)).toHaveLength(0);
        depths.players[0].pawnZones[0]!.position = Position.ATTACK;
        expect(fieldActivations(depths, 1, true)).toHaveLength(1);
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

        const example = game(), darkDraw = card('C_Dark_Draw'), dragon = card('P_Everlasting_Dragonlord', 1);
        example.players[0].actionZones[0] = zone(darkDraw, Position.HIDDEN);
        example.players[1].pawnZones[0] = zone(dragon);
        example.players[0].deck = [card('P_Solstice_Sentinel')];
        let ordered = addChainLink(example, { card: darkDraw, playerIndex: 0 }, 'activate');
        ordered = addChainLink(ordered, { card: dragon, playerIndex: 1 }, 'activate');
        expect(ordered.players[0].lp).toBe(800);
        ordered = resolveChainStep(ordered);
        expect(ordered.players[1].pawnZones[0]?.card.effectTargetBlockedThisTurn).toBe(true);
        expect(ordered.players[0].lp).toBe(800);
        expect(ordered.players[0].hand).toHaveLength(0);
        const unaffordable = structuredClone(ordered);
        unaffordable.players[0].lp = 100;
        const failed = resolveChainStep(unaffordable);
        expect(failed.players[0].lp).toBe(100);
        expect(failed.players[0].hand).toHaveLength(0);
        expect(failed.log[0]).toContain('cost can no longer be paid');
        ordered = resolveChainStep(ordered);
        expect(ordered.players[0].lp).toBe(600);
        expect(ordered.players[0].hand).toHaveLength(1);
        expect(ordered.log[0]).toContain('-200 LP');
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
        {
            const s = game(), call = card('C_Void_Call'), reinforcement = card('test_attached_condition', 1);
            s.players[0].actionZones[0] = zone(call, Position.HIDDEN);
            s.players[1].actionZones[0] = zone(reinforcement, Position.HIDDEN);
            s.players[1].pawnZones[0] = zone(card('P_Quickstrike_Serpent', 1));
            let next = addChainLink(s, { card: call, playerIndex: 0, target: { playerIndex: 1, type: 'action', index: 0 } }, 'activate');
            next = addChainLink(next, { card: reinforcement, playerIndex: 1, target: { playerIndex: 1, type: 'pawn', index: 0 } }, 'activate');
            next = passAll(next);
            expect(next.players[1].actionZones[0]?.card.instanceId).toBe(reinforcement.instanceId);
            expect(next.players[1].pawnZones[0]!.card.atk).toBe(150);
            expect(next.players[1].void).toHaveLength(0);
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

        for (const [conditionId, targetType] of [
            ['C_Void_Call', 'action'], ['C_Call_From_The_Depths', 'pawn']
        ] as const) {
            const chained = game();
            chained.activePlayerIndex = 1;
            const first = card(conditionId, 1), second = card(conditionId, 1);
            chained.players[1].actionZones[0] = zone(first, Position.HIDDEN);
            chained.players[1].actionZones[1] = zone(second, Position.HIDDEN);
            if (targetType === 'action') chained.players[0].actionZones[0] = zone(card('A_Void_Blast'), Position.HIDDEN);
            else {
                chained.players[0].pawnZones[0] = zone(card('P_Solstice_Sentinel'));
                chained.players[1].pawnZones[0] = zone(card('P_Void_Caster', 1));
                chained.players[1].pawnZones[1] = zone(card('P_Dual_Mode_Beast', 1));
            }
            const context = effectChoices(chained, first, 'activate').find(c => c.targets?.some(t => t.playerIndex === 0))!;
            const pending = addChainLink(chained, context, 'activate');
            expect(pending.chain).toHaveLength(1);
            expect(pending.response?.priority).toBe(1);
            expect(fieldActivations(pending, 1, true).some(a => a.card.instanceId === second.instanceId)).toBe(true);
            expect(chooseAIAction(observeGame(pending, 1), 1)).toEqual({ kind: 'pass' });
        }

        const defenseBoostId = 'test-defensive-last-resort';
        cardRegistry.register({ ...cardRegistry.getCard('C_Last_Resort')!, id: defenseBoostId, name: 'Defensive boost' }, {
            ...cardRegistry.getEffect('C_Last_Resort'),
            onActivate: buildEffect([Cost.PayLP(50), Require.Target('pawn'), Effect.ModifyTargetStats(0, 50, 0, Phase.BATTLE)])
        });
        for (const stat of ['atk', 'def'] as const) for (const position of [Position.DEFENSE, Position.ATTACK]) {
            const boost = game();
            boost.currentPhase = Phase.BATTLE;
            const attacker = card('P_Solstice_Sentinel'), defender = card('P_Solstice_Sentinel', 1);
            attacker.atk = 130; defender.atk = 100; defender.def = stat === 'atk' ? 150 : 100;
            boost.players[0].pawnZones[0] = zone(attacker);
            boost.players[1].pawnZones[0] = zone(defender, position);
            boost.players[1].actionZones[0] = zone(card(stat === 'atk' ? 'C_Last_Resort' : defenseBoostId, 1), Position.HIDDEN, 1);
            const responding = openResponse(boost, { kind: 'attack', attackerId: attacker.instanceId, targetId: defender.instanceId }, 'Attack', 'attack');
            const matches = position === (stat === 'atk' ? Position.ATTACK : Position.DEFENSE);
            expect(chooseAIAction(observeGame(responding, 1), 1).kind).toBe(matches ? 'effect' : 'pass');
        }

        // New cards need no AI metadata: all boost shapes and both stats use
        // actual effect outcomes and legal follow-up commands.
        for (const stat of ['atk', 'def'] as const) for (const shape of ['target', 'self', 'all'] as const) {
            const id = `test-position-boost-${stat}-${shape}`;
            const steps = shape === 'target' ? [Require.Target('pawn', undefined, 'active'), Effect.ModifyTargetStats(stat === 'atk' ? 200 : 0, stat === 'def' ? 200 : 0)]
                : shape === 'self' ? [Effect.ModifySelfStats(stat === 'atk' ? 200 : 0, stat === 'def' ? 200 : 0)]
                    : [Effect.ModifyAllPawnStats('active', stat === 'atk' ? 200 : 0, stat === 'def' ? 200 : 0)];
            cardRegistry.register({ ...cardRegistry.getCard(shape === 'self' ? 'P_Solstice_Sentinel' : 'A_Void_Blast')!, id, name: id }, {
                canActivate: (state, context) => !state.players[context.playerIndex].pawnZones.find(z => z?.card.instanceId === context.card.instanceId)?.hasUsedWhileOnField,
                onActivate: buildEffect(shape === 'self' ? [Effect.SetOnceWhileOnField(), ...steps] : steps)
            });
            const correct = stat === 'atk' ? Position.ATTACK : Position.DEFENSE;
            const wrong = stat === 'atk' ? Position.DEFENSE : Position.ATTACK;
            for (const mode of ['matching', 'locked', 'manual', 'effect'] as const) {
                const board = game(); board.activePlayerIndex = 1; board.currentPhase = Phase.MAIN2;
                const pawn = shape === 'self' ? card(id, 1) : { ...card('P_Solstice_Sentinel', 1), atk: 100, def: 100 };
                board.players[1].pawnZones[0] = zone(pawn, mode === 'matching' ? correct : wrong);
                board.players[1].pawnZones[0]!.hasChangedPosition = mode !== 'manual';
                if (shape !== 'self') board.players[1].hand = [card(id, 1)];
                if (mode === 'effect') {
                    const switchId = `test-position-switch-${stat}-${shape}`;
                    if (!cardRegistry.getCard(switchId)) cardRegistry.register({ ...cardRegistry.getCard('A_Void_Blast')!, id: switchId, name: switchId },
                        { onActivate: buildEffect([Require.Target('pawn', undefined, 'active'), Effect.ChangeTargetPosition(correct)]) });
                    board.players[1].hand.push(card(switchId, 1));
                }
                let current = board;
                const first = chooseAIAction(observeGame(current, 1), 1);
                if (mode === 'locked') {
                    expect(first.kind === 'effect' && first.context.card.id === id, `${id}: locked`).toBe(false);
                    continue;
                }
                for (let step = 0; step < 3; step++) {
                    const action = chooseAIAction(observeGame(current, 1), 1);
                    if (action.kind === 'position') current = applyCommand(current, 1, { type: 'position', index: action.index }).state;
                    else if (action.kind === 'effect') {
                        if (action.fromHand) current = applyCommand(current, 1, { type: 'play', cardId: action.context.card.instanceId, set: false, slot: current.players[1].actionZones.indexOf(null) }).state;
                        current = resolveChain(addChainLink(current, action.context, action.trigger));
                    } else break;
                    current = { ...current, response: undefined, pendingResponse: undefined };
                }
                expect(current.players[1].pawnZones[0]?.position, `${id}: ${mode}`).toBe(correct);
                expect(current.players[1].pawnZones[0]!.card[stat], `${id}: ${mode}`).toBeGreaterThan(pawn[stat]);
            }
        }

        const guarded = game();
        guarded.activePlayerIndex = 1;
        guarded.players[0].pawnZones[0] = zone(card('P_Big_Bear_Beast_King'), Position.DEFENSE);
        guarded.players[0].pawnZones[0]!.card.def = 260;
        guarded.players[1].pawnZones[0] = zone(card('P_High_Voltage_Charged_Dragon', 1));
        guarded.players[1].hand = [card('A_Void_Blast', 1), card('A_Void_Blast', 1)];
        expect(hasWorthwhileAttack(observeGame(guarded, 1), 1)).toBe(false);
        const shortOnCards = structuredClone(guarded);
        shortOnCards.players[1].hand.pop();
        const insufficientBoost = chooseAIAction(observeGame(shortOnCards, 1), 1);
        expect(insufficientBoost.kind === 'effect' && insufficientBoost.context.card.id === 'P_High_Voltage_Charged_Dragon').toBe(false);
        let boosted = guarded;
        for (let i = 0; i < 2; i++) {
            const action = chooseAIAction(observeGame(boosted, 1), 1);
            expect(action).toMatchObject({ kind: 'effect', context: { card: { id: 'P_High_Voltage_Charged_Dragon' } } });
            if (action.kind !== 'effect') break;
            boosted = resolveChain(addChainLink(boosted, action.context, action.trigger));
        }
        expect(boosted.players[1].pawnZones[0]!.card.atk).toBe(270);
        expect(hasWorthwhileAttack(observeGame(boosted, 1), 1)).toBe(true);
        boosted.currentPhase = Phase.BATTLE;
        expect(chooseAIAction(observeGame(boosted, 1), 1)).toEqual({ kind: 'attack', index: 0, target: 0 });

        const stronger = game();
        stronger.activePlayerIndex = 1;
        stronger.players[0].pawnZones[0] = zone(card('P_High_Voltage_Charged_Dragon'));
        stronger.players[1].pawnZones[0] = zone(card('P_High_Voltage_Charged_Dragon', 1));
        stronger.players[1].pawnZones[0]!.card.atk = 220;
        stronger.players[1].hand = Array.from({ length: 4 }, () => card('A_Void_Blast', 1));
        let contender = stronger;
        for (let i = 0; i < 4; i++) {
            const action = chooseAIAction(observeGame(contender, 1), 1);
            expect(action).toMatchObject({ kind: 'effect', context: { card: { id: 'P_High_Voltage_Charged_Dragon' } } });
            if (action.kind !== 'effect') break;
            contender = resolveChain(addChainLink(contender, action.context, action.trigger));
        }
        expect(contender.players[1].pawnZones[0]!.card.atk).toBe(260);
        expect(hasWorthwhileAttack(observeGame(contender, 1), 1)).toBe(true);

        let pressured = structuredClone(stronger);
        pressured.players[1].hand = [];
        pressured.players[1].pawnZones[1] = zone(card('P_Solstice_Sentinel', 1));
        for (let i = 0; i < 2; i++) {
            const action = chooseAIAction(observeGame(pressured, 1), 1);
            expect(action.kind).toBe('position');
            if (action.kind === 'position') pressured = applyCommand(pressured, 1, { type: 'position', index: action.index }).state;
        }
        expect(pressured.players[1].pawnZones.slice(0, 2).every(z => z?.position === Position.DEFENSE)).toBe(true);

        let advantage = game();
        advantage.activePlayerIndex = 1;
        advantage.players[0].pawnZones[0] = zone(card('P_Solstice_Sentinel'));
        advantage.players[0].pawnZones[0]!.card.atk = 80;
        advantage.players[1].pawnZones[0] = zone(card('P_Solstice_Sentinel', 1), Position.DEFENSE);
        advantage.players[1].pawnZones[0]!.card.atk = 150;
        advantage.players[1].pawnZones[1] = zone(card('P_Solstice_Sentinel', 1), Position.DEFENSE);
        advantage.players[1].pawnZones[1]!.card.atk = 100;
        advantage.players[1].pawnZones[2] = zone(card('P_Solstice_Sentinel', 1), Position.DEFENSE);
        advantage.players[1].pawnZones[2]!.card.atk = 20;
        for (let i = 0; i < 2; i++) {
            const action = chooseAIAction(observeGame(advantage, 1), 1);
            expect(action.kind).toBe('position');
            if (action.kind === 'position') advantage = applyCommand(advantage, 1, { type: 'position', index: action.index }).state;
        }
        expect(advantage.players[1].pawnZones.slice(0, 2).every(z => z?.position === Position.ATTACK)).toBe(true);
        expect(advantage.players[1].pawnZones[2]?.position).toBe(Position.DEFENSE);
    });

    it('uses setup and search payoffs, hostile debuffs, and lethal attack order', () => {
        // Delayed setup and search payoffs use the same generic planner.
        const tribunal = game();
        tribunal.activePlayerIndex = 1;
        tribunal.currentPhase = Phase.MAIN2;
        tribunal.players[1].normalSummonUsed = tribunal.players[1].hiddenSummonUsed = true;
        tribunal.players[1].actionZones[0] = zone(card('A_Tribute_Tribunal', 1), Position.FACE_UP);
        tribunal.players[1].pawnZones[0] = zone({ ...card('P_Solstice_Sentinel', 1), atk: 20, def: 20 });
        tribunal.players[1].hand = [card('P_Big_Bear_Beast_King', 1)];
        const investment = chooseAIAction(observeGame(tribunal, 1), 1);
        expect(investment).toMatchObject({ kind: 'effect', context: { effectId: 'tribute', tributeIndices: [0] } });
        if (investment.kind === 'effect') {
            const invested = resolveChain(addChainLink(tribunal, investment.context, investment.trigger));
            expect(invested.players[1].actionZones[0]?.counters).toEqual({ 'Tribute Counters': 1 });
        }
        // The live hook must preserve the mode picked by the planner.
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        vi.useFakeTimers();
        const resolveEffect = vi.fn();
        let root: ReturnType<typeof create> | undefined;
        const setGameState = vi.fn();
        let hookState = tribunal;
        function AIHarness() {
            useOpponentAI({
                gameState: hookState, enabled: true, busy: false,
                setGameState, nextPhase: vi.fn(), skipToEndPhase: vi.fn(), requestAttack: vi.fn(), resolveEffect
            });
            return null;
        }
        try {
            act(() => { root = create(React.createElement(AIHarness)); });
            act(() => vi.advanceTimersByTime(200));
            act(() => root!.update(React.createElement(AIHarness)));
            act(() => vi.advanceTimersByTime(150));
            expect(resolveEffect.mock.calls[0]?.[11]).toBe('tribute');
            const quick = game();
            quick.players[1].pawnZones[0] = zone(card('P_Everlasting_Dragonlord', 1));
            hookState = { ...quick, response: { priority: 1, passes: 0, reason: 'Leave MAIN1', timing: 'phase_exit' } };
            act(() => root!.update(React.createElement(AIHarness)));
            act(() => vi.advanceTimersByTime(0));
            expect(setGameState).toHaveBeenCalledOnce(); // Immediate pass, without the old 650ms wait.
            setGameState.mockClear();
            hookState = { ...quick, currentPhase: Phase.DRAW, response: { priority: 1, passes: 0, reason: 'Before draw' } };
            act(() => root!.update(React.createElement(AIHarness)));
            act(() => vi.advanceTimersByTime(1000));
            expect(setGameState).not.toHaveBeenCalled();
        } finally {
            act(() => root?.unmount());
            vi.useRealTimers();
        }
        cardRegistry.register({ ...cardRegistry.getCard('A_Tribute_Tribunal')!, id: 'test-counter-setup', name: 'Generic charge engine' }, {
            counterSummon: { counter: 'Charge', requiredCounters: c => c.type === CardType.PAWN && c.level >= 5 ? 4 : undefined },
            onFieldActivate: buildEffect([Cost.TributePawns(1), Effect.ModulateCounter('Charge', 1)])
        });
        const genericSetup = structuredClone(tribunal);
        genericSetup.players[1].actionZones[0] = zone(card('test-counter-setup', 1), Position.FACE_UP);
        expect(chooseAIAction(observeGame(genericSetup, 1), 1)).toMatchObject({ kind: 'effect', context: { card: { id: 'test-counter-setup' } } });
        tribunal.players[1].actionZones[0]!.counters = { 'Tribute Counters': 3 };
        tribunal.players[1].pawnZones[0] = null;
        const deployment = chooseAIAction(observeGame(tribunal, 1), 1);
        expect(deployment).toMatchObject({ kind: 'effect', context: { effectId: 'summon', handIndex: 0 } });
        if (deployment.kind === 'effect') {
            const deployed = resolveChain(addChainLink(tribunal, deployment.context, deployment.trigger));
            expect(deployed.players[1].pawnZones.some(z => z?.card.id === 'P_Big_Bear_Beast_King')).toBe(true);
        }

        const frontline = game();
        frontline.activePlayerIndex = 1;
        frontline.players[1].normalSummonUsed = frontline.players[1].hiddenSummonUsed = true;
        frontline.players[1].actionZones[0] = zone(card('C_Orcustrated_Frontline_Unit', 1), Position.HIDDEN);
        frontline.players[1].hand = [{ ...card('P_Solstice_Sentinel', 1), attribute: Attribute.LIGHT }];
        expect(chooseAIAction(observeGame(frontline, 1), 1)).toMatchObject({ kind: 'effect', context: { card: { id: 'C_Orcustrated_Frontline_Unit' } } });
        frontline.players[1].hand = [];
        expect(chooseAIAction(observeGame(frontline, 1), 1)).toEqual({ kind: 'pass' });
        frontline.players[1].actionZones[0]!.position = Position.FACE_UP;
        frontline.pendingHandSummons = [{ sourceId: frontline.players[1].actionZones[0]!.card.instanceId, playerIndex: 1 }];
        const recruit = { ...card('P_Solstice_Sentinel', 1), attribute: Attribute.LIGHT, atk: 150, def: 200 };
        frontline.players[1].hand = [{ ...recruit, instanceId: 'weak-recruit', atk: 10, def: 10 }, recruit];
        frontline.activePlayerIndex = 0;
        frontline.players[0].pawnZones[0] = zone({ ...card('P_Solstice_Sentinel'), atk: 180 });
        expect(chooseAIHandSummon(observeGame(frontline, 1), 1)).toMatchObject({ type: 'confirmHandSummon', cardId: recruit.instanceId, position: Position.DEFENSE });
        frontline.players[1].hand = [];
        expect(chooseAIHandSummon(observeGame(frontline, 1), 1)).toMatchObject({ type: 'declineHandSummon' });

        const search = game();
        search.activePlayerIndex = 1;
        search.players[1].actionZones[0] = zone(card('A_Mark_Of_The_Forest_Hunter', 1), Position.FACE_UP);
        search.players[1].pawnZones[0] = zone({ ...card('P_Solstice_Sentinel', 1), atk: 20, def: 20 });
        search.players[1].pawnZones[1] = zone({ ...card('P_Solstice_Sentinel', 1), atk: 20, def: 20 });
        search.players[1].deck = [card('P_Big_Bear_Beast_King', 1), { ...card('P_Big_Bear_Beast_King', 1), atk: 10, def: 10 }];
        const searched = chooseAIAction(observeGame(search, 1), 1);
        expect(searched).toMatchObject({ kind: 'effect', context: { deckIndex: 0 } });
        if (searched.kind === 'effect') {
            const retrieved = resolveChain(addChainLink(search, searched.context, searched.trigger));
            expect(chooseAIAction(observeGame(retrieved, 1), 1)).toMatchObject({ kind: 'summon', card: { id: 'P_Big_Bear_Beast_King', atk: 220 }, tributes: [0, 1] });
        }
        search.players[1].pawnZones.fill(null);
        expect(chooseAIAction(observeGame(search, 1), 1)).toEqual({ kind: 'pass' });

        const summonDebuff = game();
        summonDebuff.activePlayerIndex = 1;
        const king = card('P_High_King', 1);
        summonDebuff.players[1].pawnZones[0] = zone(king);
        summonDebuff.players[0].pawnZones[0] = zone(card('P_Solstice_Sentinel'));
        expect(chooseAIAction(observeGame(summonDebuff, 1), 1, king)).toMatchObject({ kind: 'effect', context: { target: { playerIndex: 0 } } });
        summonDebuff.players[0].pawnZones[0] = null;
        expect(chooseAIAction(observeGame(summonDebuff, 1), 1, king)).toEqual({ kind: 'pass' });

        const s = game(); s.activePlayerIndex = 1; s.currentPhase = Phase.BATTLE;
        s.players[0].lp = 250;
        s.players[0].pawnZones[0] = zone(card('P_Solstice_Sentinel'), Position.DEFENSE);
        s.players[1].pawnZones[0] = zone(card('P_High_Voltage_Charged_Dragon', 1));
        s.players[1].pawnZones[1] = zone(card('P_Quickstrike_Serpent', 1));
        expect(chooseAIAction(observeGame(s, 1), 1)).toEqual({ kind: 'attack', index: 1, target: 0 });
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
