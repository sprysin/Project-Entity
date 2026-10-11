import { expect, it } from 'vitest';
import '../src/cards/pawns';
import '../src/cards/actions';
import '../src/cards/conditions';
import { cardRegistry } from '../src/cards/CardRegistry';
import { Card, GameState, Phase, Player, Position } from '../src/types';
import { addChainLink, resolveChain, startPendingTriggers } from '../src/game/chains';
import { checkVictory } from '../src/game/finishEffect';
import { resolveCombat } from '../src/game/combat';

const card = (id: string): Card => ({ ...cardRegistry.getCard(id)!, instanceId: id, ownerId: 'p0' });
const zone = (card: Card) => ({ card, position: Position.ATTACK, hasAttacked: false, hasChangedPosition: false, summonedTurn: 1, isSetTurn: false });
function setup() {
    const player = (id: string): Player => ({ id, name: id, lp: 800, hand: [], deck: [], reserve: [], initialDeck: [], discard: [], void: [], pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null), normalSummonUsed: false, hiddenSummonUsed: false, activatedHardOncePerTurns: [] });
    const state: GameState = { players: [player('p0'), player('p1')], activePlayerIndex: 0, currentPhase: Phase.MAIN1, turnNumber: 3, log: [], winner: null, pendingEffects: [] };
    const source = card('C_Reinforcement'), target = card('P_Solstice_Sentinel');
    state.players[0].actionZones[0] = zone(source);
    state.players[0].pawnZones[0] = zone(target);
    return { state, source, target };
}

it('discards an attachment that fizzles instead of linking to a replacement target', () => {
    const { state, source, target } = setup();
    state.chain = [{ context: { card: source, playerIndex: 0, target: { playerIndex: 0, type: 'pawn', index: 0 } }, trigger: 'activate', targetId: target.instanceId }];
    state.players[0].pawnZones[0] = zone(card('P_High_King'));
    const next = resolveChain(state);
    expect(next.players[0].actionZones[0]).toBeNull();
    expect(next.players[0].discard[0].instanceId).toBe(source.instanceId);
    expect(next.players[0].pawnZones[0]?.card.atk).toBe(card('P_High_King').atk);
});

it('destroys chained Attach cards when an attached target leaves the field', () => {
    const { state, source, target } = setup();
    const secondSource = { ...source, instanceId: 'second-attachment' };
    state.players[0].actionZones[0]!.attachedToInstanceIds = [target.instanceId];
    state.players[0].actionZones[1] = { ...zone(secondSource), attachedToInstanceIds: [source.instanceId] };
    state.players[0].pawnZones[0] = null;

    const next = checkVictory(state);

    expect(next.players[0].actionZones.slice(0, 2)).toEqual([null, null]);
    expect(next.players[0].discard.map(discarded => discarded.instanceId)).toEqual([source.instanceId, secondSource.instanceId]);

    // Leaving and returning during the same battle still breaks every attachment.
    const revival = setup();
    const victim = { ...card('P_Glitter_Grub'), ownerId: 'p1' };
    const necromancer = card('P_Zombie_Necromancer');
    revival.state.players[0].pawnZones[0] = zone(necromancer);
    revival.state.players[1].pawnZones[0] = { ...zone(victim), position: Position.DEFENSE };
    revival.state.players[0].actionZones[1] = zone(secondSource);
    let attachedVictim = resolveChain(addChainLink(revival.state, {
        card: revival.source, playerIndex: 0, target: { playerIndex: 1, type: 'pawn', index: 0 }
    }, 'activate'));
    attachedVictim.players[0].actionZones[1]!.attachedToInstanceIds = [revival.source.instanceId];
    expect(attachedVictim.players[1].pawnZones[0]!.card.atk).toBe(victim.atk + 20);
    attachedVictim.currentPhase = Phase.BATTLE;
    const revived = resolveChain(startPendingTriggers(resolveCombat(attachedVictim, 0, 0)));
    expect(revived.players[0].actionZones.slice(0, 2)).toEqual([null, null]);
    expect(revived.players[0].discard.map(c => c.instanceId)).toEqual([revival.source.instanceId, secondSource.instanceId]);
    expect(revived.players[0].pawnZones[1]?.card).toMatchObject({ instanceId: victim.instanceId, atk: victim.atk });
    expect(revived.players[1].discard).toEqual([]);
    expect(attachedVictim.players[0].actionZones[0]).not.toBeNull();
});
