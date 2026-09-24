import './fixtures/attachedCondition';
import { describe, expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, CardType, GameState, Phase, Player, Position } from '../src/types';
import { addChainLink, effectChoices, fieldActivations, openResponse, passPriority, resolveChain, resolveChainStep } from '../src/game/chains';
import { applyCommand } from '../src/game/engine';
import { chooseAIAction, hasWorthwhileAttack, observeGame, updateKnownCards } from '../src/game/opponentAI';
import { buildEffect } from '../src/cards/engine/Builder';
import { Effect } from '../src/cards/engine/Effects';
import { Require } from '../src/cards/engine/Requirements';

let serial = 0;
const card = (id: string, pi = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `card-${serial++}`, ownerId: `player${pi + 1}` });
const zone = (card: Card, position = Position.ATTACK, turn = 1) => ({ card, position, hasAttacked: false, hasChangedPosition: false, summonedTurn: turn, isSetTurn: position === Position.HIDDEN });
function game(): GameState {
    const player = (i: number): Player => ({ id: `player${i + 1}`, name: `Player ${i + 1}`, lp: 800, hand: [], deck: [], initialDeck: [], discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null), normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [] });
    return { players: [player(0), player(1)], activePlayerIndex: 0, currentPhase: Phase.MAIN1, turnNumber: 3, log: [], winner: null, pendingEffects: [] };
}
function passAll(state: GameState) {
    for (let i = 0; i < 20 && state.response && !state.response.ready && !state.winner; i++)
        state = state.resolvingChain ? resolveChainStep(state) : passPriority(state);
    return state;
}

describe('response windows and chains', () => {
    it('skips empty windows, and excludes newly set Conditions and ordinary Pawn effects', () => {
        const s = game();
        const played = card('action_01');
        s.players[0].hand = [played];
        expect(applyCommand(s, 0, { type: 'play', cardId: played.instanceId, set: false, slot: 0 }).state.players[0].actionZones[0]?.position).toBe(Position.FACE_UP);
        s.players[1].pawnZones[0] = zone(card('pawn_05', 1));
        s.players[1].hand = [card('action_01', 1)];
        s.players[1].actionZones[0] = zone(card('test_attached_condition', 1), Position.HIDDEN, s.turnNumber);
        expect(fieldActivations(s, 1, true)).toHaveLength(0);
        expect(openResponse(s, { kind: 'phase' }, 'Leave Main').response?.ready).toBe(true);
    });

    it('counts only cards with an actually legal target and cost', () => {
        const s = game();
        s.players[1].actionZones[0] = zone(card('condition_02', 1), Position.HIDDEN);
        // Void Call cannot target itself: activation reveals its source.
        expect(fieldActivations(s, 1, true)).toHaveLength(0);
        s.players[0].actionZones[0] = zone(card('action_01'), Position.HIDDEN);
        expect(fieldActivations(s, 1, true)).toHaveLength(1);

        const depths = game();
        depths.players[1].actionZones[0] = zone(card('condition_04', 1), Position.HIDDEN);
        depths.players[1].pawnZones[0] = zone(card('pawn_04', 1));
        depths.players[0].pawnZones[0] = zone(card('pawn_01'), Position.HIDDEN);
        expect(fieldActivations(depths, 1, true)).toHaveLength(0);
        depths.players[0].pawnZones[0]!.position = Position.ATTACK;
        expect(fieldActivations(depths, 1, true)).toHaveLength(1);
    });

    it('lets a controller respond during the other player’s turn and resolves LIFO', () => {
        const s = game(), blast = card('action_01'), draw = card('condition_03', 1), reinforcement = card('test_attached_condition');
        s.players[0].actionZones[0] = zone(blast);
        s.players[0].actionZones[1] = zone(reinforcement, Position.HIDDEN);
        s.players[1].actionZones[0] = zone(draw, Position.HIDDEN);
        s.players[1].pawnZones[0] = zone(card('pawn_04', 1));
        s.players[1].deck = [card('pawn_01', 1)];
        let next = addChainLink(s, { card: blast, playerIndex: 0 }, 'activate');
        expect(next.players[1].lp).toBe(800);
        expect(next.response?.priority).toBe(1);
        next = addChainLink(next, { card: draw, playerIndex: 1 }, 'activate');
        expect(next.players[1].lp).toBe(600); // paid before responses
        expect(next.players[1].actionZones[0]?.position).toBe(Position.FACE_UP);
        expect(next.log[0]).toContain('turns face-up');
        expect(next.players[1].hand).toHaveLength(0);
        next = addChainLink(next, { card: reinforcement, playerIndex: 0, target: { playerIndex: 1, type: 'pawn', index: 0 } }, 'activate');
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
    });

    it('a set card flipped in response no longer satisfies an earlier hidden-only target', () => {
        const s = game(), call = card('condition_02'), reinforcement = card('test_attached_condition', 1);
        s.players[0].actionZones[0] = zone(call, Position.HIDDEN);
        s.players[1].actionZones[0] = zone(reinforcement, Position.HIDDEN);
        s.players[1].pawnZones[0] = zone(card('pawn_08', 1));
        let next = addChainLink(s, { card: call, playerIndex: 0, target: { playerIndex: 1, type: 'action', index: 0 } }, 'activate');
        next = addChainLink(next, { card: reinforcement, playerIndex: 1, target: { playerIndex: 1, type: 'pawn', index: 0 } }, 'activate');
        next = passAll(next);
        expect(next.players[1].actionZones[0]?.card.instanceId).toBe(reinforcement.instanceId);
        expect(next.players[1].pawnZones[0]!.card.atk).toBe(150);
        expect(next.players[1].void).toHaveLength(0);
    });
});

