import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { addChainLink, effectChoices, fieldActivations, passPriority, resolveChain, runEffect } from '../src/game/chains';
import { checkVictory } from '../src/game/finishEffect';
import { destroyFieldCard } from '../src/game/attachments';
import { sendToOwnerPile } from '../src/game/cardOwnership';
import { applyCommand, applySystemCommand } from '../src/game/engine';
import { resolveCombat } from '../src/game/combat';
import { fieldStats, canTribute, canTributeForSummon } from '../src/game/cardHelpers';
import { advancePhaseState } from '../src/game/phases';
import { Effect } from '../src/cards/engine/Effects';
import { Cost } from '../src/cards/engine/Costs';
import { buildEffect } from '../src/cards/engine/Builder';
import { Attribute, Card, CardType, GameState, Phase, Player, Position } from '../src/types';

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

it('shuffle costs, attack negation and summon reactions share the engine selection path', () => {
    // Named groups, exact-name recovery, independent limits and restricted tributes.
    {
        const game = state();
        const arms = card('action_call_to_arms');
        const infantry = card('pawn_infantry_soldier');
        const high = card('pawn_soldier_of_the_high_ground');
        game.players[0].actionZones[0] = placed(arms, Position.FACE_UP);
        game.players[0].pawnZones[0] = placed(infantry);
        game.players[0].hand = [high];
        game.players[0].deck = [card('pawn_soldier_of_the_high_ground'), { ...card('pawn_01'), name: 'The world of a Man and a Dog' }];
        const summoned = runEffect(game, { card: arms, playerIndex: 0, effectId: 'summon', handIndex: 0, pawnPlacement: { slot: 1, position: Position.ATTACK } }, 'field_activate');
        expect(summoned.newState.players[0].pawnZones[1]?.card).toEqual(high);
        expect(effectChoices(summoned.newState, arms, 'field_activate')).toEqual([]);
        const battle = { ...summoned.newState, currentPhase: Phase.BATTLE };
        const attacked = resolveCombat(battle, 0, 'direct');
        const main = { ...attacked, currentPhase: Phase.MAIN2 };
        const search = effectChoices(main, arms, 'field_activate');
        expect(search.map(choice => choice.effectId)).toEqual(['search']);
        const searched = runEffect(main, search[0], 'field_activate').newState;
        expect(searched.players[0].hand[0].name).toBe('Soldier of the High Ground');
        expect(effectChoices(searched, arms, 'field_activate')).toEqual([]);
        const destroy = effectChoices(game, high, 'activate');
        expect(destroy).toEqual([]); // The hand copy has no field effect.
        const removed = runEffect(main, { card: high, playerIndex: 0, target: { playerIndex: 0, type: 'action', index: 0 } }, 'activate').newState;
        expect(removed.players[0].actionZones[0]).toBeNull();
        expect(effectChoices(removed, high, 'activate')).toEqual([]);
        expect(canTributeForSummon(infantry, high)).toBe(true);
        expect(canTributeForSummon({ ...infantry, name: 'A Solider' }, high)).toBe(false);
        const invalid = state();
        invalid.players[0].hand = [high];
        invalid.players[0].pawnZones[0] = placed(card('pawn_01'));
        expect(applyCommand(invalid, 0, { type: 'summon', cardId: high.instanceId, slot: 0, hidden: false, tributes: [0] }).state).toBe(invalid);
        const recovery = state();
        recovery.players[0].pawnZones[0] = placed(high);
        recovery.players[0].discard = [infantry, { ...card('pawn_infantry_soldier'), name: 'Elite Infantry Soldier' }];
        destroyFieldCard(recovery, high.instanceId);
        expect(recovery.pendingReactions).toContainEqual({ card: high, playerIndex: 0, trigger: 'destroyed' });
        expect(effectChoices(recovery, high, 'destroyed').map(choice => choice.discardIndex)).toEqual([0]);
        const recovered = runEffect(recovery, { card: high, playerIndex: 0, discardIndex: 0 }, 'destroyed').newState;
        expect(recovered.players[0].hand).toContainEqual(infantry);
        const combat = state();
        combat.currentPhase = Phase.BATTLE;
        combat.players[0].pawnZones[0] = placed({ ...card('pawn_01'), atk: 250 });
        combat.players[1].pawnZones[0] = placed(card('pawn_soldier_of_the_high_ground', 1));
        expect(resolveCombat(combat, 0, 0).pendingReactions?.[0].trigger).toBe('destroyed');
    }

    const restrictions = state();
    const dragon = card('pawn_everlasting_dragonlord');
    const containment = card('condition_09');
    const victim = card('pawn_01');
    restrictions.players[0].pawnZones[0] = placed(dragon);
    restrictions.players[0].pawnZones[1] = placed(victim);
    restrictions.players[0].actionZones[0] = placed(containment, Position.HIDDEN);
    const trapped = resolveChain(addChainLink(restrictions, {
        card: containment, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 1 }
    }, 'activate'));
    expect(trapped.players[0].actionZones[0]?.attachedToInstanceIds).toEqual([victim.instanceId]);
    const hiddenTarget = structuredClone(restrictions);
    hiddenTarget.players[0].pawnZones[1]!.position = Position.HIDDEN;
    const hiddenTrapped = resolveChain(addChainLink(hiddenTarget, { card: containment, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 1 } }, 'activate'));
    expect(canTribute(hiddenTrapped.players[0].pawnZones[1]!.card)).toBe(false);
    expect(hiddenTrapped.players[0].actionZones[0]).toBeNull();
    expect(canTribute(trapped.players[0].pawnZones[1]!.card)).toBe(false);
    expect(Cost.TributePawns(1)(trapped, { card: dragon, playerIndex: 0, tributeIndices: [1] })).toMatchObject({ halt: true });
    const king = { ...card('pawn_01'), level: 6 as const };
    trapped.players[0].hand = [king];
    expect(applyCommand(trapped, 0, { type: 'summon', cardId: king.instanceId, hidden: false, slot: 1, tributes: [1] }).state).toBe(trapped);
    const dragonAnnounced = addChainLink(trapped, { card: dragon, playerIndex: 0 }, 'activate');
    expect(dragonAnnounced.players[0].pawnZones[0]?.card.effectTargetBlockedThisTurn).toBeUndefined();
    let protectedGame = resolveChain(dragonAnnounced);
    expect(effectChoices(protectedGame, dragon, 'activate')).toHaveLength(0);
    expect(effectChoices(protectedGame, containment, 'activate').some(choice => choice.target?.index === 0)).toBe(false);
    expect(runEffect(protectedGame, { card: containment, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, 'activate').halted).toBe(true);
    // Protection stops new targeting, but does not cancel a target selected earlier.
    expect(runEffect(protectedGame, { card: containment, playerIndex: 0, execution: 'resolve', target: { playerIndex: 0, type: 'pawn', index: 0 } }, 'activate').halted).not.toBe(true);
    const leaving = structuredClone(protectedGame);
    sendToOwnerPile(leaving, leaving.players[0].pawnZones[0]!.card, 'discard');
    expect(leaving.players[0].discard.at(-1)?.effectTargetBlockedThisTurn).toBeUndefined();
    protectedGame.currentPhase = Phase.END;
    protectedGame = advancePhaseState(protectedGame);
    expect(canTribute(protectedGame.players[0].pawnZones[1]!.card)).toBe(true);
    expect(protectedGame.players[0].pawnZones[0]?.card.effectTargetBlockedThisTurn).toBeUndefined();
    expect(effectChoices(protectedGame, dragon, 'activate')).toHaveLength(0);
    protectedGame.currentPhase = Phase.END;
    protectedGame = advancePhaseState(protectedGame);
    expect(effectChoices(protectedGame, dragon, 'activate')).toHaveLength(1);
    const turnados = card('pawn_15');
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
    expect(paid.players[0].pawnZones[0]?.card.instanceId).toBe(game.players[0].pawnZones[0]?.card.instanceId);
    expect(paid.players[0].discard).toHaveLength(0);
    expect(counterCount(paid.players[0].actionZones[0])).toBe(0);
    const movedTribute = structuredClone(paid);
    movedTribute.players[0].pawnZones[3] = movedTribute.players[0].pawnZones[0];
    movedTribute.players[0].pawnZones[0] = placed(low);
    const movedResolved = resolveChain(movedTribute);
    expect(movedResolved.players[0].pawnZones[0]?.card.instanceId).toBe(low.instanceId);
    expect(movedResolved.players[0].pawnZones[3]).toBeNull();
    expect(counterCount(movedResolved.players[0].actionZones[0])).toBe(1);
    const missingTribute = structuredClone(paid);
    missingTribute.players[0].pawnZones[0] = placed(low);
    const missingResolved = resolveChain(missingTribute);
    expect(missingResolved.players[0].pawnZones[0]?.card.instanceId).toBe(low.instanceId);
    expect(missingResolved.players[0].discard).toHaveLength(0);
    expect(counterCount(missingResolved.players[0].actionZones[0])).toBe(0);
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

it('battle reactions and controlled cards respect identity and ownership', () => {
    let game = state();
    const ghost = card('pawn_12');
    const necromancer = card('pawn_14');
    const enemy = card('pawn_02', 1);
    game.players[0].pawnZones[0] = placed(ghost, Position.HIDDEN);
    game.players[0].pawnZones[1] = placed(necromancer);
    game.players[1].pawnZones[0] = placed(enemy);
    game = applyCommand(game, 0, { type: 'position', index: 0 }).state;
    expect(game.pendingReactions?.[0].card.instanceId).toBe(ghost.instanceId);
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

    // Cost-triggered effects cannot change the ongoing battle, even for a quick effect.
    cardRegistry.register({ ...cardRegistry.getCard('pawn_01')!, id: 'test_quick_discard', name: 'Quick discard' }, {
        timing: 'quick', onActivate: buildEffect([Cost.DiscardCardFilter(), Effect.DrawCards(1)])
    });
    for (const timing of ['battle-switch', 'attack-response', 'main-switch'] as const) {
        game = state();
        const defender = card('pawn_13', 1);
        const guard = card('pawn_10', 1);
        const survivor = card('test_quick_discard', 1);
        const attacker = card('pawn_14');
        game.currentPhase = timing === 'main-switch' ? Phase.MAIN1 : Phase.BATTLE;
        game.players[0].pawnZones[0] = placed(attacker);
        game.players[1].pawnZones[0] = placed(defender, Position.HIDDEN);
        game.players[1].pawnZones[1] = placed(survivor);
        game.players[1].hand = [guard];
        game.players[1].deck = [card('pawn_02', 1)];
        if (timing === 'battle-switch') game = resolveCombat(game, 0, 0);
        else if (timing === 'main-switch') {
            game.players[1].pawnZones[0]!.position = Position.DEFENSE;
            game.pendingReactions = [{ card: defender, playerIndex: 1, trigger: 'switch' }];
        } else game = applyCommand(game, 0, { type: 'attack', attackerIndex: 0, targetIndex: 0 }).state;
        const source = timing === 'attack-response' ? survivor : defender;
        const trigger = timing === 'attack-response' ? 'activate' : 'switch';
        let paid = addChainLink(game, { card: source, playerIndex: 1, handIndex: 0 }, trigger);
        expect(paid.players[1].hand.map(c => c.instanceId)).toContain(guard.instanceId);
        expect(paid.players[1].pawnZones[1]?.card.def).toBe(survivor.def);
        expect(paid.pendingTriggers?.filter(entry => entry.trigger === 'discard') ?? []).toHaveLength(0);
        paid = resolveChain(paid);
        if (timing === 'attack-response') {
            expect(paid.players[1].pawnZones[0]?.card.def).toBe(defender.def);
            expect(paid.pendingTriggers).toHaveLength(1);
            // Decline post-chain and battle-step windows before completing combat.
            for (let i = 0; i < 8 && paid.deferredAction; i++) paid = paid.response && !paid.response.ready
                ? passPriority(paid) : applySystemCommand(paid, { type: 'completeDeferred' }).state;
            expect(paid.players[1].discard.some(card => card.instanceId === defender.instanceId)).toBe(true);
            // The battle-revealed Pawn gets its choice before queued mandatory effects.
            for (const reaction of paid.pendingReactions ?? []) paid = applyCommand(paid, reaction.playerIndex,
                { type: 'cancelEffect', cardId: reaction.card.instanceId }).state;
            paid = resolveChain(paid);
        }
        expect(paid.players[1].pawnZones[1]?.card.def).toBe(survivor.def + 200);
        expect(paid.players[1].pawnZones[1]?.position).toBe(Position.DEFENSE);
        expect(paid.pendingTriggers).toEqual([]);
        if (timing !== 'main-switch') {
            expect(paid.players[1].pawnZones[0]).toBeNull();
            expect(paid.players[0].pawnZones[1]?.card).toMatchObject({ instanceId: defender.instanceId, def: defender.def });
        } else expect(paid.players[1].pawnZones[0]?.card.def).toBe(defender.def + 200);
    }

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
    expect(game.players[1].discard.some(c => c.instanceId === stolen.instanceId)).toBe(true);
    game = resolveChain(game);
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

    game = state();
    game.currentPhase = Phase.BATTLE;
    // Battle departures share the optional reaction and selection path with Switch effects.
    cardRegistry.register({ ...cardRegistry.getCard('pawn_cockroach_knight')!, id: 'test_battle_recruiter' },
        cardRegistry.getEffect('pawn_cockroach_knight')!);
    for (const sourceId of ['test_battle_recruiter']) {
        for (const battleMode of ['defending', 'hidden', 'attacking', 'tie', 'borrowed'] as const) {
            const duel = state();
            duel.currentPhase = Phase.BATTLE;
            const owner = battleMode === 'attacking' || battleMode === 'tie' ? 0 : 1;
            const controller = battleMode === 'borrowed' ? 0 : owner;
            const knight = card(sourceId, owner);
            const recruit = { ...card('pawn_01', owner), attribute: Attribute.EARTH, atk: 100 };
            const weak = { ...card('pawn_01', owner), attribute: Attribute.EARTH, atk: 0 };
            const wrongAttribute = { ...recruit, instanceId: 'wrong-attribute', attribute: Attribute.FIRE };
            const tooStrong = { ...recruit, instanceId: 'too-strong', atk: 101 };
            const action = { ...recruit, instanceId: 'wrong-type', type: CardType.ACTION };
            duel.players[owner].deck = [wrongAttribute, tooStrong, action, recruit, weak];
            duel.players[controller].pawnZones[0] = placed(knight, battleMode === 'hidden' ? Position.HIDDEN : Position.ATTACK);
            duel.players[1 - controller].pawnZones[0] = placed({
                ...card('pawn_01', 1 - controller), atk: battleMode === 'tie' ? 100 : 150
            });
            duel.activePlayerIndex = battleMode === 'borrowed' ? 1 : 0;
            const destroyed = resolveCombat(duel, 0, 0);
            expect(destroyed.players[owner].discard.some(value => value.instanceId === knight.instanceId)).toBe(true);
            expect(destroyed.pendingReactions).toContainEqual({ card: knight, playerIndex: owner, trigger: 'battle_destroyed' });
            const choices = effectChoices(destroyed, knight, 'battle_destroyed');
            expect(choices).toHaveLength(destroyed.players[owner].pawnZones.filter(zone => !zone).length * 2);
            expect(choices.every(choice => choice.playerIndex === owner && choice.pawnPlacement?.position === Position.ATTACK
                && [3, 4].includes(choice.deckIndex!))).toBe(true);
            expect(applyCommand(destroyed, owner, { type: 'attack', attackerIndex: 0, targetIndex: 'direct' }).state).toBe(destroyed);
            const choice = choices.find(value => value.deckIndex === 3 && value.pawnPlacement?.slot === 2)!;
            expect(applyCommand(destroyed, owner, { type: 'activate', context: {
                ...choice, pawnPlacement: { slot: 2, position: Position.DEFENSE }
            }, trigger: 'battle_destroyed' }).state).toBe(destroyed);
            const queued = applyCommand(destroyed, owner, { type: 'activate', context: choice, trigger: 'battle_destroyed' }).state;
            expect(queued.pendingReactions).toEqual([]);
            queued.players[owner].deck.reverse();
            const summoned = resolveChain(queued);
            expect(summoned.players[owner].pawnZones[2]).toMatchObject({
                card: { instanceId: recruit.instanceId }, position: Position.ATTACK, summonedTurn: duel.turnNumber
            });
            expect(summoned.players[owner].deck).toHaveLength(4);
            expect(summoned.players[owner].normalSummonUsed).toBe(false);
            const decline = applyCommand(destroyed, owner, { type: 'cancelEffect', cardId: knight.instanceId }).state;
            expect(decline.pendingReactions).toEqual([]);
            expect(decline.players[owner].deck).toHaveLength(5);
            expect(applyCommand(destroyed, 1 - owner, { type: 'cancelEffect', cardId: knight.instanceId }).state).toBe(destroyed);
            const emptyDeck = structuredClone(destroyed);
            emptyDeck.players[owner].deck = [];
            expect(effectChoices(emptyDeck, knight, 'battle_destroyed')).toEqual([]);
            const fullField = structuredClone(destroyed);
            fullField.players[owner].pawnZones.fill(placed(recruit));
            expect(effectChoices(fullField, knight, 'battle_destroyed')).toEqual([]);
            for (const interruption of ['removed', 'occupied'] as const) {
                const interrupted = structuredClone(queued);
                if (interruption === 'removed') interrupted.players[owner].deck = [];
                else interrupted.players[owner].pawnZones[2] = placed(weak);
                expect(resolveChain(interrupted).players[owner].pawnZones[2]?.card.instanceId).not.toBe(recruit.instanceId);
            }
        }
    }
    const nonBattle = state();
    const knight = card('pawn_cockroach_knight');
    nonBattle.players[0].pawnZones[0] = placed(knight);
    Effect.DestroyTarget()(nonBattle, { card: knight, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } });
    expect(nonBattle.pendingReactions).toBeUndefined();
    // A second card can supply a continuous ATK/DEF rule without shared-code changes.
    cardRegistry.register({ ...cardRegistry.getCard('pawn_01')!, id: 'test_field_stat_modifier', name: 'Test Field Modifier' }, {
        fieldStatModifier: current => ({ atk: current.players[0].pawnZones[1] ? 70 : 0, def: 25 })
    });
    game = state();
    const adaptive = placed(card('test_field_stat_modifier'));
    game.players[0].pawnZones[0] = adaptive;
    expect(fieldStats(game, adaptive)).toEqual({ atk: adaptive.card.atk, def: adaptive.card.def + 25 });
    game.players[0].pawnZones[1] = placed(card('pawn_01'));
    expect(fieldStats(game, adaptive)).toEqual({ atk: adaptive.card.atk + 70, def: adaptive.card.def + 25 });
    game.currentPhase = Phase.BATTLE;
    game.players[1].pawnZones[0] = placed(card('pawn_01', 1));
    expect(resolveCombat(game, 0, 0).players[1].lp).toBe(730);
});
