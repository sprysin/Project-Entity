import { activeLand, fieldEntries } from '../src/game/field';
import { destroyFieldCard } from '../src/game/attachments';
import { Require } from '../src/cards/engine/Requirements';
import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { addChainLink, effectChoices, fieldActivations, resolveChain, runEffect } from '../src/game/chains';
import { applyCommand, applySystemCommand, canPlayCard } from '../src/game/engine';
import { fieldStats } from '../src/game/cardHelpers';
import { advancePhaseState } from '../src/game/phases';
import { Effect } from '../src/cards/engine/Effects';
import { buildEffect } from '../src/cards/engine/Builder';
import { Attribute, Card, GameState, PawnType, Phase, Player, Position } from '../src/types';

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
    reserve: [],
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
it('negates an announced attack without refunding the attack or its discard cost', () => {
    const attackGame = state();
    attackGame.currentPhase = Phase.BATTLE;
    const attacker = card('P_Solstice_Sentinel');
    const escape = card('C_Escape_Plan', 1);
    const discarded = card('P_Force_Fire_Sparker', 1);
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
});

it('counter activations preserve material identity, fizzle safely, and limit each source separately', () => {
    const counterCount = (zone: GameState['players'][number]['actionZones'][number]) => zone?.counters?.['Tribute Counters'] ?? 0;
    let game = state();
    const tribunal = card('A_Tribute_Tribunal');
    const second = card('A_Tribute_Tribunal');
    const low = { ...card('P_Solstice_Sentinel'), level: 4 as const };
    const one = { ...card('P_Solstice_Sentinel'), level: 5 as const };
    const two = { ...card('P_Solstice_Sentinel'), level: 8 as const };
    game.players[0].actionZones[0] = placed(tribunal, Position.FACE_UP);
    game.players[0].actionZones[1] = placed(second, Position.FACE_UP);
    expect(fieldActivations(game, 0)).toEqual([]);
    expect(runEffect(game, { card: tribunal, playerIndex: 0 }, 'field_activate').halted).toBe(true);
    game.players[0].hand = [low, one, two];
    game.players[0].pawnZones[0] = placed(card('P_Solstice_Sentinel'));
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
    queuedSummon.players[0].hand.reverse();
    game = resolveChain(queuedSummon);
    expect(game.players[0].pawnZones[3]).toMatchObject({ card: { instanceId: one.instanceId }, position: Position.DEFENSE });
    expect(game.players[0].normalSummonUsed).toBe(false);
    expect(counterCount(game.players[0].actionZones[0])).toBe(2);
    expect(effectChoices(game, tribunal, 'field_activate')).toEqual([]);
    expect(effectChoices(game, second, 'field_activate').some(choice => choice.effectId === 'tribute')).toBe(true);
});

it('special summons validate placement and returned cards respect their source pile', () => {
    for (const location of ['hand', 'deck', 'reserve'] as const) {
        const duel = state(), contract = card('C_Signal_Routing'), pawn = card('P_High_Stream_Absolute_Router');
        const player = duel.players[0];
        const candidate = location === 'reserve' ? pawn : card('P_Solstice_Sentinel');
        player[location] = [candidate];
        player.pawnZones[0] = placed(card('P_Solstice_Sentinel'));
        const step = location === 'reserve' ? Effect.SummonFromReserve(pawn.pawnSubtype!, () => true)
            : location === 'deck' ? Effect.SpecialSummonFromDeck(() => true) : Effect.SpecialSummonFromHand(() => true);
        const context = { card: contract, playerIndex: 0, handIndex: 0, deckIndex: 0, reserveIndex: 0 };
        const summon = buildEffect([step]);
        for (const slot of [-1, 0, 0.5, 5]) expect(summon(duel, { ...context, pawnPlacement: { slot, position: Position.ATTACK } }).newState).toBe(duel);
        expect(summon(duel, { ...context, pawnPlacement: { slot: 1, position: Position.HIDDEN } }).newState).toBe(duel);
        const result = summon(duel, { ...context, pawnPlacement: { slot: 1, position: Position.DEFENSE } }).newState;
        expect(result.players[0].pawnZones[1]).toMatchObject({ card: candidate, position: Position.DEFENSE, specialSummoned: true });
        for (const destination of ['hand', 'deck'] as const) {
            const step = destination === 'hand' ? Effect.ReturnTargetToHand() : Effect.ShuffleFrom('field', 1);
            const returned = buildEffect([step])(result, { ...context,
                target: { playerIndex: 0, type: 'pawn', index: 1 }, shuffleCardIds: [candidate.instanceId] }).newState;
            expect(returned.players[0].pawnZones[1]).toBeNull();
            expect(returned.players[0]).toMatchObject({ hand: [], deck: [], reserve: [], [location === 'reserve' ? 'reserve' : destination]: [candidate] });
        }
        if (location === 'hand') expect(buildEffect([Effect.SpecialSummonFromHand(() => true, Position.HIDDEN)])(duel,
            { ...context, pawnPlacement: { slot: 1, position: Position.HIDDEN } }).newState.players[0].pawnZones[1]?.isSetTurn).toBe(true);
    }
});

