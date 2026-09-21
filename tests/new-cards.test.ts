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

it('Glass Witch destroys itself and privately reveals the opponent-selected hand card', () => {
    const game = state();
    const witch = card('pawn_11');
    const shown = card('action_01', 1);
    const hidden = card('pawn_05', 1);
    game.players[0].pawnZones[0] = placed(witch);
    game.players[1].hand = [hidden, shown];

    const choices = effectChoices(game, witch, 'activate');
    expect(choices.map(choice => choice.peekIndex)).toEqual([0, 1]);

    const resolved = addChainLink(game, choices[1], 'activate');
    expect(resolved.players[0].pawnZones[0]).toBeNull();
    expect(resolved.players[0].discard.map(value => value.instanceId)).toContain(witch.instanceId);
    expect(resolved.players[1].hand).toHaveLength(2);
    expect(resolved.peekEvents?.[0]).toMatchObject({
        card: { instanceId: shown.instanceId, name: shown.name },
        ownerPlayerIndex: 1,
        viewerPlayerIndex: 0
    });
    expect(resolved.log.some(entry => entry.includes('reveals "Void Blast"'))).toBe(true);
    expect(resolved.log.some(entry => entry.includes('destroys "Glass Witch"'))).toBe(true);
    expect(resolved.players[0].activatedHardOncePerTurns).toContain('pawn_11');
});

it('Glass Witch is usable in either Main Phase, but not outside a Main Phase or twice per turn', () => {
    const game = state();
    const witch = card('pawn_11', 1);
    game.players[1].pawnZones[0] = placed(witch);
    game.players[0].hand = [card('pawn_01')];

    expect(effectChoices(game, witch, 'activate')).toHaveLength(1);
    game.currentPhase = Phase.BATTLE;
    expect(effectChoices(game, witch, 'activate')).toHaveLength(0);
    game.currentPhase = Phase.MAIN2;
    game.players[1].activatedHardOncePerTurns.push('pawn_11');
    expect(effectChoices(game, witch, 'activate')).toHaveLength(0);
});
