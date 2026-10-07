# Adding cards

Keep card metadata and behavior together in a TypeScript module under
`src/cards/pawns`, `src/cards/actions`, or `src/cards/conditions`.

All three card types use lowercase alphabetic folders based on the first letter
of the printed card name, with PascalCase module filenames: for example,
`src/cards/pawns/s/SolsticeSentinel.ts`, `src/cards/actions/t/ThunderStrike.ts`,
or `src/cards/conditions/d/DarkDraw.ts`. Create a letter folder when first needed;
use `0-9` for names beginning with a digit. Include leading words such as "The"
and archetype prefixes when choosing the letter. For example, High Voltage -
Charged Dragon lives in `pawns/h/ChargedDragon.ts`. Keep associated tokens in the
source Pawn's module (Golem Token stays with `pawns/s/SplitGolem.ts`).

This keeps locations predictable across a large catalog without grouping cards
by mutable stats, attributes, rarity, or overlapping archetypes. Nested folders
are discovered automatically; adjust relative imports to match the module's depth. The example
below belongs in `src/cards/pawns/e/ExamplePawn.ts`.

The three type entry points eagerly discover modules with Vite's `import.meta.glob`.
Do not add manual imports or call `cardRegistry.register` inside card files.
Each module exports an array of definitions and effects; a card and its associated
tokens may share a module. Loading is synchronous, so the full catalog is available
before deck creation and gameplay. The loader runs in both Vite and Vitest.

```ts
import { Attribute, CardType, IEffect, PawnType } from '../../../types';
import { CardModule } from '../../CardRegistry';
import { buildEffect } from '../../engine/Builder';
import { Effect } from '../../engine/Effects';
import { Query } from '../../engine/Queries';

const effect: IEffect = {
    onSummon: buildEffect([
        Effect.DealDamage(Query.ActiveOpponent(), 10)
    ])
};

export default [{
    cardData: {
        id: 'core_example_pawn',
        name: 'Example Pawn',
        type: CardType.PAWN,
        level: 2,
        attribute: Attribute.FIRE,
        pawnType: PawnType.DEMON,
        atk: 30,
        def: 150,
        effectText: 'ON NORMAL SUMMON: Deal 10 damage.'
    },
    effect
}] satisfies CardModule;
```

## Definitions and IDs

- IDs are permanent save-file identifiers. Existing `pawn_XX`, `action_XX`, and
  `condition_XX` IDs remain valid. New IDs may use a set prefix and descriptive name.
  Never rename an existing ID just because its display name or file changes.
- Duplicate IDs throw an error; they cannot overwrite another card.
- Definitions are copied and frozen at registration. Match cards are separate
  mutable instances. Do not put owner IDs, instance IDs, or temporary match state
  in definitions.
- Levels must be integers from 0 through 10 and stats must be finite numbers.
  Actions and Conditions use level, ATK, and DEF of zero.
- `isAttached` and `isLingering` are mutually exclusive and apply only to Actions
  and Conditions. Neither flag means Normal.
- Tokens use `pawnSubtype: PawnSubtype.TOKEN`; they are excluded from playable
  catalogs and decks. Use `Effect.SummonToken(id)` to place them.

## Compose shared mechanics

Search `src/cards/engine` before writing custom state manipulation:

| Module | Responsibility |
| --- | --- |
| `Builder.ts` | Ordered effects, activation costs, conditions, multiple effect choices |
| `Effects.ts` | Damage, healing, draw, search, movement, stat changes, tokens, counters |
| `Costs.ts` | LP, discard, tribute, position and recovery costs |
| `Requirements.ts` | Target prompts and activation eligibility |
| `Queries.ts` | Shared state queries and dynamic values |
| `Targets.ts` | Indexed target access |

For continuous field-only stat bonuses, define `fieldStatModifier` in the card's
effect object. Return ATK and/or DEF deltas from the current board. Shared combat,
AI, and field display read them through `fieldStats`; do not add card-specific
checks to those consumers or mutate the card's printed stats.

For combat rules, use `canAttack`, `canAttackDirectly`,
`canManuallyChangePosition`, or `preventsBattleDestructionOfOpponent` on the
card effect. Shared combat, AI planning, and field controls read these contracts.
`onAttackCompleted` runs after a resolved attack (including zero-damage attacks),
and `onSentToDiscard` runs for every route to the Discard, including tributes and
discard costs. Set `mandatoryReactions` for effects without optional wording.
Battle-destruction reactions receive `context.battleAttacker` by identity.

Use `Effect.GrantSelfAttacks` for turn-limited attack grants and
`Effect.ChangePawnAttribute` for field attribute changes. Changed attributes show
the shared boosted-stat blue rim and restore their original value on leaving
the field. `opposingPawnInColumn` locates the Pawn across the board without
opening a targeting prompt. `Effect.SummonToken(id, count)` supports independent
zone and position selections for multiple tokens and requires room for all of them.

`Effect.randomSelection({ location, filter, count, playerIndex, candidateIds, isTarget })`
chooses distinct cards from `deck`, `hand`, `field`, `reserve`, or `discard`.
It stores identities in `context.selections` for subsequent steps, and does not
move cards or deal damage. `isTarget` defaults to false; enable it only when the
card explicitly targets. Field selections marked as targets also populate
`context.targets` and respect targeting protection.