it('revival selects converted Discard identities after costs while keeping previews reversible', () => {
    const game = state();
    const source = card('C_What_Grows_In_The_Graveyard');
    const payment = card('P_Tomaterror');
    const undead = card('P_Zombie_Necromancer');
    game.players[0].actionZones[0] = placed(source, Position.HIDDEN);
    game.players[0].hand = [payment];
    game.players[0].discard = [undead];
    const preview = runEffect(game, { card: source, playerIndex: 0, handIndex: 0 }, 'activate');
    expect(preview.requireDiscardSelection?.cards?.[0]).toMatchObject({ instanceId: undead.instanceId, pawnType: PawnType.PLANT });
    expect(game.players[0].discard[0].pawnType).toBe(PawnType.UNDEAD);
    expect(game.players[0].hand).toEqual([payment]);
    const choice = effectChoices(game, source, 'activate').find(context => context.pawnPlacement?.slot === 2)!;
    expect(choice.discardCardIds).toEqual([undead.instanceId]);
    const result = resolveChain(addChainLink(game, choice, 'activate'));
    expect(result.players[0].void.map(card => card.instanceId)).toEqual([payment.instanceId]);
    expect(result.players[0].discard).toEqual([]);
    expect(result.players[0].pawnZones[2]?.card).toMatchObject({ instanceId: undead.instanceId, pawnType: PawnType.PLANT });
    expect(result.players[0].actionZones[0]?.attachedToInstanceIds).toEqual([undead.instanceId]);
});

it('battle revival returns a controlled card to its owner when temporary control expires', () => {
    let game = state();
    game.currentPhase = Phase.BATTLE;
    const stolen = card('P_Solstice_Sentinel', 1);
    const attacker = card('P_Zombie_Necromancer');
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
});

