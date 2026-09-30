import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { addChainLink, effectChoices, fieldActivations, resolveChain, runEffect } from '../src/game/chains';
import { checkVictory } from '../src/game/finishEffect';
import { sendToOwnerPile } from '../src/game/cardOwnership';
import { applyCommand, applySystemCommand } from '../src/game/engine';
import { resolveCombat } from '../src/game/combat';
import { advancePhaseState } from '../src/game/phases';
import { Effect } from '../src/cards/engine/Effects';
import { Cost } from '../src/cards/engine/Costs';
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

it('new Conditions and Turnados resolve their selected effects', () => {
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

    const windGame = state();
    const turnados = card('pawn_15');
    const airCost = card('pawn_11');
    const enemyAction = card('action_01', 1);
    windGame.players[0].pawnZones[0] = placed(turnados);
    windGame.players[0].discard = [airCost];
    windGame.players[1].actionZones[0] = placed(enemyAction, Position.HIDDEN);
    const windChoices = effectChoices(windGame, turnados, 'summon');
    expect(windChoices).toHaveLength(1);
    expect(windChoices[0]).toMatchObject({ shuffleCardIds: [airCost.instanceId], target: { playerIndex: 1, type: 'action', index: 0 } });
    const windResolved = resolveChain(addChainLink(windGame, windChoices[0], 'summon'));
    expect(windResolved.players[0].deck.some(value => value.instanceId === airCost.instanceId)).toBe(true);
    expect(windResolved.players[1].actionZones[0]).toBeNull();
    expect(windResolved.players[1].discard.some(value => value.instanceId === enemyAction.instanceId)).toBe(true);

    for (const location of ['hand', 'field', 'discard'] as const) {
        const costGame = state();
        const first = card('pawn_01');
        const second = card('pawn_03');
        if (location === 'hand') costGame.players[0].hand = [first, second];
        else if (location === 'discard') costGame.players[0].discard = [first, second];
        else { costGame.players[0].pawnZones[0] = placed(first); costGame.players[0].pawnZones[1] = placed(second); }
        const shuffle = Cost.ShuffleFrom(location, 2);
        expect(shuffle(costGame, { card: turnados, playerIndex: 0 })).toMatchObject({
            requireShuffleSelection: { location, count: 2 }
        });
        shuffle(costGame, { card: turnados, playerIndex: 0, shuffleCardIds: [first.instanceId, second.instanceId] });
        expect(costGame.players[0].deck.map(value => value.instanceId).sort()).toEqual([first.instanceId, second.instanceId].sort());
        const effectGame = state();
        effectGame.players[0].discard = [first, second];
        effectGame.players[0].discard.reverse();
        Effect.ShuffleFrom('discard', 1)(effectGame, { card: turnados, playerIndex: 0, shuffleCardIds: [first.instanceId] });
        expect(effectGame.players[0].deck[0].instanceId).toBe(first.instanceId);
        expect(effectGame.players[0].discard[0].instanceId).toBe(second.instanceId);
    }

    const attackGame = state();
    attackGame.currentPhase = Phase.BATTLE;
    const attacker = card('pawn_01');
    const escape = card('condition_05', 1);
    const discarded = card('pawn_03', 1);
    attackGame.players[0].pawnZones[0] = placed(attacker);
    attackGame.players[1].actionZones[0] = placed(escape, Position.HIDDEN);
    attackGame.players[1].hand = [discarded];
    const announced = applyCommand(attackGame, 0, { type: 'attack', attackerIndex: 0, targetIndex: 'direct' }).state;
    const escapeChoice = effectChoices(announced, escape, 'activate')[0];
    expect(escapeChoice.handIndex).toBe(0);
    const negated = resolveChain(addChainLink(announced, escapeChoice, 'activate'));
    expect(negated.deferredAction).toBeUndefined();
    expect(negated.players[0].pawnZones[0]?.hasAttacked).toBe(true);
    expect(negated.players[1].discard.some(value => value.instanceId === discarded.instanceId)).toBe(true);
    expect(applySystemCommand(negated, { type: 'completeDeferred' }).state.players[1].lp).toBe(800);

    // The same behavior must work under an unrelated ID with no engine edits.
    cardRegistry.register({ ...cardRegistry.getCard('condition_06')!, id: 'test-summon-observer' }, cardRegistry.getEffect('condition_06')!);
    for (const sourceId of ['condition_06', 'test-summon-observer']) {
    const tributeGame = state();
    const handSummon = card(sourceId, 1);
    const light = card('pawn_01', 1);
    const king = card('pawn_02');
    tributeGame.players[0].pawnZones[0] = placed(card('pawn_03'));
    tributeGame.players[0].hand = [king];
    tributeGame.players[1].actionZones[0] = placed(handSummon);
    tributeGame.players[1].hand = [light];
    const summoned = applyCommand(tributeGame, 0, { type: 'summon', cardId: king.instanceId, hidden: false, slot: 0, tributes: [0] }).state;
    expect(summoned.pendingHandSummons).toEqual([{ sourceId: handSummon.instanceId, playerIndex: 1 }]);
    const special = applyCommand(summoned, 1, { type: 'confirmHandSummon', sourceId: handSummon.instanceId, cardId: light.instanceId, slot: 3, position: Position.DEFENSE }).state;
    expect(special.pendingHandSummons).toEqual([]);
    expect(special.players[1].pawnZones[0]).toBeNull();
    expect(special.players[1].pawnZones[3]?.card.instanceId).toBe(light.instanceId);
    expect(special.players[1].pawnZones[3]?.position).toBe(Position.DEFENSE);
    const invalid = card('pawn_03', 1);
    summoned.players[1].hand.push(invalid);
    expect(applyCommand(summoned, 1, { type: 'confirmHandSummon', sourceId: handSummon.instanceId, cardId: invalid.instanceId, slot: 3, position: Position.DEFENSE }).state).toBe(summoned);
    const hiddenSource = structuredClone(summoned);
    hiddenSource.players[1].actionZones[0]!.position = Position.HIDDEN;
    expect(applyCommand(hiddenSource, 1, { type: 'confirmHandSummon', sourceId: handSummon.instanceId, cardId: light.instanceId, slot: 3, position: Position.DEFENSE }).state).toBe(hiddenSource);
    const hiddenSummon = applyCommand(tributeGame, 0, { type: 'summon', cardId: king.instanceId, hidden: true, slot: 0, tributes: [0] }).state;
    expect(hiddenSummon.pendingHandSummons).toBeUndefined();
    const absentSource = structuredClone(tributeGame);
    absentSource.players[1].actionZones[0] = null;
    expect(applyCommand(absentSource, 0, { type: 'summon', cardId: king.instanceId, hidden: false, slot: 0, tributes: [0] }).state.pendingHandSummons).toBeUndefined();
    }
});

