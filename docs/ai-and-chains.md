# AI playtests and response chains

The setup screen defaults to self-play. AI mode assigns Player 2's selected saved or random deck to the AI and keeps the board viewed from Player 1's perspective.

## Response rules

- Attacks, phase changes, and announced effects offer the other player priority.
- A popup appears only when its priority holder has a legal activation, including valid costs and selections. It shows the number of eligible cards and waits for a choice or Pass.
- Conditions set on an earlier turn and face-up Pawns whose registered effect has `timing: 'quick'` can respond. Other Pawn effects and Actions remain Main Phase activations. Existing Pawns have not been reclassified as quick effects.
- Each added link hands priority to the other player and resets the pass count. Players without legal responses pass automatically. Two consecutive passes resolve the entire stack in reverse order.
- A source cannot join the same unresolved chain twice. Declared costs and usage limits are reserved at activation. Removing a source does not negate its effect; an invalid target causes that effect to resolve without effect. Targets and selected pile cards use instance identities, so replacement cards are not accidentally affected.
- After the chain, a pending attack is checked against the current field. A missing attacker/target or attacker moved out of Attack stops that attack. Phase changes resume after responses finish.

## Adding cards

For future simultaneous triggers, collect the eligible effects from a single event and submit them together to `addSimultaneousTriggers`. Each entry specifies its controller, trigger, completed target/cost choices, and `mandatory`; optional entries require `accepted: true`. The helper builds one chain in turn-player mandatory, opponent mandatory, turn-player optional, opponent optional order before opening responses or resolving anything. Within a group it preserves caller order; a future choice UI can supply controller-selected ordering. Do not call the ordinary single-activation helper once per simultaneous trigger, or resolve one group before collecting the others. This is the batch integration point for future cards; it does not discover new trigger conditions automatically or change existing single-trigger card behavior.

Discard means hand to Discard Pile. Tribute, destroy, and send remain distinct operations; entering the Discard Pile does not automatically invoke `onDiscard`.

Required draws use `drawCards` for both Draw Phase and effects. An attempted draw from an empty deck immediately ends the duel, including when only part of a multi-card draw can be completed. Drawing the last available card is safe. Simultaneous nonpositive LP is a draw. Temporary stat resets run when leaving the due turn's End Phase, after responses, rather than on entry.

Use `buildEffect` with `Cost` helpers for costs and `Effect` helpers for resolution. Custom activation costs must be wrapped with `activationCost`. The builder previews choices without committing state, pays tagged costs at announcement, and skips those costs during resolution. Custom handlers outside the builder are resolution-only.

Use `context.playerIndex` for the controller, not `state.activePlayerIndex`, which is the turn player. Quick Pawns opt in through `IEffect.timing`. Card-specific requirements still belong in `canActivate` and effect steps, and apply to both humans and the AI.

## AI decisions

`observeGame` removes the opposing hand and face-down identities/stats, removes initial deck lists, and hides draw order. The planner receives this observation rather than the live game state. Unknown defending Pawns use a fixed estimate; changing their actual identity cannot change a decision.

Legal effect choices come from the registered effect's own selection requests. A shared score values lethal damage first, then LP, field presence, useful cards, and exposure to attacks. Main Phase choices compare summons, tribute costs, defensive sets, position changes, and effects. Battle uses a bounded search of attack sequences so smaller attackers can clear blockers for larger direct attacks. Response evaluation includes the pending attack. There are no card-name combo tables.

This is a heuristic opponent, not an exhaustive solver: effect-choice exploration and battle search are bounded. A per-turn action budget prevents pathological effect loops from hanging the match. Tests cover hidden-information invariance, legal timing/counts, costs, LIFO order, invalidated targets, and complete React-driven AI turns.

## Attach subtypes

Attach Actions retain Action timing (the controller’s Main Phases); Attach Conditions retain Condition timing (set on an earlier turn, eligible to respond). Remaining face-up does not repeat an attachment’s initial activation. `Effect.AttachToTarget()` records the target instance ID only during successful resolution, after choices and costs. AI previews may evaluate an Attach Action in hand before choosing a zone. The source must still be on the field when it attaches. Invalidated targets cause the Attach card to be discarded without linking to a replacement.

Reinforcement (`condition_01`) is an Attach Condition. Attachment tracking alone does not reverse permanent stat changes or remove the source when its target leaves; the hover link is hidden when the target is absent.
