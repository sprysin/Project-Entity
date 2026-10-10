import { activeLand, fieldEntries } from '../src/game/field';
import { destroyFieldCard } from '../src/game/attachments';
import { Require } from '../src/cards/engine/Requirements';
import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { addChainLink, effectChoices, fieldActivations, passPriority, queueEventResponses, resolveChain, runEffect } from '../src/game/chains';
import { checkVictory } from '../src/game/finishEffect';
import { sendToOwnerPile } from '../src/game/cardOwnership';
import { applyCommand, applySystemCommand, canPlayCard, createGame } from '../src/game/engine';
import { resolveCombat } from '../src/game/combat';
import { fieldStats } from '../src/game/cardHelpers';
import { chooseAIAction, observeGame } from '../src/game/opponentAI';
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

// The same behavior must work under an unrelated ID with no engine edits.
cardRegistry.register({ ...cardRegistry.getCard('C_Orcustrated_Frontline_Unit')!, id: 'test-summon-observer' }, cardRegistry.getEffect('C_Orcustrated_Frontline_Unit')!);
for (const sourceId of ['C_Orcustrated_Frontline_Unit', 'test-summon-observer']) {
    const tributeGame = state();
    const handSummon = card(sourceId, 1);
    const light = card('P_Solstice_Sentinel', 1);
    const king = card('P_High_King');
    tributeGame.players[0].pawnZones[0] = placed(card('P_Force_Fire_Sparker'));
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
    const invalid = card('P_Force_Fire_Sparker', 1);
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

it('counter cards track damage, phase timing, separate soft uses and interrupted activations', () => {
    const commander = card('P_Force_Fire_Sparkling_Commander');
    const madness = card('C_Conflicted_Mind_Madness');
    const target = card('A_Tribute_Tribunal', 1);
    let duel = state();
    duel.players[0].pawnZones[0] = placed(commander);
    duel.players[0].actionZones[0] = { ...placed(madness, Position.FACE_UP), attachedToInstanceIds: [target.instanceId] };
    duel.players[1].actionZones[0] = placed(target, Position.FACE_UP);
    duel.currentPhase = Phase.DRAW;
    duel = advancePhaseState(duel);
    expect(duel.players[1].lp).toBe(790);
    expect(duel.players[0].pawnZones[0]?.counters).toEqual({ 'Spark Counters': 1 });
    // Every phase outside Standby must decline, including repeated End maintenance.
    for (const phase of Object.values(Phase).filter(value => value !== Phase.STANDBY)) {
        expect(runEffect({ ...duel, currentPhase: phase }, { card: madness, playerIndex: 0 }, 'phase').halted).toBe(true);
    }
    Effect.DealDamage(0, 10)(duel, { card: target, playerIndex: 1 });
    expect(duel.players[0].pawnZones[0]?.counters?.['Spark Counters']).toBe(1);
    Effect.DealDamage(1, 10)(duel, { card: madness, playerIndex: 0 });
    expect(duel.players[0].pawnZones[0]?.counters?.['Spark Counters']).toBe(2);
    duel.players[0].pawnZones[0]!.counters = { 'Spark Counters': 5 };
    duel.currentPhase = Phase.END;
    duel.activePlayerIndex = 1;
    duel = runEffect(duel, { card: commander, playerIndex: 0 }, 'activate').newState;
    expect(duel.players[0].pawnZones[0]?.counters?.['Spark Counters']).toBe(5);
    expect(duel.players[0].skipNextDrawPhase).toBe(true);
    const beforePayout = duel;
    duel = resolveChain(addChainLink(duel, { card: commander, playerIndex: 0 }, 'phase'));
    expect(duel.players[1].lp).toBe(beforePayout.players[1].lp - 150);
    expect(duel.damageEvents?.slice(beforePayout.damageEvents?.length ?? 0).map(event => event.amount)).toEqual([150]);
    expect(duel.players[0].pawnZones[0]?.counters?.['Spark Counters'] ?? 0).toBe(0);
    for (let repeat = 0; repeat < 3; repeat++) {
        duel = queueEventResponses(beforePayout, duel);
        expect(duel.pendingTriggers ?? []).toEqual([]);
    }
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

it('Contracts tribute exact levels from hand and field, summon Reserve Vassals, and resolve Patron damage', () => {
    const contractId = 'A_Scripture_Of_Faith', patronId = 'P_Patron_Of_Judgement';
    // An unrelated Contract can use the same engine mechanic without shared-code branches.
    cardRegistry.register({ ...cardRegistry.getCard(contractId)!, id: 'test-alternate-contract' }, cardRegistry.getEffect(contractId)!);
    for (const owner of [0, 1]) for (const location of ['hand', 'field', 'mixed', 'full'] as const) {
        const duel = state();
        duel.activePlayerIndex = owner;
        const player = duel.players[owner];
        const contract = card(location === 'full' ? 'test-alternate-contract' : contractId, owner);
        const patron = card(patronId, owner);
        player.reserve = [patron];
        player.actionZones[0] = placed(contract, Position.FACE_UP);
        const materials = [card('P_Solstice_Sentinel', owner), card('P_High_King', owner)];
        materials[0].level = 4; materials[1].level = 6;
        if (location === 'hand') player.hand = materials;
        else if (location === 'field') player.pawnZones[0] = placed(materials[0]), player.pawnZones[1] = placed(materials[1]);
        else {
            player.hand = [materials[0]];
            player.pawnZones[2] = placed(materials[1]);
            if (location === 'full') for (const index of [0, 1, 3, 4]) player.pawnZones[index] = placed(card('P_Solstice_Sentinel', owner));
        }
        const context = effectChoices(duel, contract, 'activate').find(value => value.materialIds?.length === 2
            && materials.every(material => value.materialIds!.includes(material.instanceId)) && value.pawnPlacement?.slot === (location === 'full' ? 2 : 4))!;
        expect(context).toBeDefined();
        const announced = addChainLink(duel, context, 'activate');
        expect(announced.players[owner].discard).toEqual([]);
        const resolved = resolveChain(announced);
        expect(resolved.players[owner].reserve).toEqual([]);
        expect(resolved.players[owner].pawnZones[context.pawnPlacement!.slot]?.card.instanceId).toBe(patron.instanceId);
        expect(resolved.players[owner].discard.map(value => value.instanceId).sort()).toEqual([...materials, contract].map(value => value.instanceId).sort());
        expect(resolved.players[owner].discard.filter(value => value.tributedByAction)).toHaveLength(2);
        expect(resolved.players[owner].normalSummonUsed).toBe(false);
        expect(resolved.log[0]).toContain('Vassal summons');
        // Losing a cost card, its level, or its tribute eligibility fizzles without partial payment.
        for (const change of ['missing', 'level', 'blocked', 'reserve'] as const) {
            const interrupted = structuredClone(announced);
            const payer = interrupted.players[owner];
            const material = payer.hand.find(value => value.instanceId === materials[0].instanceId)
                ?? payer.pawnZones.find(value => value?.card.instanceId === materials[0].instanceId)!.card;
            if (change === 'missing') { payer.hand = payer.hand.filter(value => value.instanceId !== material.instanceId); payer.pawnZones = payer.pawnZones.map(value => value?.card.instanceId === material.instanceId ? null : value); }
            if (change === 'level') material.level = 3;
            if (change === 'blocked') material.cannotBeTributed = true;
            if (change === 'reserve') payer.reserve = [];
            const result = resolveChain(interrupted);
            expect(result.players[owner].pawnZones.some(value => value?.card.instanceId === patron.instanceId)).toBe(false);
            if (change !== 'reserve') expect(result.players[owner].discard).toHaveLength(1);
        }
    }
    let duel = state();
    const contract = card(contractId), patron = card(patronId);
    const level10 = card('P_High_Voltage_Charged_Dragon');
    duel.players[0].reserve = [patron]; duel.players[0].hand = [contract, level10];
    const ai = chooseAIAction(observeGame(duel, 0), 0);
    expect(ai.kind).toBe('effect');
    if (ai.kind === 'effect') expect(ai.context.materialIds).toEqual([level10.instanceId]);
    expect(observeGame(duel, 1).players[0].reserve[0].id).toBe('unknown');
    duel.players[0].hand = [patron];
    expect(canPlayCard(duel, patron)).toBe(false);
    for (const hidden of [false, true]) expect(applyCommand(duel, 0, { type: 'summon', cardId: patron.instanceId, hidden, slot: 0, tributes: [] }).state).toBe(duel);

    for (const targetOwner of [0, 1]) for (const bonus of [0, 40, 900]) {
        duel = state();
        duel.players[0].pawnZones[0] = placed(patron);
        const target = card('P_Solstice_Sentinel', targetOwner); target.atk += bonus;
        duel.players[targetOwner].pawnZones[1] = placed(target);
        const choices = effectChoices(duel, patron, 'activate');
        if (!bonus) { expect(choices).toEqual([]); continue; }
        const context = choices.find(value => value.target?.playerIndex === targetOwner)!;
        const announced = addChainLink(duel, context, 'activate');
        expect(effectChoices(announced, patron, 'activate')).toEqual([]);
        const result = resolveChain(announced);
        expect(result.players[targetOwner].pawnZones[1]).toBeNull();
        expect(result.players[0].lp).toBe(800 - bonus);
        if (bonus === 900) expect(result.winner).toBe('Player 2');
        const missing = structuredClone(announced); missing.players[targetOwner].pawnZones[1] = null;
        expect(resolveChain(missing).players[0].lp).toBe(800);
        const reverted = structuredClone(announced); reverted.players[targetOwner].pawnZones[1]!.card.atk -= bonus;
        expect(resolveChain(reverted).players[targetOwner].pawnZones[1]).not.toBeNull();
        expect(resolveChain(reverted).players[0].lp).toBe(800);
    }
    const created = createGame([{ id: 'player1', name: 'One', deck: Array.from({ length: 8 }, () => card('P_Solstice_Sentinel')), reserve: [patron] },
        { id: 'player2', name: 'Two', deck: Array.from({ length: 8 }, () => card('P_Solstice_Sentinel', 1)) }]);
    expect(created.players[0].hand).toHaveLength(5);
    expect(created.players[0].deck).toHaveLength(3);
    expect(created.players[0].reserve).toEqual([patron]);
});

it('Glass Witch destroys itself and privately reveals the opponent-selected hand card', () => {
    const game = state();
    const witch = card('P_Glass_Witch');
    const shown = card('A_Void_Blast', 1);
    const hidden = card('P_High_Voltage_Charged_Dragon', 1);
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
    expect(resolved.players[0].activatedHardOncePerTurns).toContain('P_Glass_Witch');
    const timing = state();
    timing.players[1].pawnZones[0] = placed(card('P_Glass_Witch', 1));
    timing.players[0].hand = [card('P_Solstice_Sentinel')];
    expect(effectChoices(timing, timing.players[1].pawnZones[0]!.card, 'activate')).toHaveLength(1);
    timing.currentPhase = Phase.BATTLE;
    expect(effectChoices(timing, timing.players[1].pawnZones[0]!.card, 'activate')).toHaveLength(0);
    timing.currentPhase = Phase.MAIN2;
    timing.players[1].activatedHardOncePerTurns.push('P_Glass_Witch');
    expect(effectChoices(timing, timing.players[1].pawnZones[0]!.card, 'activate')).toHaveLength(0);
});

it('battle reactions and controlled cards respect identity and ownership', () => {
    let game = state();
    const ghost = card('P_Curse_Giving_Ghost');
    const necromancer = card('P_Zombie_Necromancer');
    const enemy = card('P_High_King', 1);
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
    cardRegistry.register({ ...cardRegistry.getCard('P_Solstice_Sentinel')!, id: 'test_quick_discard', name: 'Quick discard' }, {
        timing: 'quick', onActivate: buildEffect([Cost.DiscardCardFilter(), Effect.DrawCards(1)])
    });
    for (const timing of ['battle-switch', 'attack-response', 'main-switch'] as const) {
        game = state();
        const defender = card('P_Glitter_Grub', 1);
        const guard = card('P_Glitter_Guard_Beatle', 1);
        const survivor = card('test_quick_discard', 1);
        const attacker = card('P_Zombie_Necromancer');
        game.currentPhase = timing === 'main-switch' ? Phase.MAIN1 : Phase.BATTLE;
        game.players[0].pawnZones[0] = placed(attacker);
        game.players[1].pawnZones[0] = placed(defender, Position.HIDDEN);
        game.players[1].pawnZones[1] = placed(survivor);
        game.players[1].hand = [guard];
        game.players[1].deck = [card('P_High_King', 1)];
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

    game = state();
    game.players[0].pawnZones[0] = placed(stolen);
    Effect.BanishTargetToVoid()(game, { card: necromancer, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } });
    expect(game.players[1].void.some(c => c.instanceId === stolen.instanceId)).toBe(true);

    game = state();
    game.currentPhase = Phase.BATTLE;
    // Battle departures share the optional reaction and selection path with Switch effects.
    cardRegistry.register({ ...cardRegistry.getCard('P_Cockroach_Knight')!, id: 'test_battle_recruiter' },
        cardRegistry.getEffect('P_Cockroach_Knight')!);
    for (const sourceId of ['test_battle_recruiter']) {
        for (const battleMode of ['defending', 'hidden', 'attacking', 'tie', 'borrowed'] as const) {
            const duel = state();
            duel.currentPhase = Phase.BATTLE;
            const owner = battleMode === 'attacking' || battleMode === 'tie' ? 0 : 1;
            const controller = battleMode === 'borrowed' ? 0 : owner;
            const knight = card(sourceId, owner);
            const recruit = { ...card('P_Solstice_Sentinel', owner), attribute: Attribute.EARTH, atk: 100 };
            const weak = { ...card('P_Solstice_Sentinel', owner), attribute: Attribute.EARTH, atk: 0 };
            const wrongAttribute = { ...recruit, instanceId: 'wrong-attribute', attribute: Attribute.FIRE };
            const tooStrong = { ...recruit, instanceId: 'too-strong', atk: 101 };
            const action = { ...recruit, instanceId: 'wrong-type', type: CardType.ACTION };
            duel.players[owner].deck = [wrongAttribute, tooStrong, action, recruit, weak];
            duel.players[controller].pawnZones[0] = placed(knight, battleMode === 'hidden' ? Position.HIDDEN : Position.ATTACK);
            duel.players[1 - controller].pawnZones[0] = placed({
                ...card('P_Solstice_Sentinel', 1 - controller), atk: battleMode === 'tie' ? 100 : 150
            });
            duel.activePlayerIndex = battleMode === 'borrowed' ? 1 : 0;
            const destroyed = resolveCombat(duel, 0, 0);
            expect(destroyed.players[owner].discard.some(value => value.instanceId === knight.instanceId)).toBe(true);
            expect(destroyed.pendingReactions).toContainEqual(expect.objectContaining({ card: knight, playerIndex: owner, trigger: 'battle_destroyed' }));
            const choices = effectChoices(destroyed, knight, 'battle_destroyed');
            expect(choices).toHaveLength(destroyed.players[owner].pawnZones.filter(zone => !zone).length * 2);
            expect(choices.every(choice => choice.playerIndex === owner && choice.pawnPlacement?.position === Position.ATTACK
                && [3, 4].includes(choice.deckIndex!))).toBe(true);
            expect(applyCommand(destroyed, owner, { type: 'attack', attackerIndex: 0, targetIndex: 'direct' }).state).toBe(destroyed);
            const choice = choices.find(value => value.deckIndex === 3 && value.pawnPlacement?.slot === 2)!;
            expect(applyCommand(destroyed, owner, {
                type: 'activate', context: {
                    ...choice, pawnPlacement: { slot: 2, position: Position.DEFENSE }
                }, trigger: 'battle_destroyed'
            }).state).toBe(destroyed);
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
    const knight = card('P_Cockroach_Knight');
    nonBattle.players[0].pawnZones[0] = placed(knight);
    Effect.DestroyTarget()(nonBattle, { card: knight, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } });
    expect(nonBattle.pendingReactions).toBeUndefined();
    // A second card can supply a continuous ATK/DEF rule without shared-code changes.
    cardRegistry.register({ ...cardRegistry.getCard('P_Solstice_Sentinel')!, id: 'test_field_stat_modifier', name: 'Test Field Modifier' }, {
        fieldStatModifier: current => ({ atk: current.players[0].pawnZones[1] ? 70 : 0, def: 25 })
    });
    game = state();
    const adaptive = placed(card('test_field_stat_modifier'));
    game.players[0].pawnZones[0] = adaptive;
    expect(fieldStats(game, adaptive)).toEqual({ atk: adaptive.card.atk, def: adaptive.card.def + 25 });
    game.players[0].pawnZones[1] = placed(card('P_Solstice_Sentinel'));
    expect(fieldStats(game, adaptive)).toEqual({ atk: adaptive.card.atk + 70, def: adaptive.card.def + 25 });
    game.currentPhase = Phase.BATTLE;
    game.players[1].pawnZones[0] = placed(card('P_Solstice_Sentinel', 1));
    expect(resolveCombat(game, 0, 0).players[1].lp).toBe(730);
});


it('shares a face-up Land stack, suspends covered effects, and preserves identity and Once usage', () => {
    const law = card('A_Law_Of_The_Normal');
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
    const unchanged = structuredClone(game);
    unchanged.players[0].pawnZones[0]!.card.attribute = Attribute.FIRE;
    expect(effectChoices(unchanged, law, 'field_activate')).toEqual([]);
    expect(fieldActivations(unchanged, 0).some(a => a.slot.type === 'land')).toBe(false);
    expect(applyCommand(unchanged, 0, { type: 'activate', trigger: 'field_activate', context: {
        card: law, playerIndex: 0, target: { playerIndex: 1, type: 'pawn', index: 0 }
    } }).state).toBe(unchanged);
    unchanged.players[1].pawnZones[0]!.card.atk -= 10;
    expect(effectChoices(unchanged, law, 'field_activate').map(c => c.target)).toEqual([
        { playerIndex: 1, type: 'pawn', index: 0 }
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
    // The real second Land works for either turn player and reserves its use at announcement.
    for (const actor of [0, 1]) {
        let kingdom = structuredClone(game);
        kingdom.activePlayerIndex = actor;
        const dark = (owner: number) => ({ ...card('P_Solstice_Sentinel', owner), attribute: Attribute.DARK });
        const summon = dark(actor);
        const materials = [dark(actor), dark(actor)];
        kingdom.players[actor].hand = [summon, card('P_Solstice_Sentinel', actor)];
        kingdom.players[actor].discard = [materials[0]];
        expect(effectChoices(kingdom, cover, 'field_activate')).toEqual([]);
        kingdom.players[actor].discard.push(materials[1], card('P_Solstice_Sentinel', actor));
        for (const owner of [0, 1]) kingdom.players[owner].pawnZones[0]!.card.attribute = Attribute.DARK;
        for (const owner of [0, 1]) expect(fieldStats(kingdom, kingdom.players[owner].pawnZones[0]!).def).toBe(normal.def + 20);
        const choices = effectChoices(kingdom, cover, 'field_activate');
        expect(choices.length).toBeGreaterThan(0);
        expect(choices.every(c => c.handIndex === 0 && c.pawnPlacement?.position === Position.HIDDEN
            && c.discardCardIds?.length === 2 && c.discardCardIds.every(id => materials.some(m => m.instanceId === id)))).toBe(true);
        const context = choices[0];
        for (const invalid of [
            { ...context, discardCardIds: [materials[0].instanceId, materials[0].instanceId] },
            { ...context, handIndex: 1 },
            { ...context, pawnPlacement: { ...context.pawnPlacement!, position: Position.DEFENSE } }
        ]) expect(applyCommand(kingdom, actor, { type: 'activate', context: invalid, trigger: 'field_activate' }).state).toBe(kingdom);
        const queued = applyCommand(kingdom, actor, { type: 'activate', context, trigger: 'field_activate' }).state;
        expect(activeLand(queued)?.effectUsedTurn?.summon).toBe(kingdom.turnNumber);
        kingdom = resolveChain(queued);
        expect(kingdom.players[actor].void.map(c => c.instanceId).sort()).toEqual(materials.map(c => c.instanceId).sort());
        expect(kingdom.players[actor].discard).toHaveLength(1);
        expect(kingdom.players[actor].pawnZones[context.pawnPlacement!.slot]).toMatchObject({
            card: summon, position: Position.HIDDEN, isSetTurn: true
        });
        kingdom.players[actor].hand.push(dark(actor));
        kingdom.players[actor].discard.push(dark(actor), dark(actor));
        expect(effectChoices(kingdom, cover, 'field_activate')).toEqual([]);
        kingdom.currentPhase = Phase.END;
        kingdom = advancePhaseState(kingdom);
        kingdom.activePlayerIndex = actor;
        kingdom.currentPhase = Phase.MAIN1;
        expect(effectChoices(kingdom, cover, 'field_activate').length).toBeGreaterThan(0);
        kingdom.players[actor].hand = [law];
        // Removing the top Land restores Law's Lingering Stat Modifier and suspends Kingdom's.
        const uncovered = buildEffect([Require.Target('action'), Effect.DestroyTarget()])(kingdom, {
            card: law, playerIndex: actor, target: { playerIndex: actor, type: 'land', index: 0 }
        }).newState;
        expect(activeLand(uncovered)?.card.instanceId).toBe(law.instanceId);
        expect(fieldStats(uncovered, uncovered.players[actor].pawnZones[0]!).def).toBe(normal.def);
    }
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
    // Stack capacity is unrelated to the five personal Action zones.
    for (let index = 0; index < 40; index++) {
        const next = { ...law, id: `test-land-${index}`, name: `Test Land ${index}`, instanceId: `test-land-${index}` };
        game.players[1].hand = [next];
        game = applyCommand(game, 1, { type: 'play', cardId: next.instanceId, set: false, slot: -1 }).state;
    }
    expect(game.landStack).toHaveLength(42);
});
