import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { addChainLink, effectChoices, resolveChain } from '../src/game/chains';
import { Card, GameState, Phase, Player, Position } from '../src/types';

let serial = 0;
const card = (id: string, owner = 0): Card => ({
    ...cardRegistry.getCard(id)!,
    instanceId: `new-card-${serial++}`,
    ownerId: `player${owner + 1}`
});
const placed = (value: Card, position = Position.ATTACK) => ({
    card: value,
    position,
    hasAttacked: false,
    hasChangedPosition: false,
    summonedTurn: 1,
    isSetTurn: position === Position.HIDDEN
});
const player = (index: number): Player => ({
    id: `player${index + 1}`,
    name: `Player ${index + 1}`,
    lp: 800,
    deck: [],
    initialDeck: [],
    hand: [],
    discard: [],
    void: [],
    pawnZones: Array(5).fill(null),
    actionZones: Array(5).fill(null),
    normalSummonUsed: false,
    hiddenSummonUsed: false,
    activatedHardOncePerTurns: []
});
const state = (): GameState => ({
    players: [player(0), player(1)],
    activePlayerIndex: 0,
    currentPhase: Phase.MAIN1,
    turnNumber: 2,
    log: [],
    winner: null,
    pendingEffects: []
});

it('Call from the Depths flips one face-up Pawn on each field face-down', () => {
    const game = state();
    const call = card('condition_04');
    game.players[0].actionZones[0] = placed(call, Position.HIDDEN);
    game.players[0].pawnZones[0] = placed(card('pawn_08'));
    game.players[0].pawnZones[1] = placed(card('pawn_01'), Position.HIDDEN);
    game.players[1].pawnZones[0] = placed(card('pawn_05', 1));

    const handler = cardRegistry.getEffect(call.id)!.onActivate!;
    const firstRequest = handler(game, { card: call, playerIndex: 0 });
    expect(firstRequest).toMatchObject({
        requireTarget: 'pawn', requireTargetPosition: 'faceup',
        requireTargetScope: 'active', requireTargetIndex: 0
    });
    const ownTarget = { playerIndex: 0, type: 'pawn' as const, index: 0 };
    const secondRequest = handler(game, { card: call, playerIndex: 0, target: ownTarget, targets: [ownTarget] });
    expect(secondRequest).toMatchObject({
        requireTarget: 'pawn', requireTargetPosition: 'faceup',
        requireTargetScope: 'opponent', requireTargetIndex: 1
    });

    const choices = effectChoices(game, call, 'activate');
    expect(choices).toHaveLength(1);
    expect(choices[0].targets).toEqual([
        { playerIndex: 0, type: 'pawn', index: 0 },
        { playerIndex: 1, type: 'pawn', index: 0 }
    ]);

    const resolved = resolveChain(addChainLink(game, choices[0], 'activate'));
    expect(resolved.players[0].pawnZones[0]?.position).toBe(Position.HIDDEN);
    expect(resolved.players[0].pawnZones[1]?.position).toBe(Position.HIDDEN);
    expect(resolved.players[1].pawnZones[0]?.position).toBe(Position.HIDDEN);
    expect(resolved.players[0].discard.some(value => value.instanceId === call.instanceId)).toBe(true);
});

it('Glitter Guard Beatle fortifies every controlled Pawn when discarded as a cost', () => {
    const game = state();
    const serpent = card('pawn_08');
    const beatle = card('pawn_10');
    const ally = card('pawn_01');
    game.players[0].pawnZones[0] = placed(serpent);
    game.players[0].pawnZones[1] = placed(ally);
    game.players[0].hand = [beatle];

    const context = effectChoices(game, serpent, 'activate')[0];
    const resolved = resolveChain(addChainLink(game, context, 'activate'));

    expect(resolved.players[0].discard.map(value => value.instanceId)).toContain(beatle.instanceId);
    expect(resolved.players[0].pawnZones[0]?.position).toBe(Position.DEFENSE);
    expect(resolved.players[0].pawnZones[1]?.position).toBe(Position.DEFENSE);
    expect(resolved.players[0].pawnZones[0]?.card.def).toBe(280);
    expect(resolved.players[0].pawnZones[1]?.card.def).toBe(310);
    expect(resolved.pendingEffects).toEqual(expect.arrayContaining([
        expect.objectContaining({ targetInstanceId: serpent.instanceId, type: 'RESET_DEF', value: 80, dueTurn: 2 }),
        expect.objectContaining({ targetInstanceId: ally.instanceId, type: 'RESET_DEF', value: 110, dueTurn: 2 })
    ]));
});
