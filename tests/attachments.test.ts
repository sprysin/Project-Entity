import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, CardType, GameState, Phase, Player, Position } from '../src/types';
import { addChainLink, fieldActivations, resolveChain } from '../src/game/chains';
import { checkVictory } from '../src/game/finishEffect';
import { advancePhaseState } from '../src/game/phases';

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

it('Reinforcement grants ATK only while attached and normally falls off a face-down target', () => {
    const { state, source, target } = setup();
    expect(source).toMatchObject({ type: CardType.CONDITION, isAttached: true });
    const next = resolveChain(addChainLink(state, { card: source, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, 'activate'));
    expect(next.players[0].actionZones[0]?.attachedToInstanceId).toBe(target.instanceId);
    expect(next.players[0].pawnZones[0]?.card.atk).toBe(target.atk + 20);
    expect(fieldActivations(next, 0)).toHaveLength(0);
    expect(state.players[0].actionZones[0]?.attachedToInstanceId).toBeUndefined();
    next.players[0].pawnZones[0]!.position = Position.HIDDEN;
    checkVictory(next);
    expect(next.players[0].actionZones[0]).toBeNull();
    expect(next.players[0].pawnZones[0]?.card.atk).toBe(target.atk);

    const another = setup();
    const sustained = resolveChain(addChainLink(another.state, { card: another.source, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, 'activate'));
    sustained.players[0].actionZones[0]!.card.survivesTargetFlip = true;
    sustained.players[0].pawnZones[0]!.position = Position.HIDDEN;
    checkVictory(sustained);
    expect(sustained.players[0].pawnZones[0]?.card.atk).toBe(target.atk + 20);
    sustained.players[0].actionZones[0] = null;
    checkVictory(sustained);
    expect(sustained.players[0].pawnZones[0]?.card.atk).toBe(target.atk);

    const dragonSetup = setup();
    const dragon = card('pawn_05');
    dragonSetup.state.players[0].pawnZones[0] = zone(dragon);
    dragonSetup.state.players[0].hand = [card('pawn_02')];
    const attached = resolveChain(addChainLink(dragonSetup.state, { card: dragonSetup.source, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, 'activate'));
    const effect = cardRegistry.getEffect(dragon.id)!.onActivate!;
    const activated = effect(attached, { card: dragon, playerIndex: 0, handIndex: 0 }).newState;
    expect(activated.players[0].pawnZones[0]?.card.atk).toBe(280);
    activated.currentPhase = Phase.END;
    const expired = advancePhaseState(activated);
    expect(expired.players[0].pawnZones[0]?.card.atk).toBe(270);
    expect(expired.players[0].actionZones[0]?.attachedToInstanceId).toBe(dragon.instanceId);
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
