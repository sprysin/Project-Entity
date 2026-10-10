---
target: Rules page chapter organization
total_score: 20
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\drake\\Documents\\Antigrav Google\\Project Entity\\src\\components\\rules\\RulesView.tsx"
target_fingerprint: "sha256:0877c3136be5885d2217848fd9e5caded1565496faddc415d62792a18f04ecf6"
target_path: "C:\\Users\\drake\\Documents\\Antigrav Google\\Project Entity\\src\\components\\rules\\RulesView.tsx"
timestamp: 2026-10-10T10-43-58Z
slug: src-components-rules-rulesview-tsx
---
# Rules page design critique

Read mode. Two independent assessments: design review and detector/browser evidence. Index visual evidence comes from the user-supplied screenshot; reading interactions and responsive behavior are source-reviewed only. Browser preview is blocked by desktop-only startup. No application code changed.

## Verdict

The page has a strong Project Entity identity, but its chapter structure needs more work than its styling. Fourteen equally weighted chapters mix foundations, gameplay and advanced reference. Preserve the gold, dark panels and actual cards; organize learning and retrieval first.

## Heuristic assessment (provisional)

| Heuristic | Score / 4 |
|---|---:|
| Status visibility | 3 |
| Match with reader expectations | 2 |
| User control | 3 |
| Consistency | 2 |
| Error prevention | 2 |
| Recognition over recall | 2 |
| Efficiency | 1 |
| Aesthetic and minimalist design | 3 |
| Error recovery | n/a: no input workflow |
| Help and documentation | 2 |
| Total | 20/36 |

These are design judgments, not measured usability results.

## Strengths

- Actual cards and restrained gold technical styling establish the game's identity.
- Combat, summoning and activation comparison tables suit the content.
- Start with the basics, explicit exits, selected states and short reading sections provide useful foundations.

## Priority issues

1. **P1: Prerequisite order is broken.** Responses & chains is chapter 4, before field, summoning, combat and Actions/Conditions. Its opening simultaneous-trigger ordering rule assumes knowledge not yet taught. Move chains after effects and timing, and explain simple responses before simultaneous triggers. Suggested workflow: impeccable clarify.
2. **P2: The flat chapter index hides the learning path.** The screenshot gives each chapter the same weight. Alternating gold/teal/purple colors cycle by index rather than meaning. Group chapters into named stages; use color consistently by stage or retain neutral rows. Suggested workflow: impeccable layout.
3. **P2: Labels and reading navigation obscure content.** Pawn Information includes position changes; setup includes loss/draw outcomes. Number-only chapter jumps require recall. Four-rule chunking creates Rules 1/2 instead of meaningful section names. Use a persistent named contents list and semantic sections; place core tables beside explanations. Suggested workflow: impeccable clarify.
4. **P2: Cover occupies too much of the reference experience.** The supplied screenshot places chapter navigation well below the title and decorative card fan. Reduce cover height, raise contents, and use compact grouped rows. Preserve the fan as identity, with less visual priority. Suggested workflow: impeccable layout.
5. **P2: Examples do not follow the topic.** Nearly every chapter resets to the same Pawn example. Show a field diagram for zones, a combat calculation for damage, a chain scenario for responses and a Land stack for Lands. Suggested workflow: impeccable onboard.

## Proposed organization

| Part | Reading order |
|---|---|
| Before your first duel | Goal & deck; Read your cards & field; Set up the duel |
| Play a turn | Turn sequence & drawing; Summon & position Pawns; Attack & combat; Actions & Conditions |
| Effects & special mechanics | Effects, costs & limits; Responses & chains; Lingering cards; Attach cards; Land cards; The Reserve |
| Quick reference | Named links to phases, summon requirements, combat outcomes, timing, Types, Attributes and terminology |

Move win/loss/draw conditions into Goal & deck. Keep card anatomy separate from position changes. Move recurring draw rules into the turn chapter. Retain individual special-mechanic destinations; grouping does not require one giant chapter. Types and Attributes can remain linked reference sections. Preserve all existing rule content during later restructuring.

## Cognitive load and reader journey

Fourteen peer choices, arbitrary page boundaries and numeric jumps create unnecessary memory work. The cover promises an engaging game; early advanced chain ordering can undermine beginner confidence. A first-duel learning path should reach setup, one turn and combat before advanced timing. Returning readers need direct access to named rulings.

## Persona findings

- First-timer: reaches advanced trigger ordering before learning Conditions timing.
- Returning player: cannot search or directly open a named subsection; comparison tables require additional navigation.
- Keyboard/low-vision reader: semantic controls and focus handling are positives; 29px chapter-jump targets, clipped outlines and responsive headings need rendered checking.

## Minor observations and evidence

The deterministic scan returned []: zero findings, zero false positives. This does not verify CSS or usability. Source shows external-link icons on internal chapter buttons, no Rules-specific reduced-motion handling, and mobile headline overrides worth verifying. Proofread doesnt and there red frame. The Reserve mentions Merge Pawns without explaining them. The screenshot establishes index appearance only; rendered reader and mobile checks remain unavailable.

## Decisions for the next step

1. Choose grouped individual chapters or a smaller set of broader chapters. Recommendation: grouped individual chapters.
2. Choose a guided first-duel default or an equal emphasis on learning and quick lookup. Recommendation: guided default with quick lookup always accessible.