it('shares a face-up Land stack, suspends covered effects, and preserves identity and Once usage', () => {
    const law = card('A_On_Common_Ground');
    const cover = card('A_Shrouded_Kingdom', 1);
    let game = state();
    const normal = card('P_Solstice_Sentinel'); normal.attribute = Attribute.NORMAL;
    game.players[0].pawnZones[0] = placed(normal);
    const other = { ...normal, instanceId: 'opposing-normal', ownerId: 'player2' };
    game.players[1].pawnZones[0] = placed(other);
    game.players[0].pawnZones[1] = placed({ ...normal, instanceId: 'fire', attribute: Attribute.FIRE });
    game.players[0].pawnZones[2] = placed({ ...normal, instanceId: 'hidden' }, Position.HIDDEN);
    game.players[0].hand = [law];
    game.players[0].actionZones = Array.from({ length: 5 }, () => placed(card('A_Void_Blast'), Position.FACE_UP));
    expect(canPlayCard(game, law)).toBe(true);
    expect(applyCommand(game, 0, { type: 'play', cardId: law.instanceId, set: true, slot: 0 }).state).toBe(game);
    game = applyCommand(game, 0, { type: 'play', cardId: law.instanceId, set: false, slot: -1 }).state;
    expect(activeLand(game)).toMatchObject({ card: law, position: Position.FACE_UP });
    expect(game.players[0].actionZones.filter(Boolean)).toHaveLength(5);
    expect(fieldStats(game, game.players[0].pawnZones[0]!).atk).toBe(normal.atk + 20);
    expect(fieldStats(game, game.players[1].pawnZones[0]!).atk).toBe(normal.atk);
    expect(fieldStats(game, game.players[0].pawnZones[1]!).atk).toBe(normal.atk);
    expect(fieldStats(game, game.players[0].pawnZones[2]!).atk).toBe(normal.atk);
    expect(fieldActivations(game, 1).some(a => a.card.instanceId === law.instanceId)).toBe(false);
    expect(effectChoices(game, law, 'field_activate').map(c => c.target)).toEqual([
        { playerIndex: 0, type: 'pawn', index: 0 }
    ]);
    // Either turn player may use the same owner-0 Land; reserve Once at announcement.
    for (const actor of [0, 1]) {
        const turn = structuredClone(game);
        turn.activePlayerIndex = actor;
        turn.players[actor].pawnZones[0]!.card.atk += 90;
        expect(fieldStats(turn, turn.players[actor].pawnZones[0]!).atk).toBe(normal.atk + 110);
        const activation = fieldActivations(turn, actor).find(a => a.slot.type === 'land')!;
        expect(activation.card.instanceId).toBe(law.instanceId);
        expect(fieldActivations({ ...turn, currentPhase: Phase.BATTLE }, actor).some(a => a.slot.type === 'land')).toBe(false);
        const context = effectChoices(turn, law, 'field_activate').find(c => c.target?.playerIndex === actor && c.target.index === 0)!;
        expect(context.playerIndex).toBe(actor);
        expect(applyCommand(turn, 1 - actor, { type: 'activate', context: { ...context, playerIndex: 1 - actor }, trigger: 'field_activate' }).state).toBe(turn);
        const queued = applyCommand(turn, actor, { type: 'activate', context, trigger: 'field_activate' }).state;
        expect(activeLand(queued)?.hasUsedWhileOnField).toBe(true);
        const resolved = resolveChain(queued);
        expect(fieldStats(resolved, resolved.players[actor].pawnZones[0]!).atk).toBe(cardRegistry.getCard(normal.id)!.atk);
        resolved.players[actor].pawnZones[0]!.card.atk += 50;
        expect(fieldStats(resolved, resolved.players[actor].pawnZones[0]!).atk).toBe(cardRegistry.getCard(normal.id)!.atk);
        resolved.currentPhase = Phase.END;
        const nextTurn = advancePhaseState(resolved);
        expect(fieldStats(nextTurn, nextTurn.players[actor].pawnZones[0]!).atk).toBe(normal.atk + 140);
        expect(fieldStats(nextTurn, nextTurn.players[1 - actor].pawnZones[0]!).atk).toBe(normal.atk + 20);
        nextTurn.currentPhase = Phase.MAIN1;
        expect(fieldActivations(nextTurn, 1 - actor).some(a => a.slot.type === 'land')).toBe(false);
    }
    game.players[0].hand = [cover];
    game = applyCommand(game, 0, { type: 'play', cardId: cover.instanceId, set: false, slot: 0 }).state;
    expect(game.landStack?.map(z => z.card.instanceId)).toEqual([law.instanceId, cover.instanceId]);
    expect(fieldStats(game, game.players[0].pawnZones[0]!).atk).toBe(normal.atk);
    expect(runEffect(game, { card: law, playerIndex: 0 }, 'field_activate').halted).toBe(true);
    const duplicate = { ...law, instanceId: 'duplicate', ownerId: 'player2' };
    for (const actor of [0, 1]) {
        game.activePlayerIndex = actor;
        game.players[actor].hand = [duplicate];
        expect(canPlayCard(game, duplicate)).toBe(false);
        expect(applyCommand(game, actor, { type: 'play', cardId: duplicate.instanceId, set: false, slot: 0 }).state).toBe(game);
    }
    // Same name with a different definition ID is also a duplicate.
    expect(canPlayCard(game, { ...duplicate, id: 'alternate-printing' })).toBe(false);
    destroyFieldCard(game, law.instanceId);
    expect(game.landStack).toHaveLength(2);
    const remover = card('A_Void_Blast', 1);
    const removal = buildEffect([Require.Target('action'), Effect.DestroyTarget()]);
    const target = { playerIndex: 1, type: 'land' as const, index: 0 };
    const removed = removal(game, { card: remover, playerIndex: 1, target }).newState;
    expect(activeLand(removed)?.card.instanceId).toBe(law.instanceId);
    expect(removed.players[1].discard.some(c => c.instanceId === cover.instanceId)).toBe(true);
    expect(fieldStats(removed, removed.players[1].pawnZones[0]!).atk).toBe(normal.atk + 20);
    expect(fieldEntries(removed).filter(e => e.target.type === 'land')).toHaveLength(1);
    // Void and generic field selection remove only the visible top card too.
    const banished = buildEffect([Require.Target('action'), Effect.BanishTargetToVoid()])(removed, { card: remover, playerIndex: 1, target }).newState;
    expect(banished.landStack).toEqual([]);
    expect(banished.players[0].void.some(c => c.instanceId === law.instanceId)).toBe(true);
    expect(canPlayCard(banished, duplicate)).toBe(true);
    const moved = buildEffect([Effect.randomSelection({ location: 'field', filter: c => c.instanceId === cover.instanceId }), Effect.MoveSelectedTo('hand')])(
        game, { card: remover, playerIndex: 1 }).newState;
    expect(moved.landStack?.map(z => z.card.instanceId)).toEqual([law.instanceId]);
    expect(moved.players[1].hand.some(c => c.instanceId === cover.instanceId)).toBe(true);
});
