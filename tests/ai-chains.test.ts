import { describe, expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, CardType, GameState, Phase, Player, Position } from '../src/types';
import { addChainLink, effectChoices, fieldActivations, openResponse, passPriority } from '../src/game/chains';
import { chooseAIAction, observeGame } from '../src/game/opponentAI';
import { buildEffect } from '../src/cards/engine/Builder';
import { Effect } from '../src/cards/engine/Effects';
import { Cost } from '../src/cards/engine/Costs';
import { Require } from '../src/cards/engine/Requirements';

let serial = 0;
const card = (id: string, pi = 0): Card => ({ ...cardRegistry.getCard(id)!, instanceId: `card-${serial++}`, ownerId: `player${pi + 1}` });
const zone = (card: Card, position = Position.ATTACK, turn = 1) => ({ card, position, hasAttacked: false, hasChangedPosition: false, summonedTurn: turn, isSetTurn: position === Position.HIDDEN });
function game(): GameState {
    const player = (i: number): Player => ({ id: `player${i + 1}`, name: `Player ${i + 1}`, lp: 800, hand: [], deck: [], initialDeck: [], discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null), normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [] });
    return { players: [player(0), player(1)], activePlayerIndex: 0, currentPhase: Phase.MAIN1, turnNumber: 3, log: [], winner: null, pendingEffects: [] };
}
function passAll(state: GameState) {
    for (let i = 0; i < 20 && state.response && !state.response.ready && !state.winner; i++) state = passPriority(state);
    return state;
}

