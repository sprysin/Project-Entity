# How To Add a New Card

This guide walks through **every step** needed to add a single card to the game, covering all three card types (Pawn, Action, Condition), their subtypes, and common edge cases.

---

## Table of Contents
1. [Overview: The Card Pipeline](#1-overview-the-card-pipeline)
2. [Step 1 — Create the Card File](#2-step-1--create-the-card-file)
3. [Step 2 — Define the Card's Stats](#3-step-2--define-the-cards-stats)
4. [Step 3 — Build the Effect Logic](#4-step-3--build-the-effect-logic)
5. [Step 4 — Register and Export](#5-step-4--register-and-export)
6. [Step 5 — Verify](#6-step-5--verify)
7. [Available Libraries Quick Reference](#7-available-libraries-quick-reference)
8. [Common Edge Cases & Gotchas](#8-common-edge-cases--gotchas)

---

## 1. Overview: The Card Pipeline

```
[Card File] ──register()──> [CardRegistry] <──import── [index.ts]
                                  │
                     createDeck() reads from here
                                  │
                          [Game Engine]
```

| File | Purpose |
|------|---------|
| `src/cards/pawns/YourCard.ts` | Card definition + effect logic |
| `src/cards/pawns/index.ts` | Barrel import (triggers registration) |
| `src/cards/CardRegistry.ts` | Singleton that stores all cards and effects |
| `constants.ts` | `createDeck()` pulls from the registry to build a 40-card deck |

> [!IMPORTANT]
> Cards auto-register themselves when their file is imported. If you forget the `index.ts` import, the card **will not exist** in the game even though the file compiles fine.

---

## 2. Step 1 — Create the Card File

Create a new `.ts` file in the correct folder based on card type:

| Card Type | Folder |
|-----------|--------|
| Pawn | `src/cards/pawns/` |
| Action | `src/cards/actions/` |
| Condition | `src/cards/conditions/` |

Use **PascalCase** naming matching the card name (e.g., `ForceFireSparker.ts`).

### Starter Template

```typescript
import { IEffect, CardType, Attribute, PawnType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
// Import ONLY the libs you actually need:
// import { Effect } from '../libs/Effects';
// import { Cost } from '../libs/Costs';
// import { Require, Condition } from '../libs/Requirements';
// import { Query } from '../libs/Queries';

const effect: IEffect = {
    // Fill in effect hooks (see Step 3)
};

cardRegistry.register({
    // Fill in stats (see Step 2)
}, effect);
```

---

## 3. Step 2 — Define the Card's Stats

All stats are passed to `cardRegistry.register()` as the first argument.

### Required Fields (ALL Cards)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID. Convention: `pawn_XX`, `action_XX`, `condition_XX` |
| `name` | `string` | Display name |
| `type` | `CardType` | `CardType.PAWN`, `CardType.ACTION`, or `CardType.CONDITION` |
| `level` | `Level` (0-10) | Actions/Conditions use `0` |
| `atk` | `number` | Attack stat. Actions/Conditions use `0` |
| `def` | `number` | Defense stat. Actions/Conditions use `0` |
| `effectText` | `string` | card effect text shown on the card |

### Pawn-Only Fields

| Field | Type | Description |
|-------|------|-------------|
| `attribute` | `Attribute` | `FIRE`, `WATER`, `EARTH`, `AIR`, `ELECTRIC`, `NORMAL`, `DARK`, `LIGHT` |
| `pawnType` | `PawnType` | `WARRIOR`, `MAGICIAN`, `DRAGON`, `MECHANICAL`, `DEMON`, `ANGEL`, `PLANT`, `FISH`, `BEAST`, `ELEMENTAL`, `PRIMAL`, `AVION`, `UNDEAD`, `BUG` |

### Optional Fields (Actions & Conditions)

| Field | Type | Description |
|-------|------|-------------|
| `isLingering` | `boolean` | If `true`, the card stays on the field after activation instead of going to discard |

### Summoning Rules by Level

| Level | Requirement |
|-------|------------|
| 1–4 | Normal summon (no tribute) |
| 5–7 | Tribute 1 pawn |
| 8–10 | Tribute 2 pawns |

---

## 4. Step 3 — Build the Effect Logic

The `IEffect` interface has **5 possible hooks**. Use only the ones your card needs:

```typescript
const effect: IEffect = {
    onSummon?:        // When a Pawn is Normal Summoned or Set
    onActivate?:      // When played from hand (Actions, Conditions, Pawn ignition)
    onFieldActivate?: // When a Lingering Action/Condition is activated while ALREADY face-up on the field
    onPhaseChange?:   // Triggered during phase transitions (e.g. End Phase maintenance)
    canActivate?:     // Static check — return false to block activation entirely
};
```

### Which Hook Do I Use?

| Scenario | Hook |
|----------|------|
| Pawn enters the field | `onSummon` |
| Pawn has an ignition effect (player presses ACTIVATE) | `onActivate` |
| Normal Action played from hand (use and discard) | `onActivate` |
| Condition flipped face-up | `onActivate` |
| Lingering Action/Condition activated while sitting face-up | `onFieldActivate` |
| End-of-turn cleanup or stat resets | `onPhaseChange` |
| Card has activation restrictions | `canActivate` |

> [!WARNING]
> **`onActivate` vs `onFieldActivate`**: If a lingering card has a manual effect the player triggers from the board (like Mark of the Forest Hunter's search), that effect goes in `onFieldActivate`, **NOT** `onActivate`. `onActivate` fires when the card is first played from hand. If you put the effect in `onActivate`, it will fire immediately when the card is placed, not when the player manually clicks ACTIVATE later.

### Using `buildEffect()` and `buildCondition()`

Effects are built by chaining **EffectSteps** in order:

```typescript
import { buildEffect, buildCondition } from '../libs/Builder';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.PayLP(100),                    // Step 1: Pay cost
        Require.Target('pawn'),             // Step 2: Pick a target
        Effect.ModifyTargetStats(20, 0)     // Step 3: Apply effect
    ]),
    canActivate: buildCondition([
        Condition.CompareValue(
            (s, c) => s.players[c.playerIndex].lp,
            '>=', 100
        )
    ])
};
```

> [!NOTE]
> The Builder runs steps **sequentially**. If any step returns a `requireX` (target, discard, hand, deck, tribute), the engine **suspends** execution, waits for the player's UI input, then **re-runs the entire chain from the beginning** with the selected value injected into the context. This means earlier steps (like LP costs) will re-execute — but only the final pass's state is committed.

### Writing Custom EffectSteps

If no library function fits, write a custom step:

```typescript
const myCustomStep: EffectStep = (draftState, context) => {
    // draftState is a deep-cloned mutable copy of GameState
    // context.card = the card being activated
    // context.playerIndex = who activated it
    // context.target = selected target (if any)
    // context.discardIndex, handIndex, deckIndex, tributeIndices = selection results

    const p = draftState.players[context.playerIndex];
    p.lp += 50;

    return { log: "Gained 50 LP." };
    // Return nothing (void) if no log needed
    // Return { halt: true } to stop the chain
    // Return { requireTarget: 'pawn' } to prompt for target selection
};
```

---

## 5. Step 4 — Register and Export

### 4a. Registration (already in your card file)

```typescript
cardRegistry.register({
    id: 'pawn_08',
    name: 'My New Pawn',
    type: CardType.PAWN,
    level: 4,
    attribute: Attribute.FIRE,
    pawnType: PawnType.WARRIOR,
    atk: 180,
    def: 100,
    effectText: 'ON SUMMON: Gain 20 LP.',
}, effect);
```

### 4b. Add to Index File

Open the relevant `index.ts` and add the import:

| Card Type | File to Edit |
|-----------|-------------|
| Pawn | `src/cards/pawns/index.ts` |
| Action | `src/cards/actions/index.ts` |
| Condition | `src/cards/conditions/index.ts` |

```typescript
import './MyNewPawn';  // Just a side-effect import — triggers registration
```

---

## 6. Available Libraries Quick Reference

### Effects (`src/cards/libs/Effects.ts`)

| Function | Description |
|----------|-------------|
| `Effect.ChangeTargetPosition(pos)` | Switch a target between ATK/DEF/HIDDEN |
| `Effect.ModifyTargetStats(atk, def)` | Add/subtract ATK and/or DEF from target |
| `Effect.ChangeSelfPosition(pos)` | Change the activating pawn's position |
| `Effect.ModifySelfStats(atk, def)` | Modify the activating pawn's own stats |
| `Effect.DrawCards(amount)` | Draw cards (amount can be Dynamic) |
| `Effect.DealDamage(playerIdx, amount, reason?)` | Deal LP damage |
| `Effect.RestoreLP(playerIdx, amount)` | Heal LP |
| `Effect.BanishTargetToVoid()` | Send target to the Void zone |
| `Effect.RecoverFromDiscardToHand()` | Move selected discard card to hand |
| `Effect.RegisterPendingEffect(type, instanceId, value)` | Schedule a stat reset |
| `Effect.RegisterSelfPendingEffect(type, value, durationTurns)` | Schedule self stat reset |
| `Effect.SetSoftOncePerTurn()` | Mark this card instance's effect as used (resets per copy) |
| `Effect.SetHardOncePerTurn(cardId)` | Mark this card ID as used globally for the turn |
| `Effect.SearchDeck(message, filter)` | Open deck UI, player picks a card matching filter, add to hand, shuffle |

### Costs (`src/cards/libs/Costs.ts`)

| Function | Description |
|----------|-------------|
| `Cost.PayLP(amount)` | Deduct LP (amount can be Dynamic) |
| `Cost.TributePawns(count, message, filter?)` | Prompt sacrifice of field pawns matching an optional filter |
| `Cost.DiscardCardFilter(message, filter?)` | Prompt discard of a hand card matching a filter |
| `Cost.SelectDiscardRecovery(message, filter)` | Prompt selection from discard pile |

### Requirements (`src/cards/libs/Requirements.ts`)

**EffectStep Requirements** (halt the effect if not met):

| Function | Description |
|----------|-------------|
| `Require.Target(type, message, set)` | Prompt the player to select a target |
| `Require.TargetIsPlayerScope(scope)` | Verify target belongs to active/opponent |
| `Require.TargetMatchesPosition(pos, invert?)` | Verify target position state |
| `Require.CompareValue(valueFn, op, compareTo)` | Generic numerical check |

**canActivate Conditions** (return boolean):

| Function | Description |
|----------|-------------|
| `Condition.CompareValue(valueFn, op, compareTo)` | Generic numerical check |
| `Condition.PawnMatchesFilter(scope, filter)` | Check if any pawn matches |
| `Condition.DiscardMatchesFilter(scope, filter)` | Check discard for matches |
| `Condition.ActionMatchesFilter(scope, filter)` | Check action zones for matches |
| `Condition.SoftOncePerTurn()` | Has this card instance activated this turn? |
| `Condition.HardOncePerTurn(cardId)` | Has ANY copy of this card activated this turn? |

### Queries (`src/cards/libs/Queries.ts`)

| Function | Description |
|----------|-------------|
| `Query.CountPawnAttribute(attribute)` | Count face-up pawns with attribute |
| `Query.CountSetActions(scope)` | Count hidden actions/conditions |
| `Query.TargetPlayerIndex()` | Get target's player index |
| `Query.ActiveOpponent()` | Get opponent's index |
| `Query.TargetZoneIndex()` | Get target's zone index |
| `Query.Multiply(valueFn, multiplier)` | Multiply a dynamic value |

### Dynamic Values

Any parameter typed as `Dynamic<number>` accepts either a **static number** or a **function**:
```typescript
Cost.PayLP(100)                                       // Static: always 100
Cost.PayLP((s, c) => Math.floor(s.players[c.playerIndex].lp / 2))  // Dynamic: half current LP
```

---

## 8. Common Edge Cases & Gotchas

### Activation vs Field Activation
If your card is `isLingering: true` and has an effect the player triggers manually from the board, use `onFieldActivate`. Using `onActivate` will fire it the moment the card is played from hand.

### Once Per Turn — Soft vs Hard
- **Soft**: Add `Effect.SetSoftOncePerTurn()` to your effect chain AND `Condition.SoftOncePerTurn()` to `canActivate`. Resets when the card leaves/re-enters the field or a different copy is played.
- **Hard**: Add `Effect.SetHardOncePerTurn('your_card_id')` AND `Condition.HardOncePerTurn('your_card_id')` to `canActivate`. Blocks ALL copies of this card for the rest of the turn.

### Pre-Activation Requirements
If a card should be **unplayable** unless conditions are met (e.g., need 2 Mechanical Pawns on field), use `canActivate`:
```typescript
canActivate: (state, context) => {
    const p = state.players[context.playerIndex];
    return p.pawnZones.filter(z => z && z.card.pawnType === PawnType.MECHANICAL).length >= 2;
}
```

### Costs That Require UI Interaction
`Cost.TributePawns` and `Cost.DiscardCardFilter` suspend the effect chain to wait for player input. The engine re-runs the entire chain after the player makes their selection. Keep this in mind when writing custom steps — they should be **idempotent** or use context checks like `if (context.tributeIndices === undefined)`.

### Effect Step Execution Order with Suspensions
The Builder re-runs the **entire chain** each time a suspension resolves. For example:

```
Pass 1: [PayLP] → [SearchDeck → SUSPEND]     ← LP deduction thrown away (peek only)
Pass 2: [PayLP] → [SearchDeck → processes]    ← LP deduction committed this time
```

This means costs always re-execute. The final pass is the only one that commits to game state.

### Intermediate State Commits
If a cost (like LP payment) must be **visually reflected before** a UI modal opens (e.g., lose LP before deck search appears), the engine commits intermediate state for `requireDeckSelection`. Other selection types (discard, hand, tribute) do NOT currently commit intermediate state.

### Unique Card IDs
Every card MUST have a unique `id`. The convention is:
- Pawns: `pawn_01`, `pawn_02`, etc.
- Actions: `action_01`, `action_02`, etc.
- Conditions: `condition_01`, `condition_02`, etc.

Check existing IDs before choosing yours. If you reuse an ID, the registry will overwrite the old card.

---

## Full Examples

### Simple Pawn (On-Summon Effect)
```typescript
// src/cards/pawns/ForceFireSparker.ts
const effect: IEffect = {
    onSummon: buildEffect([
        Effect.DealDamage(Query.ActiveOpponent(), Query.Multiply(Query.CountSetActions('opponent'), 10), "FORCE FIRE SPARKER:")
    ])
};
cardRegistry.register({ id: 'pawn_03', name: 'Force Fire Sparker', type: CardType.PAWN, level: 2, attribute: Attribute.FIRE, pawnType: PawnType.DEMON, atk: 30, def: 150, effectText: '...' }, effect);
```

### Lingering Condition (Targets a Pawn)
```typescript
// src/cards/conditions/Reinforcement.ts
const effect: IEffect = {
    onActivate: buildEffect([
        Require.Target('pawn', "REINFORCEMENT: Target an Pawn."),
        Require.TargetMatchesPosition(Position.HIDDEN, true, "REINFORCEMENT: Invalid target."),
        Effect.ModifyTargetStats(20, 0)
    ]),
    canActivate: buildCondition([Condition.PawnMatchesFilter('both', (z) => z.position !== Position.HIDDEN)])
};
cardRegistry.register({ id: 'condition_01', name: 'Reinforcement', type: CardType.CONDITION, isLingering: true, level: 0, atk: 0, def: 0, effectText: '...' }, effect);
```

### Lingering Action (Manual Field Activation + Deck Search)
```typescript
// src/cards/actions/MarkOfTheForestHunter.ts
const effect: IEffect = {
    onFieldActivate: buildEffect([
        payHalfLp,                                    // Custom step: deducts half LP
        Effect.SetSoftOncePerTurn(),                  // Marks as used this turn
        Effect.SearchDeck("Select Beast Pawn", (c) => c.type === CardType.PAWN && c.level >= 5 && c.pawnType === PawnType.BEAST)
    ]),
    canActivate: (state, context) => {
        if (!Condition.SoftOncePerTurn()(state, context)) return false;
        if (state.players[context.playerIndex].lp <= 1) return false;
        return true;
    }
};
cardRegistry.register({ id: 'action_03', name: 'Mark of the Forest Hunter', type: CardType.ACTION, isLingering: true, level: 0, atk: 0, def: 0, effectText: '...' }, effect);
```

### Normal Action (Tribute Cost + Discard Selection)
```typescript
// src/cards/actions/MechanicalMaintenance.ts
const effect: IEffect = {
    onActivate: buildEffect([
        Cost.TributePawns(2, "Select 2 Mechanical Pawns to Sacrifice", c => c.pawnType === PawnType.MECHANICAL),
        selectFromDiscard,        // Custom step: requireDiscardSelection
        specialSummonFromDiscard  // Custom step: moves card to pawn zone
    ]),
    canActivate: (state, context) => {
        const p = state.players[context.playerIndex];
        const mechCount = p.pawnZones.filter(z => z && z.card.pawnType === PawnType.MECHANICAL).length;
        if (mechCount < 2) return false;
        return p.discard.some(c => c.pawnType === PawnType.MECHANICAL);
    }
};
cardRegistry.register({ id: 'action_04', name: 'Mechanical Maintenance', type: CardType.ACTION, level: 0, atk: 0, def: 0, effectText: '...' }, effect);
```