it('Tribunal tracks counters, separate soft uses, summon choices and interrupted activations', () => {
    const counterCount = (zone: GameState['players'][number]['actionZones'][number]) => zone?.counters?.['Tribute Counters'] ?? 0;
    let game = state();
    const tribunal = card('action_06');
    const second = card('action_06');
    const low = { ...card('pawn_01'), level: 4 as const };
    const one = { ...card('pawn_01'), level: 5 as const };
    const two = { ...card('pawn_01'), level: 8 as const };
    game.players[0].actionZones[0] = placed(tribunal, Position.FACE_UP);
    game.players[0].actionZones[1] = placed(second, Position.FACE_UP);
    expect(fieldActivations(game, 0)).toEqual([]);
    expect(runEffect(game, { card: tribunal, playerIndex: 0 }, 'field_activate').halted).toBe(true);
    game.players[0].hand = [low, one, two];
    game.players[0].pawnZones[0] = placed(card('pawn_01'));
    expect(runEffect(game, { card: tribunal, playerIndex: 0 }, 'field_activate').requireEffectChoice)
        .toMatchObject([{ id: 'tribute', disabled: false }, { id: 'summon', disabled: true }]);
    const tribute = effectChoices(game, tribunal, 'field_activate')[0];
    expect(tribute.effectId).toBe('tribute');
    const paid = addChainLink(game, tribute, 'field_activate');
    expect(paid.players[0].pawnZones[0]).toBeNull();
    expect(paid.players[0].discard).toHaveLength(1);
    expect(counterCount(paid.players[0].actionZones[0])).toBe(0);
    for (const interruption of ['removed', 'hidden'] as const) {
        const interrupted = structuredClone(paid);
        if (interruption === 'removed') interrupted.players[0].actionZones[0] = null;
        else interrupted.players[0].actionZones[0]!.position = Position.HIDDEN;
        const fizzled = resolveChain(interrupted);
        expect(fizzled.players[0].discard).toHaveLength(1);
        expect(counterCount(fizzled.players[0].actionZones[0])).toBe(0);
        if (interruption === 'hidden') expect(fizzled.players[0].actionZones[0]?.position).toBe(Position.HIDDEN);
    }
    game = resolveChain(paid);
    expect(counterCount(game.players[0].actionZones[0])).toBe(1);
    expect(game.log[0]).toContain('+1 Tribute Counters');
    expect(effectChoices(game, tribunal, 'field_activate').some(choice => choice.effectId === 'summon')).toBe(false);
    Effect.ModulateCounter('Tribute Counters', 1)(game, { card: tribunal, playerIndex: 0 });
    const summons = effectChoices(game, tribunal, 'field_activate');
    expect(summons).toHaveLength(10); // five slots, both face-up positions
    expect(summons.every(choice => choice.effectId === 'summon' && choice.handIndex === 1)).toBe(true);
    const summon = summons.find(choice => choice.pawnPlacement?.slot === 3 && choice.pawnPlacement.position === Position.DEFENSE)!;
    const queuedSummon = addChainLink(game, summon, 'field_activate');
    for (const interruption of ['source removed', 'source hidden', 'hand removed', 'slot filled'] as const) {
        const interrupted = structuredClone(queuedSummon);
        if (interruption === 'source removed') interrupted.players[0].actionZones[0] = null;
        if (interruption === 'source hidden') interrupted.players[0].actionZones[0]!.position = Position.HIDDEN;
        if (interruption === 'hand removed') interrupted.players[0].hand.splice(1, 1);
        if (interruption === 'slot filled') interrupted.players[0].pawnZones[3] = placed(low);
        const fizzled = resolveChain(interrupted);
        expect(fizzled.players[0].pawnZones.every(zone => zone?.card.instanceId !== one.instanceId)).toBe(true);
    }
    queuedSummon.players[0].hand.reverse();
    game = resolveChain(queuedSummon);
    expect(game.players[0].pawnZones[3]).toMatchObject({ card: { instanceId: one.instanceId }, position: Position.DEFENSE });
    expect(game.players[0].normalSummonUsed).toBe(false);
    expect(counterCount(game.players[0].actionZones[0])).toBe(2);
    expect(effectChoices(game, tribunal, 'field_activate')).toEqual([]);
    expect(effectChoices(game, second, 'field_activate').some(choice => choice.effectId === 'tribute')).toBe(true);
    game.turnNumber += 2;
    game.players[0].hand = [low, one, two];
    expect(new Set(effectChoices(game, tribunal, 'field_activate')
        .filter(choice => choice.effectId === 'summon').map(choice => choice.handIndex))).toEqual(new Set([1]));
    Effect.ModulateCounter('Tribute Counters', 1)(game, { card: tribunal, playerIndex: 0 });
    const later = effectChoices(game, tribunal, 'field_activate');
    expect(new Set(later.filter(choice => choice.effectId === 'summon').map(choice => choice.handIndex))).toEqual(new Set([1, 2]));
    Effect.ModulateCounter('Tribute Counters', 4)(game, { card: tribunal, playerIndex: 0 });
    expect(counterCount(game.players[0].actionZones[0])).toBe(7);
    game.currentPhase = Phase.BATTLE;
    expect(fieldActivations(game, 0)).toEqual([]);
    game.currentPhase = Phase.MAIN2;
    game.activePlayerIndex = 1;
    expect(fieldActivations(game, 0)).toEqual([]);
    game.activePlayerIndex = 0;
    const zone = game.players[0].actionZones[0]!;
    game.players[0].actionZones[0] = null;
    game.players[1].actionZones[0] = zone;
    expect(counterCount(zone)).toBe(7);
    zone.position = Position.HIDDEN;
    checkVictory(game);
    expect(zone.counters).toBeUndefined();
    zone.position = Position.FACE_UP;
    Effect.ModulateCounter('Tribute Counters', 1)(game, { card: tribunal, playerIndex: 1 });
    sendToOwnerPile(game, zone.card, 'hand');
    game.players[1].actionZones[0] = null;
    game.players[0].actionZones[0] = placed(game.players[0].hand.at(-1)!, Position.FACE_UP);
    expect(counterCount(game.players[0].actionZones[0])).toBe(0);
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

    const resolved = resolveChain(addChainLink(game, choices[1], 'activate'));
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
    const timing = state();
    timing.players[1].pawnZones[0] = placed(card('pawn_11', 1));
    timing.players[0].hand = [card('pawn_01')];
    expect(effectChoices(timing, timing.players[1].pawnZones[0]!.card, 'activate')).toHaveLength(1);
    timing.currentPhase = Phase.BATTLE;
    expect(effectChoices(timing, timing.players[1].pawnZones[0]!.card, 'activate')).toHaveLength(0);
    timing.currentPhase = Phase.MAIN2;
    timing.players[1].activatedHardOncePerTurns.push('pawn_11');
    expect(effectChoices(timing, timing.players[1].pawnZones[0]!.card, 'activate')).toHaveLength(0);
});

