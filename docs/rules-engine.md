# Rules engine and React adapters

`src/game/engine.ts` is the entry point for running a match without React, a browser, or timers. It imports the card registry and definitions. Human play and AI play both use the same command transitions; the AI's combat estimates reuse `src/game/combat.ts`.

## Boundaries

- `createGame(players)` constructs a match from prepared runtime decks, including opening hands and starting LP. Deck selection, saved-deck storage, and deck randomization are supplied by the caller.
- `applyCommand(state, actorIndex, command)` applies a player decision and returns `{ state, events }`. Invalid decisions return the original state. Summons, including their tributes, commit atomically.
- `applySystemCommand(state, command)` handles host-controlled progress: drawing the next required card or completing a deferred attack/phase change after responses. These commands are separate from player decisions.
- `previewEffect` exposes selection requirements without committing the result. The UI collects targets, costs, and pile selections, then submits `activate`.
- `canAttack`, `canChangePosition`, `canPlayCard`, and shared chain queries let adapters display legal options.

Player commands cover `summon`, `play`, `position`, `activate`, `cancelEffect`, `attack`, `phase`, `end`, and `pass`. Card IDs in `summon`, `play`, and `cancelEffect` are runtime instance IDs. Effect context currently retains the existing typed card/selection format; this is a local engine API, not a validated network protocol.

```ts
import { applyCommand, applySystemCommand } from '../src/game/engine';

// Both a React adapter and a future server can submit the same decision.
const declared = applyCommand(state, state.activePlayerIndex, {
    type: 'attack', attackerIndex: 0, targetIndex: 'direct',
});

// When response.ready is true, the host may finish immediately or after a visual delay.
const resolved = applySystemCommand(declared.state, { type: 'completeDeferred' });
```

Attack declaration preserves the response window and target instance identity. Completion rechecks the board and returns destruction events containing player, zone, and card data. React maps those events to shatter/movement animations. Other card movement animations continue observing state changes. The engine never invokes animation callbacks.

Draw progress is stored in `GameState.drawProgress`. A host can call the `draw` system command until `remaining` is zero. Extra calls after completion do nothing. A player cannot leave a later Draw Phase before required draws finish. Empty-deck losses, turn resets, Standby effects, Battle entry, and End Phase expiration are engine responsibilities.

## React's responsibilities

`useGameLogic` holds the current snapshot and connects the adapters. `useCardActions` collects placement/tribute choices; `useEffectResolution` collects effect selections. Neither implements card-state mutations. `GameView` renders the board and calls actions rather than modifying it. Playback hooks choose delays and dispatch engine commands. The existing 1.5-second attack presentation and staggered draws remain UI choices; headless callers need no such delays.

`useOpponentAI` schedules decisions and submits them through the same engine. Planning may simulate effects and estimate unknown defenders, but live AI actions do not have a second set of summon, placement, position, or combat rules.

## Tests and future work

`tests/engine.test.ts` rejects any React import and runs command flows with frozen inputs, including opening turns, draws, summons, combat, victory, and invalid decisions. React integration tests still cover selection dialogs and animation timing.

This extraction preserves the existing card definitions and simultaneous-trigger batch helper. Seeded randomness/replays, a complete event stream, network payload validation, persistent sessions, and server-side hidden-information filtering are separate future steps. Deck searches still use the existing random shuffle; this change does not claim deterministic replay support.
