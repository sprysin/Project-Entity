import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, CardType, GameState, Phase, Player, Position } from '../src/types';
import { addChainLink, fieldActivations, resolveChain } from '../src/game/chains';
import { buildEffect } from '../src/cards/engine/Builder';
import { Require } from '../src/cards/engine/Requirements';
import { Effect } from '../src/cards/engine/Effects';
import { checkVictory } from '../src/game/finishEffect';

const card = (id: string): Card => ({ ...cardRegistry.getCard(id)!, instanceId: id, ownerId: 'p0' });
const zone = (card: Card) => ({ card, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
function setup() {
    const player = (id: string): Player => ({ id, name: id, lp: 800, hand: [], deck: [], initialDeck: [], discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null), normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [] });
    const state: GameState = { players: [player('p0'), player('p1')], activePlayerIndex: 0, currentPhase: Phase.MAIN1, turnNumber: 3, log: [], winner: null, pendingEffects: [] };
    const source = card('condition_01'), target = card('pawn_01');
    state.players[0].actionZones[0] = zone(source);
    state.players[0].pawnZones[0] = zone(target);
    return { state, source, target };
}

it('Reinforcement attaches once, grants +20 ATK and remains face-up as a Condition', () => {
    const { state, source, target } = setup();
    expect(source).toMatchObject({ type: CardType.CONDITION, isAttached: true });
    const next = addChainLink(state, { card: source, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, 'activate');
    expect(next.players[0].actionZones[0]?.attachedToInstanceId).toBe(target.instanceId);
    expect(next.players[0].pawnZones[0]?.card.atk).toBe(target.atk + 20);
    expect(fieldActivations(next, 0)).toHaveLength(0);
    expect(state.players[0].actionZones[0]?.attachedToInstanceId).toBeUndefined();
});

it('activates an Attach Condition after it has been set for a turn', () => {
    const { state } = setup();
    state.players[0].actionZones[0]!.position = Position.HIDDEN;
    expect(fieldActivations(state, 0)[0]?.trigger).toBe('activate');
    expect(fieldActivations(state, 0, true)[0]?.trigger).toBe('activate');
    state.players[0].actionZones[0]!.summonedTurn = state.turnNumber;
    expect(fieldActivations(state, 0)).toHaveLength(0);
});

it.each([CardType.ACTION, CardType.CONDITION])('supports Attach %s targeting another non-Pawn card', type => {
    const { state, source } = setup();
    const definition = { ...cardRegistry.getCard(source.id)!, id: `attached-${type}`, type };
    cardRegistry.register(definition, { onActivate: buildEffect([Require.Target('action'), Effect.AttachToTarget()]) });
    const attached = card(definition.id), target = card('action_03');
    state.players[0].actionZones[0] = zone(attached);
    state.players[0].actionZones[1] = zone(target);
    const next = addChainLink(state, { card: attached, playerIndex: 0, target: { playerIndex: 0, type: 'action', index: 1 } }, 'activate');
    expect(next.players[0].actionZones[0]?.attachedToInstanceId).toBe(target.instanceId);
});

it('discards an attachment that fizzles instead of linking to a replacement target', () => {
    const { state, source, target } = setup();
    state.chain = [{ context: { card: source, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, trigger: 'activate', targetId: target.instanceId }];
    state.players[0].pawnZones[0] = zone(card('pawn_02'));
    const next = resolveChain(state);
    expect(next.players[0].actionZones[0]).toBeNull();
    expect(next.players[0].discard[0].instanceId).toBe(source.instanceId);
    expect(next.players[0].pawnZones[0]?.card.atk).toBe(card('pawn_02').atk);
});

it('destroys an Attach card when its target leaves the field', () => {
    const { state, source, target } = setup();
    state.players[0].actionZones[0]!.attachedToInstanceId = target.instanceId;
    state.players[0].discard.push(target);
    state.players[0].pawnZones[0] = null;

    const next = checkVictory(state);

    expect(next.players[0].actionZones[0]).toBeNull();
    expect(next.players[0].discard.map(discarded => discarded.instanceId)).toEqual([target.instanceId, source.instanceId]);
});

it('destroys chained Attach cards when an attached target leaves the field', () => {
    const { state, source, target } = setup();
    const secondSource = { ...source, instanceId: 'second-attachment' };
    state.players[0].actionZones[0]!.attachedToInstanceId = target.instanceId;
    state.players[0].actionZones[1] = { ...zone(secondSource), attachedToInstanceId: source.instanceId };
    state.players[0].pawnZones[0] = null;

    const next = checkVictory(state);

    expect(next.players[0].actionZones.slice(0, 2)).toEqual([null, null]);
    expect(next.players[0].discard.map(discarded => discarded.instanceId)).toEqual([source.instanceId, secondSource.instanceId]);
});
