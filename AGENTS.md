# Project Entity development guidance

## Validation strategy

Use the fastest validation path that covers the changed behavior.

For React, CSS, game rules, and TypeScript-only changes:

- Prefer targeted Vitest tests while iterating.
- Before finishing, run `npm test`, `npm run typecheck`, and `npm run build` when proportional to the change.
- Do not launch the desktop app or compile Rust solely to validate frontend-only work.
- Use `npm run dev:frontend` when interactive browser validation is useful.

## Test suite budget

- Keep the suite streamlined, with a target ceiling of approximately 30 executable
  test cases for the project unless the user explicitly approves a larger suite.
- The existing suite is above this target. Do not add net-new test cases by default;
  when changing covered behavior, consolidate related scenarios until the suite moves
  toward the target.
- Before adding a test, search for coverage of the same behavior. Extend or combine
  an existing test when that remains clear and provides equivalent regression value.
- Whenever tests are touched, remove or consolidate tests that are redundant, test
  superseded behavior, duplicate lower-level coverage, or assert implementation
  details without protecting user-visible behavior or an important invariant.
- Preserve distinct high-value regression coverage. Do not delete a meaningful test
  merely to satisfy the numeric target; combine cases with table-driven assertions or
  broader behavioral flows when practical.
- Production bugs should still receive regression coverage. Offset a necessary new
  case by consolidating lower-value overlap elsewhere when possible.

Run Tauri or native validation when the change involves `src-tauri`, Tauri APIs,
plugins, capabilities or permissions, native dialogs, filesystem integration,
window behavior, application lifecycle, packaging, or behavior that cannot be
verified accurately in the browser.

Do not run `npm run desktop:build` as a routine check. Release builds enable LTO
and are reserved for packaging, release validation, or changes whose correctness
depends on the packaged application.

## Working style

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
