# Project Entity development guidance

## Validation strategy

Use the fastest validation path that covers the changed behavior.

For React, CSS, game rules, and TypeScript-only changes:

- Prefer targeted Vitest tests while iterating.
- Before finishing, run `npm test`, `npm run typecheck`, and `npm run build` when proportional to the change.
- Do not launch the desktop app or compile Rust solely to validate frontend-only work.
- Use `npm run dev:frontend` when interactive browser validation is useful.

## Test maintenance budget

- Default to no new test files and no net growth in test cases or test code lines.
  A completed card or feature does not automatically need its own permanent test.
- Keep `tests/` within approximately 30 executable cases, 1,500 lines, and 100 KiB,
  including fixtures. Ask for explicit approval before exceeding these budgets.
  Case count alone is insufficient: do not bury growth in giant cases or loops,
  compress formatting, or move test code elsewhere to evade the budget.
- Before adding coverage, identify the concrete regression or shared invariant it
  protects and search for an existing test of that behavior. Prefer one representative
  card per reusable mechanic; do not duplicate coverage for every card using it.
- Keep permanent coverage for core game flows, meaningful regressions, hidden
  information, and save/import integrity. Routine UI copy, styling, static card
  definitions, simple wiring, and already-covered effects usually need no new test.
- A production bug warrants the smallest regression check in the relevant existing
  test. Remove lower-value overlap to offset it; preserve distinct critical coverage.
- Whenever tests are touched, delete obsolete scenarios, redundant permutations,
  implementation-detail assertions, and unused fixtures/imports. Each case should
  cover one coherent behavior, not accumulate unrelated feature checks.
- When changing tests, report before/after suite counts and test lines, with a brief
  reason for any growth. Do not add test infrastructure or dependencies just to
  enforce these guidelines unless requested.

Run Tauri or native validation when the change involves `src-tauri`, Tauri APIs,
plugins, capabilities or permissions, native dialogs, filesystem integration,
window behavior, application lifecycle, packaging, or behavior that cannot be
verified accurately in the browser.

Do not run `npm run desktop:build` as a routine check. Release builds enable LTO
and are reserved for packaging, release validation, or changes whose correctness
depends on the packaged application.

## Working style

### Card architecture for a large catalog

- Give every distinct playable card its own module/file, even when multiple cards
  have identical effects. Only generated tokens or Bombs may share their source
  card's module.
- Do not add card-specific activation or selection UI text. Card modules must not
  supply custom prompt titles, instructions, labels, or text overrides to effect or
  cost helpers. Shared UI and mechanic libraries own generic activation text,
  derived from reusable selection data. Printed card effect text remains metadata.
- Contract is a subtype of both Actions and Conditions. Use `actionSubtype` for
  Action Contracts and `conditionSubtype` for Condition Contracts. Shared Contract
  mechanics must support both without changing their normal activation timing.
- Keep individual card rules in their card modules. Do not add card IDs, names, or
  one-card branches to shared combat, AI, UI, or game-flow files.
- When a card needs behavior the engine cannot express, add one reusable mechanic
  with a narrow contract. Make combat, AI, and display consume that contract, then
  implement the card through it. Avoid a second path for the same mechanic.
- Before finishing a new card, verify that another card with the same kind of effect
  could be added by editing only its card module, with focused tests only when the
  test maintenance policy warrants them.

- Keep searches and commands scoped; do not inspect generated dependency or build
  directories unless the task requires it.
- Keep implementations focused and avoid parallel abstractions that solve the same
  problem. Remove obsolete code made unnecessary by the change when it is safe and
  within scope.
- Search the codebase before creating a helper, component, hook, style, or utility.
  Reuse or extend an existing implementation when its responsibility naturally fits.
- For UI work, compose existing shared components and established styles before
  introducing new controls, dialogs, panels, cards, buttons, layout primitives, or
  visual patterns. Extract a shared component when repeated UI has the same behavior
  and meaning; do not force unrelated UI into a generic abstraction solely to reduce
  line count.
- Keep component APIs narrow and prefer one clear source of truth for shared behavior
  and visual states.
- Reuse an already-running development server or desktop process when practical.
- Explain briefly when native verification is necessary for a change that otherwise
  appears frontend-only.
- User instructions for a specific task override these defaults.