describe('fair general AI', () => {
    it('uses only observed identities and avoids harmful attacks or buffs', () => {
        const s = game(); s.activePlayerIndex = 1; s.currentPhase = Phase.BATTLE;
        s.players[1].pawnZones[0] = zone(card('pawn_08', 1));
        s.players[0].hand = [card('action_01')];
        s.players[0].pawnZones[0] = zone(card('pawn_01'), Position.HIDDEN);
        const first = observeGame(s, 1), decision = chooseAIAction(first, 1);
        s.players[0].hand[0] = { ...card('pawn_05'), instanceId: s.players[0].hand[0].instanceId };
        s.players[0].pawnZones[0]!.card = { ...card('pawn_05'), instanceId: s.players[0].pawnZones[0]!.card.instanceId };
        expect(observeGame(s, 1)).toEqual(first);
        expect(chooseAIAction(observeGame(s, 1), 1)).toEqual(decision);
        expect(first.players[0].pawnZones[0]!.card.atk).toBe(0);
        const remembered = new Map<string, Card>();
        s.players[0].pawnZones[0]!.position = Position.DEFENSE;
        updateKnownCards(s, 1, remembered);
        s.players[0].pawnZones[0]!.position = Position.HIDDEN;
        expect(observeGame(s, 1, remembered).players[0].pawnZones[0]!.card.id).toBe('pawn_05');
        s.players[0].pawnZones[0] = null;
        updateKnownCards(s, 1, remembered);
        expect(remembered.size).toBe(0);

        const battle = game(); battle.activePlayerIndex = 1; battle.currentPhase = Phase.BATTLE;
        const defender = card('pawn_05'); defender.def = 200;
        battle.players[0].pawnZones[0] = zone(defender, Position.DEFENSE);
        battle.players[1].pawnZones[0] = zone(card('pawn_01', 1));
        const battleKnown = new Map<string, Card>();
        updateKnownCards(battle, 1, battleKnown);
        battle.players[0].pawnZones[0]!.position = Position.HIDDEN;
        expect(chooseAIAction(observeGame(battle, 1, battleKnown), 1)).toEqual({ kind: 'pass' });

        battle.currentPhase = Phase.MAIN1;
        battle.players[0].pawnZones[0]!.position = Position.ATTACK;
        battle.players[1].hand = [card('condition_01', 1)];
        const choice = chooseAIAction(observeGame(battle, 1), 1);
        expect(choice.kind === 'effect' && choice.context.target?.playerIndex === 0).toBe(false);

        for (const [conditionId, targetType] of [
            ['condition_02', 'action'], ['condition_04', 'pawn']
        ] as const) {
            const chained = game();
            chained.activePlayerIndex = 1;
            const first = card(conditionId, 1), second = card(conditionId, 1);
            chained.players[1].actionZones[0] = zone(first, Position.HIDDEN);
            chained.players[1].actionZones[1] = zone(second, Position.HIDDEN);
            if (targetType === 'action') chained.players[0].actionZones[0] = zone(card('action_01'), Position.HIDDEN);
            else {
                chained.players[0].pawnZones[0] = zone(card('pawn_01'));
                chained.players[1].pawnZones[0] = zone(card('pawn_04', 1));
                chained.players[1].pawnZones[1] = zone(card('pawn_06', 1));
            }
            const context = effectChoices(chained, first, 'activate').find(c => c.targets?.some(t => t.playerIndex === 0))!;
            const pending = addChainLink(chained, context, 'activate');
            expect(pending.chain).toHaveLength(1);
            expect(pending.response?.priority).toBe(1);
            expect(fieldActivations(pending, 1, true).some(a => a.card.instanceId === second.instanceId)).toBe(true);
            expect(chooseAIAction(observeGame(pending, 1), 1)).toEqual({ kind: 'pass' });
        }

        const guarded = game();
        guarded.activePlayerIndex = 1;
        guarded.players[0].pawnZones[0] = zone(card('pawn_07'), Position.DEFENSE);
        guarded.players[0].pawnZones[0]!.card.def = 260;
        guarded.players[1].pawnZones[0] = zone(card('pawn_05', 1));
        guarded.players[1].hand = [card('action_01', 1), card('action_01', 1)];
        expect(hasWorthwhileAttack(observeGame(guarded, 1), 1)).toBe(false);
        const shortOnCards = structuredClone(guarded);
        shortOnCards.players[1].hand.pop();
        const insufficientBoost = chooseAIAction(observeGame(shortOnCards, 1), 1);
        expect(insufficientBoost.kind === 'effect' && insufficientBoost.context.card.id === 'pawn_05').toBe(false);
        let boosted = guarded;
        for (let i = 0; i < 2; i++) {
            const action = chooseAIAction(observeGame(boosted, 1), 1);
            expect(action).toMatchObject({ kind: 'effect', context: { card: { id: 'pawn_05' } } });
            if (action.kind !== 'effect') break;
            boosted = resolveChain(addChainLink(boosted, action.context, action.trigger));
        }
        expect(boosted.players[1].pawnZones[0]!.card.atk).toBe(270);
        expect(hasWorthwhileAttack(observeGame(boosted, 1), 1)).toBe(true);
        boosted.currentPhase = Phase.BATTLE;
        expect(chooseAIAction(observeGame(boosted, 1), 1)).toEqual({ kind: 'attack', index: 0, target: 0 });

        const stronger = game();
        stronger.activePlayerIndex = 1;
        stronger.players[0].pawnZones[0] = zone(card('pawn_05'));
        stronger.players[1].pawnZones[0] = zone(card('pawn_05', 1));
        stronger.players[1].pawnZones[0]!.card.atk = 220;
        stronger.players[1].hand = Array.from({ length: 4 }, () => card('action_01', 1));
        let contender = stronger;
        for (let i = 0; i < 4; i++) {
            const action = chooseAIAction(observeGame(contender, 1), 1);
            expect(action).toMatchObject({ kind: 'effect', context: { card: { id: 'pawn_05' } } });
            if (action.kind !== 'effect') break;
            contender = resolveChain(addChainLink(contender, action.context, action.trigger));
        }
        expect(contender.players[1].pawnZones[0]!.card.atk).toBe(260);
        expect(hasWorthwhileAttack(observeGame(contender, 1), 1)).toBe(true);

        let pressured = structuredClone(stronger);
        pressured.players[1].hand = [];
        pressured.players[1].pawnZones[1] = zone(card('pawn_01', 1));
        for (let i = 0; i < 2; i++) {
            const action = chooseAIAction(observeGame(pressured, 1), 1);
            expect(action.kind).toBe('position');
            if (action.kind === 'position') pressured = applyCommand(pressured, 1, { type: 'position', index: action.index }).state;
        }
        expect(pressured.players[1].pawnZones.slice(0, 2).every(z => z?.position === Position.DEFENSE)).toBe(true);

        let advantage = game();
        advantage.activePlayerIndex = 1;
        advantage.players[0].pawnZones[0] = zone(card('pawn_01'));
        advantage.players[0].pawnZones[0]!.card.atk = 80;
        advantage.players[1].pawnZones[0] = zone(card('pawn_01', 1), Position.DEFENSE);
        advantage.players[1].pawnZones[0]!.card.atk = 150;
        advantage.players[1].pawnZones[1] = zone(card('pawn_01', 1), Position.DEFENSE);
        advantage.players[1].pawnZones[1]!.card.atk = 100;
        advantage.players[1].pawnZones[2] = zone(card('pawn_01', 1), Position.DEFENSE);
        advantage.players[1].pawnZones[2]!.card.atk = 20;
        for (let i = 0; i < 2; i++) {
            const action = chooseAIAction(observeGame(advantage, 1), 1);
            expect(action.kind).toBe('position');
            if (action.kind === 'position') advantage = applyCommand(advantage, 1, { type: 'position', index: action.index }).state;
        }
        expect(advantage.players[1].pawnZones.slice(0, 2).every(z => z?.position === Position.ATTACK)).toBe(true);
        expect(advantage.players[1].pawnZones[2]?.position).toBe(Position.DEFENSE);
    });

    it('finds lethal attack order by saving the stronger attacker for direct damage', () => {
        const s = game(); s.activePlayerIndex = 1; s.currentPhase = Phase.BATTLE;
        s.players[0].lp = 250;
        s.players[0].pawnZones[0] = zone(card('pawn_01'), Position.DEFENSE);
        s.players[1].pawnZones[0] = zone(card('pawn_05', 1));
        s.players[1].pawnZones[1] = zone(card('pawn_08', 1));
        expect(chooseAIAction(observeGame(s, 1), 1)).toEqual({ kind: 'attack', index: 1, target: 0 });
    });

    it('chooses a quick defensive response that stops lethal damage', () => {
        cardRegistry.register({ id: 'test-quick-defense', name: 'Quick defense', type: CardType.PAWN, level: 1, atk: 10, def: 20, effectText: 'Quick: switch an attacker to Defense.' }, {
            timing: 'quick', onActivate: buildEffect([Require.Target('pawn'), Require.TargetMatchesPosition(Position.ATTACK), Effect.ChangeTargetPosition(Position.DEFENSE)])
        });
        const s = game(), defender = card('test-quick-defense', 1), attacker = card('pawn_05');
        s.players[1].lp = 100;
        s.players[1].pawnZones[0] = zone(defender);
        s.players[0].pawnZones[0] = zone(attacker);
        const next = openResponse(s, { kind: 'attack', attackerId: attacker.instanceId, targetId: defender.instanceId }, 'Attack');
        expect(chooseAIAction(observeGame(next, 1), 1)).toMatchObject({ kind: 'effect', context: { target: { playerIndex: 0, index: 0 } } });
    });
});