Compose selection with any effect step. For example, choose placement with
`Effect.RequirePawnPlacement(Position.ATTACK)`, then use
`Effect.randomSelection({ location: 'hand', filter: pawnFilter })` and
`Effect.SummonSelected(Position.ATTACK)`. To shuffle a random Discard card into
its owner's deck, use `Effect.randomSelection({ location: 'discard' })` followed
by `Effect.MoveSelectedTo('deck')`. Custom steps can consume `context.selections`
for other effects. `selectionIndex` lets multiple selections coexist.

Gather all interactive choices before the random-selection step. Randomness is
consumed only during resolution; previews and AI activation choices are deterministic.
`Effect.SelectDiscardCards` gathers candidate identities in `discardCardIds`,
which can be supplied through `candidateIds` without making them targets.

`buildEffect` works on a cloned draft. Selection requests suspend execution;
the effect may be replayed with supplied choices. Mark activation costs through
the existing cost helpers or `activationCost`; do not perform external side effects
in effect steps. Follow the staged cost/resolution behavior in `Builder.ts` and
`src/game/chains.ts` rather than manually committing selection drafts.

For multiple targets, assign each requirement a zero-based target index and pass
that index to the matching effect operation. Reuse the existing selection UI.

## Hooks and timing

The complete contract is `IEffect` in `src/types.ts`.

- `onSummon`: the source Pawn's normal summon effect.
- `onActivate`: initial Action/Condition activation or Pawn ignition effect.
- `onFieldActivate`: an existing face-up Lingering Action's manual effect.
- `onPhaseChange`: automatic phase effects; check the relevant phase as needed.
- `onSwitch`, `onDiscard`, `onTribute`, `onBattleDestroy`, `onBattleDestroyed`: specialized existing events.
- `onAttachedActivation`: an attachment observes activation by its target.
- `canActivate`: shared player/AI activation eligibility.
- `onPawnSummoned`: a face-up field source observes a successful face-up normal
  or tribute summon. Context includes `summonedCard`, `summoningPlayerIndex`, and
  `tributeCount`. Face-down tribute sets do not emit this event. This observer
  returns state changes or queues a request; it is not a suspended `buildEffect`
  selection handler. Special summons do not currently emit this event.

Pawn ignition timing defaults to the controller's Main Phase. Declare
`timing: 'quick'` only when the design explicitly allows response timing.

For optional effects when a Pawn is destroyed by battle and sent to its owner`s
Discard, implement `onBattleDestroyed` with `buildEffect`. Combat queues this
hook in `pendingReactions`; the shared prompts and AI collect choices and let the
controller activate or decline it. Switch effects use that same queue.
`Effect.SpecialSummonFromDeck(filter, position?)` selects a Pawn and empty zone,
rechecks eligibility at resolution, and shuffles the Deck. An explicit position
restricts both human and AI placement choices.
## Shared queued hand summons

Orcustrated Frontline Unit demonstrates a reusable summon reaction:

1. The card's `onPawnSummoned` hook checks the event and queues
   `{ sourceId: context.card.instanceId, playerIndex: context.playerIndex }`
   in `pendingHandSummons`.
2. Its `handSummonFilter` defines eligible Pawns. The engine, human selection UI,
   and AI all use `handSummonCandidates` from `src/game/summonReactions.ts`.
3. `confirmHandSummon` revalidates the source, selected card, empty zone and
   Attack/Defense position. `declineHandSummon` dismisses the request.

Put card-specific timing and restrictions in the card module. Do not add card IDs,
card names, or individual card eligibility rules to the engine, UI, or AI.
If another card needs a new mechanic, extend the shared event or operation contract.

## Other invariants

- Soft once-per-turn restrictions belong to a field copy; hard restrictions belong
  to a card ID. Pair the shared `Condition` checks with the corresponding `Effect`
  markers. Pass effect IDs when different choices have separate limits.
- `Condition.OnceWhileOnField` and `Effect.SetOnceWhileOnField` track use until a
  new field entry or face-down reset.
- Use `sendToOwnerPile` for departures, including hand/deck returns, so tokens
  vanish and field-only reductions are cleared correctly.
- Use `Effect.VoidTargetTemporarily(phase, delayTurns = 0, targetIndex = 0)`
  to target a Pawn for temporary Void removal. It returns at the next phase selected
  by its effect; `delayTurns` adds turns to the wait. On return, its original owner
  chooses any empty Pawn zone on their field. The Pawn is placed in its original
  position, without counting as a Special Summon. A full field sends it to its
  owner's Discard pile. The return is independent of the source.
- Use `canTribute`, `canSetPawn`, and `setPawnPosition` for their existing invariants.
- Attach cards use `Effect.AttachToTarget` after target selection. Use the shared
  attachment helpers for bonuses and departures.
- Counters live on field placements and clear on departure or a face-down reset.
- Use `cardSubtype`, `cardTypeLabel`, and `matchesCardCatalog` for catalog labels
  and search. Catalog views paginate at 60 cards while searching the entire pool.

## Validation

Extend existing behavior coverage rather than adding one test per card. Preserve
regressions for new mechanics, costs, timing, interrupted selections and interactions.
Run targeted Vitest tests while iterating, then `npm test`, `npm run typecheck`, and
`npm run build`. Native validation is needed only for changes involving native behavior.
