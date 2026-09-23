import { expect, it } from 'vitest';
import { Card, CardType, GameState, Phase, Player, Position } from '../src/types';
import { drawCards } from '../src/game/draw';
import { checkVictory } from '../src/game/finishEffect';
import { buildEffect } from '../src/cards/engine/Builder';
import { Effect } from '../src/cards/engine/Effects';
import { cardRegistry } from '../src/cards/CardRegistry';
import { addSimultaneousTriggers, resolveChainStep, SimultaneousTrigger } from '../src/game/chains';
import { advancePhaseState } from '../src/game/phases';

function state(): GameState {
    const player = (index: number): Player => ({
        id: `p${index}`, name: `Player ${index + 1}`, lp: 800, deck: [], initialDeck: [], hand: [], discard: [], void: [],
        pawnZones: Array(5).fill(null), actionZones: Array(5).fill(null), normalSummonUsed: false,
        hiddenSummonUsed: false, activatedHardOncePerTurns: [],
    });
    return { players: [player(0), player(1)], activePlayerIndex: 0, currentPhase: Phase.MAIN1,
        turnNumber: 2, log: [], winner: null, pendingEffects: [] };
}
const card = (id = 'rules-card', owner = 0): Card => ({ id, instanceId: id, ownerId: `p${owner}`,
    name: id, type: CardType.PAWN, level: 1, atk: 100, def: 100, effectText: '' });

it('loses only on a required missing draw, including partially fulfilled draws', () => {
    const game = state();
    game.players[0].deck = [card()];
    const last = drawCards(game, 0, 1);
    expect(last.winner).toBeNull();
    expect(drawCards(last, 0, 0).winner).toBeNull();
    expect(drawCards(last, 0, 1)).toMatchObject({ winner: 'Player 2', resultReason: 'empty_deck' });
    const partial = drawCards(game, 0, 2);
    expect(partial.players[0].hand).toHaveLength(1);
    expect(partial.winner).toBe('Player 2');
    expect(game.players[0].deck).toHaveLength(1);
});

it('stops an effect immediately after a failed draw', () => {
    const result = buildEffect([Effect.DrawCards(1), Effect.RestoreLP(0, 100)])(state(), { card: card(), playerIndex: 0 });
    expect(result.newState.winner).toBe('Player 2');
    expect(result.newState.players[0].lp).toBe(800);
});

it('records simultaneous lethal LP as a draw independent of turn player', () => {
    for (const activePlayerIndex of [0, 1]) {
        const game = state();
        game.activePlayerIndex = activePlayerIndex;
        game.players[0].lp = 0;
        game.players[1].lp = -10;
        expect(checkVictory(game)).toMatchObject({ winner: 'Draw', isDraw: true });
    }
});

it('keeps next-turn bonuses through the following End Phase and expires them when it finishes', () => {
    let game = state();
    const pawn = card();
    game.players[0].pawnZones[0] = { card: pawn, position: Position.ATTACK, hasAttacked: false,
        hasChangedPosition: false, summonedTurn: 1, isSetTurn: false };
    game = buildEffect([Effect.ModifyAllPawnStats('active', 0, 200, 'end_of_next_turn')])(game, { card: pawn, playerIndex: 0 }).newState;
    game.currentPhase = Phase.END;
    game = advancePhaseState(game);
    expect(game.turnNumber).toBe(3);
    expect(game.players[0].pawnZones[0]!.card.def).toBe(300);
    game.currentPhase = Phase.MAIN2;
    game = advancePhaseState(game);
    expect(game.currentPhase).toBe(Phase.END);
    expect(game.players[0].pawnZones[0]!.card.def).toBe(300);
    game = advancePhaseState(game);
    expect(game.turnNumber).toBe(4);
    expect(game.players[0].pawnZones[0]!.card.def).toBe(100);
    expect(game.pendingEffects).toEqual([]);
});

it('builds all four trigger groups before any effect resolves, then resolves in reverse', () => {
    for (const active of [0, 1]) {
        const game = state();
        game.activePlayerIndex = active;
        const resolved: string[] = [];
        const entries: SimultaneousTrigger[] = [
            [active, true, 'turn mandatory'], [1 - active, true, 'opponent mandatory'],
            [active, false, 'turn optional'], [1 - active, false, 'opponent optional'],
            [active, false, 'declined'],
        ].map(([owner, mandatory, name], index) => {
            const source = card(`trigger-${active}-${index}`, owner as number);
            cardRegistry.register(source, { onSummon: buildEffect([(draft, context) => {
                if (context.execution === 'resolve') {
                    expect(draft.chain).toHaveLength(4 - resolved.length);
                    resolved.push(name as string);
                }
            }]) });
            return { context: { card: source, playerIndex: owner as number }, trigger: 'summon',
                mandatory: mandatory as boolean, accepted: name !== 'declined' };
        });
        let pending = addSimultaneousTriggers(game, [entries[3], entries[1], entries[4], entries[2], entries[0]]);
        expect(pending.resolvingChain).toMatchObject({ current: 1, total: 4, cardName: entries[3].context.card.name });
        while (pending.resolvingChain) {
            const previous = pending;
            pending = resolveChainStep(pending);
            expect(pending.chain).toHaveLength(previous.chain!.length - 1);
        }
        expect(resolved).toEqual(['opponent optional', 'turn optional', 'opponent mandatory', 'turn mandatory']);
    }
});
