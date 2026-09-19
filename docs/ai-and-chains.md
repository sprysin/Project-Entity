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

Use `buildEffect` with `Cost` helpers for costs and `Effect` helpers for resolution. Custom activation costs must be wrapped with `activationCost`. The builder previews choices without committing state, pays tagged costs at announcement, and skips those costs during resolution. Custom handlers outside the builder are resolution-only.

Use `context.playerIndex` for the controller, not `state.activePlayerIndex`, which is the turn player. Quick Pawns opt in through `IEffect.timing`. Card-specific requirements still belong in `canActivate` and effect steps, and apply to both humans and the AI.

## AI decisions

`observeGame` removes the opposing hand and face-down identities/stats, removes initial deck lists, and hides draw order. The planner receives this observation rather than the live game state. Unknown defending Pawns use a fixed estimate; changing their actual identity cannot change a decision.

Legal effect choices come from the registered effect's own selection requests. A shared score values lethal damage first, then LP, field presence, useful cards, and exposure to attacks. Main Phase choices compare summons, tribute costs, defensive sets, position changes, and effects. Battle uses a bounded search of attack sequences so smaller attackers can clear blockers for larger direct attacks. Response evaluation includes the pending attack. There are no card-name combo tables.

This is a heuristic opponent, not an exhaustive solver: effect-choice exploration and battle search are bounded. A per-turn action budget prevents pathological effect loops from hanging the match. Tests cover hidden-information invariance, legal timing/counts, costs, LIFO order, invalidated targets, and complete React-driven AI turns.