it('Switch reveals, Necromancer revival and controlled cards use their owner’s piles', () => {
    let game = state();
    const ghost = card('pawn_12');
    const necromancer = card('pawn_14');
    const enemy = card('pawn_02', 1);
    game.players[0].pawnZones[0] = placed(ghost, Position.HIDDEN);
    game.players[0].pawnZones[1] = placed(necromancer);
    game.players[1].pawnZones[0] = placed(enemy);
    game = applyCommand(game, 0, { type: 'position', index: 0 }).state;
    expect(game.pendingSwitches?.[0].card.instanceId).toBe(ghost.instanceId);
    const firstTarget = { playerIndex: 1, type: 'pawn' as const, index: 0 };
    const targetPreview = runEffect(game, { card: ghost, playerIndex: 0, target: firstTarget, targets: [firstTarget] }, 'switch');
    expect(targetPreview.requireTargetIndex).toBe(1);
    expect(targetPreview.newState.players[1].pawnZones[0]?.card.atk).toBe(170);
    const ghostChoice = effectChoices(game, ghost, 'switch')[0];
    expect(ghostChoice.targets).toEqual([{ playerIndex: 1, type: 'pawn', index: 0 }, { playerIndex: 0, type: 'pawn', index: 1 }]);
    const missingSecondTarget = structuredClone(game);
    missingSecondTarget.players[0].pawnZones[1] = null;
    missingSecondTarget.chain = [{ context: ghostChoice, trigger: 'switch', targetIds: [enemy.instanceId, necromancer.instanceId] }];
    expect(resolveChain(missingSecondTarget).players[1].pawnZones[0]?.card.atk).toBe(140);
    game = resolveChain(addChainLink(game, ghostChoice, 'switch'));
    expect(game.players[1].pawnZones[0]?.card.atk).toBe(140);
    expect(game.players[0].pawnZones[1]?.card.atk).toBe(145 + game.players[1].pawnZones[0]!.card.atk);
    game.currentPhase = Phase.END;
    game = advancePhaseState(game);
    expect(game.players[0].pawnZones[1]?.card.atk).toBe(145);

    game = state();
    game.currentPhase = Phase.BATTLE;
    const grub = card('pawn_13', 1);
    game.players[1].pawnZones[0] = placed(grub, Position.HIDDEN);
    game.players[1].hand = [card('pawn_01', 1)];
    game.players[1].deck = [card('pawn_02', 1)];
    game.players[0].pawnZones[0] = placed(card('pawn_01'));
    game = resolveCombat(game, 0, 0);
    expect(game.pendingSwitches?.[0].playerIndex).toBe(1);
    expect(game.players[1].pawnZones[0]?.position).toBe(Position.DEFENSE);
    game = resolveChain(addChainLink(game, effectChoices(game, grub, 'switch')[0], 'switch'));
    expect(game.players[1].discard).toHaveLength(1);
    expect(game.players[1].hand).toHaveLength(1);
    expect(game.players[1].activatedHardOncePerTurns).toContain('pawn_13');

    game = state();
    game.currentPhase = Phase.BATTLE;
    const revivedGrub = card('pawn_13', 1);
    game.players[0].pawnZones[0] = placed(card('pawn_14'));
    game.players[1].pawnZones[0] = placed(revivedGrub, Position.HIDDEN);
    game.players[1].hand = [card('pawn_01', 1)];
    game.players[1].deck = [card('pawn_02', 1)];
    game = resolveCombat(game, 0, 0);
    expect(game.pendingSwitches?.[0].playerIndex).toBe(1);
    expect(game.players[0].pawnZones.some(z => z?.card.instanceId === revivedGrub.instanceId)).toBe(true);
    const revivedChoice = effectChoices(game, revivedGrub, 'switch')[0];
    expect(revivedChoice.playerIndex).toBe(1);
    game = resolveChain(addChainLink(game, revivedChoice, 'switch'));
    expect(game.players[1].discard).toHaveLength(1);
    expect(game.players[0].hand).toHaveLength(0);

    game = state();
    game.currentPhase = Phase.BATTLE;
    const stolen = card('pawn_01', 1);
    const attacker = card('pawn_14');
    game.players[0].pawnZones[0] = placed(attacker);
    game.players[1].pawnZones[0] = placed(stolen, Position.DEFENSE);
    game.response = { priority: 1, passes: 2, reason: 'battle', ready: true };
    game.deferredAction = { kind: 'attack', attackerId: attacker.instanceId, targetId: stolen.instanceId };
    const battle = applySystemCommand(game, { type: 'completeDeferred' });
    expect(battle.events).toMatchObject([{ type: 'destroyed', playerIndex: 1, index: 0, card: stolen }]);
    game = battle.state;
    expect(game.players[0].pawnZones.some(z => z?.card.instanceId === stolen.instanceId)).toBe(true);
    expect(game.players[1].discard).toHaveLength(0);
    game.currentPhase = Phase.END;
    game = advancePhaseState(game);
    expect(game.players[0].pawnZones.some(z => z?.card.instanceId === stolen.instanceId)).toBe(false);
    expect(game.players[1].discard.some(c => c.instanceId === stolen.instanceId)).toBe(true);

    game = state();
    game.players[0].pawnZones[0] = placed(stolen);
    Effect.BanishTargetToVoid()(game, { card: necromancer, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } });
    expect(game.players[1].void.some(c => c.instanceId === stolen.instanceId)).toBe(true);
});
