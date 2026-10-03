# Devon and Arcade Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for root integration; two independent pure modules are delegated under superpowers:dispatching-parallel-agents.

**Goal:** Ship Devon, five preceding Arcade rivals, a visible progression screen, and direct Konami access.
**Architecture:** A small Arcade model owns the ordered run; a standalone movement module owns Devon's slide. Existing app and combat simulation consume those interfaces. Publish Devon's own curated sprite rows with shared identity, proportions and palette.
**Tech Stack:** JavaScript modules, Canvas/Phaser, Playwright, sprite-gen, Python sprite/collision tooling.
**Spec:** `docs/superpowers/specs/2026-10-01-devon-arcade-design.md` plus the user's later requirement for a hidden Konami shortcut and strict visual consistency.

## Global constraints

- Preserve all current workspace changes and existing palette/menu features.
- Five unique playable opponents excluding the player, then non-playable Devon; six matches exactly.
- Defeat/draw/loading failure retain progress. No repeated result may advance twice.
- Constant anatomy, costume and colors across Devon animations; inspect every generated row before publication.
- Use `novos_player_para_implementar/Devon.png` as the same identity reference for every row. Preserve head/body ratio, shoulder width, limb lengths, hat, glasses, beard and costume details. Pose changes must not introduce a different body build.
- Lock the reference palette: skin, black/charcoal clothing, hat, red glasses and purple effects. Reject unexplained hue changes between frames or states.
- Review every frame in contact sheets and animation playback against the original reference. Scale calibration may correct camera framing; it must not conceal distorted anatomy or replace visual review. Regenerate inconsistent rows before publishing.
- Slide respects arena bounds, does not move or automatically damage the opponent, and permits counterplay.
- Execute continuously: the user explicitly requested full implementation.

## Task 1: Progression model

- [x] Write failing `harness/arcade-run.test.mjs` for opponent sampling, stage sequence, six results and idempotency.
- [x] Implement `arcade-run.js`: `createArcadeRun`, `winArcadeMatch`, `arcadeProgress`.
- [x] Run unit tests to green; root reviews interfaces before app integration.

## Task 2: Devon slide

- [x] Write failing `harness/devon-slide.test.mjs` for directions, edges, moved targets, interruption and timing.
- [x] Implement `devon-slide.js`: `startDevonSlide`, `tickDevonSlide`, exported tuning constants.
- [x] Run unit tests to green; integrate into game update and body resolution with a simulation regression test.

## Task 3: Sprites and boss profile

- [x] Resolve sprite-gen account access and prepare a canonical row run using Devon.png.
- [x] Generate, extract, compose and curate Devon's required combat states with locked identity/palette/body proportions.
- [x] Review all poses and motion, reject defective rows, measure runtime scale and grounded alignment.
- [x] Publish only curated assets, add non-playable profile, build corresponding anatomy/collision data.

## Task 4: App and progression screen

- [x] Write a failing browser test covering the run, replay, boss shortcut and return to menus.
- [x] Add the six-portrait progress screen with grayscale victories, current opponent and boss treatment.
- [x] Integrate initial run, victories, loss/retry, conclusion, keyboard/controller navigation and asset failure recovery.
- [x] Enable real Devon loading through the existing Konami action, without adding him to normal character selection.
- [x] Capture desktop/mobile progress and boss gameplay; run checks, targeted suites and overall playtest.

## Review focus

- Repeated overlay callbacks or confirmation presses must not skip a rival.
- Returning from direct boss access must restore a playable opponent.
- Damage during travel must leave separated, in-bounds fighters.
- Aura and cloak silhouette must not artificially change hit reach or sprite scale.
- Any legacy harness assumptions about three matches or hidden options buttons must be updated to current user flows.

## Execution ledger

- Initial scope and implementation authorized by “faz o devon ai e implementa tudo”.
- Ruling: work in the existing workspace because it contains the user's active uncommitted selection, controls, palette and HUD changes. Do not create a clean checkout that loses them or commit those changes incidentally.
- Ruling: the hidden Konami access supersedes the earlier spec's harness-only access limit.
- Task 1 and Task 2 delegated to disjoint files; root owns app/game/assets integration.
- Task 1 pure model delivered: 6 unit tests passing. Task 2 pure slide module delivered: 9 unit tests passing. Engine and app integration remain pending.
- User reinforced visual consistency as a release requirement: proportions and colors must match Devon.png throughout all animations.

- Task 1 complete: reviewed the pure route model and verified the five unique rivals + boss, retries and idempotent results.
- Task 2 complete: integrated slide into CPU and engine update/body collision; engine regression test failed on missing boss before implementation and passed after.
- Task 3: generated 25 states / 104 unique transparent frames using the same original reference in every row; rejected and regenerated jump/special/super and turn after visual inspection. Automatic hat measurements were rejected because lightning highlights polluted the measurement. Ruling: calibrate each complete row against a reviewed first-pose height, preserving naturally folded pose height and applying only uniform scale.
- Task 4: browser scenario passed all six matches, loss/retry, grayscale status, responsive progression and real Konami shortcut. General playtest passed all 34 checks; secret menu and combo suites passed.
- Fresh-context reviewer found an advancing-win REVANCHE button bypassed progress. Added regression assertion, observed failure, hid the button when advancing, then full Arcade browser scenario passed.
- Ruling: preserve the current dirty workspace and leave changes available for the user; no merge, push or deployment is requested.
- Final verification after the last turn correction: sprite inspector reports no errors/warnings; collision suite passes all 5596 frames and 432 directional contacts; syntax/diff checks pass; 6 route tests, 9 slide tests and engine regression pass; real browser renders all 25 states and verifies crossing/recovery; six-match Arcade scenario and general 34-check playtest pass with no page errors. Secret and combo suites also passed. Desktop/mobile artifacts saved. No stride-validation claim is made (manual isolated-foot contact evidence was not authored).

- Independent visual review of final turn confirms stable bulky anatomy and original palette. Accepted delayed head tracking before final left pose; no blocking review findings remain. All four tasks complete; changes remain in the shared workspace.