describe('response windows and chains', () => {
    it('skips empty windows, and excludes newly set Conditions and ordinary Pawn effects', () => {
        const s = game();
        s.players[1].pawnZones[0] = zone(card('pawn_05', 1));
        s.players[1].hand = [card('action_01', 1)];
        s.players[1].actionZones[0] = zone(card('condition_01', 1), Position.HIDDEN, s.turnNumber);
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
    });

    it('allows a lingering Action set face-down to activate its field effect', () => {
        const s = game(), mark = card('action_03'), bear = card('pawn_07');
        s.players[0].actionZones[0] = zone(mark, Position.HIDDEN, s.turnNumber);
        s.players[0].deck = [bear];

        const activations = fieldActivations(s, 0);

        expect(activations).toMatchObject([{ card: { instanceId: mark.instanceId }, trigger: 'field_activate' }]);
    });

    it('lets a controller respond during the other player’s turn and resolves LIFO', () => {
        const s = game(), blast = card('action_01'), draw = card('condition_03', 1), reinforcement = card('condition_01');
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
        expect(resolutionLogs[2]).toContain('Reinforcement');
        expect(next.chain).toHaveLength(0);
    });

    it('does not let the AI reactivate a lingering Condition after its flip activation resolves', () => {
        const s = game(), reinforcement = card('condition_01', 1), pawn = card('pawn_08', 1);
        s.activePlayerIndex = 1;
        s.players[1].actionZones[0] = zone(reinforcement, Position.HIDDEN);
        s.players[1].pawnZones[0] = zone(pawn);

        const next = passAll(addChainLink(s, {
            card: reinforcement,
            playerIndex: 1,
            target: { playerIndex: 1, type: 'pawn', index: 0 }
        }, 'activate'));

        expect(next.players[1].pawnZones[0]!.card.atk).toBe(pawn.atk + 20);
        expect(next.players[1].actionZones[0]?.position).toBe(Position.ATTACK);
        expect(fieldActivations(next, 1)).toHaveLength(0);
        expect(chooseAIAction(observeGame(next, 1), 1)).not.toMatchObject({
            kind: 'effect',
            context: { card: { instanceId: reinforcement.instanceId } }
        });
    });

    it('pays a 200 LP cost exactly once even when only 300 LP remain', () => {
        const s = game(), draw = card('condition_03');
        s.players[0].lp = 300;
        s.players[0].actionZones[0] = zone(draw, Position.HIDDEN);
        s.players[0].pawnZones[0] = zone(card('pawn_04'));
        s.players[0].deck = [card('pawn_01')];
        const next = passAll(addChainLink(s, { card: draw, playerIndex: 0 }, 'activate'));
        expect(next.players[0].lp).toBe(100);
        expect(next.players[0].hand).toHaveLength(1);
    });

    it('runs a custom resolution handler once, never while paying activation costs', () => {
        cardRegistry.register({ id: 'test-custom', name: 'Custom effect', type: CardType.ACTION, level: 0, atk: 0, def: 0, effectText: 'Deal 30 damage.' }, {
            onActivate: (state, context) => { const next = structuredClone(state); next.players[1 - context.playerIndex].lp -= 30; return { newState: next }; }
        });
        const s = game(), source = card('test-custom');
        s.players[0].actionZones[0] = zone(source);
        expect(addChainLink(s, { card: source, playerIndex: 0 }, 'activate').players[1].lp).toBe(770);
    });

    it('supports explicitly quick Pawns, reserves costs and prevents the same source rejoining its chain', () => {
        cardRegistry.register({ id: 'test-quick', name: 'Quick Pawn', type: CardType.PAWN, level: 1, atk: 10, def: 20, effectText: 'Quick: discard 1; gain 20 LP.' }, {
            timing: 'quick', onActivate: buildEffect([Cost.DiscardCardFilter(), Effect.RestoreLP((_s, c) => c.playerIndex, 20)])
        });
        const s = game(), quick = card('test-quick', 1), reply = card('condition_01');
        s.players[1].pawnZones[0] = zone(quick);
        s.players[1].hand = [card('action_01', 1)];
        s.players[0].actionZones[0] = zone(reply, Position.HIDDEN);
        const window = openResponse(s, { kind: 'phase' }, 'Leave Main');
        expect(fieldActivations(window, 1, true)).toHaveLength(1);
        const next = addChainLink(window, { card: quick, playerIndex: 1, handIndex: 0 }, 'activate');
        expect(next.players[1].hand).toHaveLength(0);
        expect(next.players[1].lp).toBe(800);
        expect(fieldActivations(next, 1, true)).toHaveLength(0);
        expect(passAll(next).players[1].lp).toBe(820);
    });

    it('does not retarget a replacement card that occupies the old slot', () => {
        const s = game(), king = card('pawn_02'), target = card('pawn_05', 1);
        s.players[0].pawnZones[0] = zone(king);
        s.players[1].pawnZones[0] = zone(target);
        s.players[1].actionZones[0] = zone(card('condition_01', 1), Position.HIDDEN);
        let next = addChainLink(s, { card: king, playerIndex: 0, target: { playerIndex: 1, type: 'pawn', index: 0 } }, 'summon');
        const replacement = card('pawn_08', 1);
        next.players[1].pawnZones[0] = zone(replacement);
        next = passAll(next);
        expect(next.players[1].pawnZones[0]!.card.atk).toBe(130);
        expect(next.log[0]).toContain('no longer valid');
    });

    it('a set card flipped in response no longer satisfies an earlier hidden-only target', () => {
        const s = game(), call = card('condition_02'), reinforcement = card('condition_01', 1);
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

    it('validates tribute costs, handles full fields, and pays only at activation', () => {
        const s = game(), maintenance = card('action_04');
        s.players[0].actionZones[0] = zone(maintenance);
        s.players[0].pawnZones = Array.from({ length: 5 }, () => zone(card('pawn_01')));
        s.players[0].discard = [card('pawn_05')];
        // Charged Dragon is not Mechanical, so no valid recovery exists.
        expect(effectChoices(s, maintenance, 'activate')).toHaveLength(0);
        s.players[0].discard = [card('pawn_01')];
        const choices = effectChoices(s, maintenance, 'activate');
        expect(choices.length).toBeGreaterThan(0);
        const next = addChainLink(s, choices[0], 'activate');
        expect(next.players[0].pawnZones.filter(Boolean)).toHaveLength(4);
        expect(next.players[0].discard.filter(c => c.tributedByAction)).toHaveLength(2);
    });
});

describe('fair general AI', () => {
    it('strips hidden identities and produces the same decision when secrets change', () => {
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
    });

    it('tribute summons a searched boss when it takes combat control', () => {
        const s = game(); s.activePlayerIndex = 1;
        s.players[0].pawnZones[0] = zone(card('pawn_02'));
        s.players[1].pawnZones[0] = zone(card('pawn_01', 1));
        s.players[1].pawnZones[1] = zone(card('pawn_04', 1));
        s.players[1].hand = [card('pawn_07', 1)];
        expect(chooseAIAction(observeGame(s, 1), 1)).toMatchObject({
            kind: 'summon', hidden: false, card: { id: 'pawn_07' }, tributes: [0, 1]
        });
    });

    it('finds lethal attack order by saving the stronger attacker for direct damage', () => {
        const s = game(); s.activePlayerIndex = 1; s.currentPhase = Phase.BATTLE;
        s.players[0].lp = 250;
        s.players[0].pawnZones[0] = zone(card('pawn_01'), Position.DEFENSE);
        s.players[1].pawnZones[0] = zone(card('pawn_05', 1));
        s.players[1].pawnZones[1] = zone(card('pawn_08', 1));
        expect(chooseAIAction(observeGame(s, 1), 1)).toEqual({ kind: 'attack', index: 1, target: 0 });
    });

    it('uses a new registered effect without a card-specific AI recipe', () => {
        cardRegistry.register({ id: 'test-generic', name: 'Generic blast', type: CardType.ACTION, level: 0, atk: 0, def: 0, effectText: 'Deal damage.' }, { onActivate: buildEffect([Effect.DealDamage((_s, c) => 1 - c.playerIndex, 90)]) });
        const s = game(); s.activePlayerIndex = 1; s.players[0].lp = 90;
        s.players[1].hand = [card('test-generic', 1)];
        expect(chooseAIAction(observeGame(s, 1), 1)).toMatchObject({ kind: 'effect', context: { card: { id: 'test-generic' } } });
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
