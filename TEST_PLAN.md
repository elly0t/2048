# Test Plan

Function-by-function test case enumeration. Companion to `TECHNICAL_DESIGN.md` (design rationale) and `*.test.ts` (implementations).

## TL;DR

- **218 unit + integration tests** (Vitest) cover the domain (board, moves, spawn, win-lose checks), the AI (heuristics, expectimax, suggestion + reasoning), and the store (`applyMove` 6-stage pipeline, `requestAdvice`, `modalOpen` + acknowledgement, motion inference).
- **~19 E2E specs** (Playwright, Chromium + WebKit) cover wiring seams unit tests can't reach: keyboard + touch input, localStorage round-trips, `<dialog>` lifecycle, AI observability hook, landscape phone layout, status colour tokens, and the 480px breakpoint boundary.
- **Pre-push hook** runs typecheck + lint + format + unit (E2E opt-in via `npm run e2e`).
- **High-signal artefacts:** the [common failure modes table](#cross-reference-common-failure-modes) below names the bugs this kind of game produces and points to the case that catches each.
- **Manual / device validation** lives in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md) (CPU-throttle latency) and the iOS Safari pass referenced in TD §3.3.

## Cross-reference: common failure modes

Common failure modes for this kind of game and where they are caught:

| Failure mode                             | Where addressed in this plan                                |
| ---------------------------------------- | ----------------------------------------------------------- |
| Win/lose timing wrong (post-spawn check) | GameStore.applyMove cases 1, 2, 5, 9; E2E §UI #4            |
| Spawn on no-op move                      | applyMove case 1; GameStore.applyMove case 1; E2E §UI #10   |
| AI module not tested                     | expectimax (10 cases), getSuggestion (12 cases); E2E §UI #2 |
| spawnTile errors on full board           | spawnTile case 3; E2E §UI #6                                |
| Score always 0                           | GameStore.applyMove case 7; E2E §UI #1, #12                 |
| Lose-by-spawn missed                     | checkLose case 9; GameStore.applyMove case 5                |
| Win-and-lose simultaneity                | GameStore.applyMove case 9                                  |
| Win silently cleared on continue         | E2E §UI #5                                                  |
| Only checks overall state                | E2E §UI assertions are deep — specific cells + exact deltas |
| Initial board untested (spec item 1)     | E2E §UI #13                                                 |
| Input leaks behind end-state overlay     | E2E §UI #14                                                 |

## Conventions

- Cases organised by module, then function.
- Each case: short input description, expected behaviour, and a one-liner on why it matters when non-obvious.
- "Pure" properties (no input mutation, returns new object) are tested once via a shared property-based test, not repeated per function.
- TD section references use §X.Y.

---

## Domain Layer

### compressRow(row)

Slides nulls toward index 0; values pack toward the right of the array per TD §4.3.

1. Empty `[null, null, null, null]`: unchanged. Identity case.
2. Already compressed `[2, 4, 8, 16]`: unchanged. Idempotency.
3. Single value at end `[null, null, null, 2]` becomes `[2, null, null, null]`. Verifies leftward slide.
4. All same value `[2, 2, 2, 2]`: unchanged. Compress is not merge (TD §4.3).
5. Interleaved nulls `[2, null, 4, null]` becomes `[2, 4, null, null]`. Order preservation.
6. Null at front `[null, 2, 4, 8]` becomes `[2, 4, 8, null]`.
7. Order with duplicates `[null, 2, 4, 2]` becomes `[2, 4, 2, null]`. The two `2`s do NOT merge here.
8. `0` treated as a value, not null: `[0, null, 0, null]` becomes `[0, 0, null, null]`. Tests `=== null`, not `Boolean()` truthiness.

### mergeRow(row)

Single left-to-right pass; merged tiles locked. Returns `{ row, scoreDelta }` per TD §4.3 rules 1–4.

1. No merges `[2, 4, 8, 16]` returns `{ row: [2, 4, 8, 16], scoreDelta: 0 }`. Rule 4.
2. Single pair `[2, 2, null, null]` returns `{ row: [4, null, null, null], scoreDelta: 4 }`.
3. Two independent merges `[2, 2, 2, 2]` returns `{ row: [4, null, 4, null], scoreDelta: 8 }`. Rule 3 (no double-merge); common bug. Pure-merge leaves the gap; the second `compressRow` in the move pipeline fills it.
4. Three same `[2, 2, 2, null]` returns `{ row: [4, null, 2, null], scoreDelta: 4 }`. Rule 2 (leftmost first).
5. Two non-overlapping pairs `[4, 4, 2, 2]` returns `{ row: [8, null, 4, null], scoreDelta: 12 }`.
6. Inner pair `[2, 4, 4, 8]` returns `{ row: [2, 8, null, 8], scoreDelta: 8 }`. Trailing `8` does not merge with the new `8`.
7. Non-compressed `[2, null, 2, null]` returns `{ row: [2, null, 2, null], scoreDelta: 0 }`. mergeRow alone does not compress (TD §4.3 rule 1).
8. Win-tile creation `[1024, 1024, null, null]` returns `{ row: [2048, null, null, null], scoreDelta: 2048 }`.
9. scoreDelta is the sum of merged values, not count: `[4, 4, 8, 8]` returns scoreDelta `24`.

### reflect(board)

Horizontal mirror per TD §4.3.

1. Empty board returns empty.
2. Asymmetric row `[[1, 2, 3, 4], …]` becomes `[[4, 3, 2, 1], …]`.
3. `reflect(reflect(b))` deep-equals `b`. Involution.
4. Returns new arrays at every level; original references unchanged.
5. Rows reflected, not columns: row order preserved; each row independently reversed.

### transpose(board)

Swap `[r, c]` and `[c, r]` per TD §4.3.

1. Empty board returns empty.
2. `[[1, 2, 3, 4], [5, 6, 7, 8], …]` becomes `[[1, 5, …], [2, 6, …], …]`.
3. `transpose(transpose(b))` deep-equals `b`. Involution.
4. Distinguishable from reflect: a board where `reflect(b)` is not equal to `transpose(b)`.
5. Returns new arrays at every level (no shared row references).

### applyMove(board, direction)

Per TD §4.3 and the spec examples in TD §7.2.

1. Empty board, any direction: `{ board, changed: false, scoreDelta: 0 }`. No spawn (TD §4.4 stage 2).
2. Full immovable board (checkerboard): `{ board: same, changed: false, scoreDelta: 0 }`.
3. Spec example, Move Left (TD §7.2). Verbatim.
4. Spec example, Move Right (TD §7.2). Verbatim.
5. Spec example, Move Up (TD §7.2). Verbatim.
6. Move Down on the same spec board. Closes the four-direction coverage.
7. Pure slide, no merge: `[[2, null, null, null], …]` Move Right becomes `[[null, null, null, 2], …]` with `changed: true, scoreDelta: 0`.
8. `changed: true` on slide-only moves (slide alone counts as a change).
9. Multi-row merges: scoreDelta accumulates across all rows.
10. Move that creates 2048: `scoreDelta: 2048`, `changed: true`. Triggers TD §4.4 stage 3.
11. Direction symmetry: a vertically-symmetric board produces mirrored outputs for Left and Right with equal scoreDelta.

### initBoard()

Per TD §4.1 rule 1 and §9.

1. Tile count within `INIT_TILE_COUNT.min..max` (default 2..8). Spec assumption #1; explicit in TD §7.2.
2. All placed tiles equal `2`.
3. No 2048 at init; never lose at init.
4. No duplicate positions within one call (sampling without replacement).
5. Returns a new board on each call.
6. Random tile count varies across many calls.
7. RNG injectable for deterministic tests, mirroring `spawnTile` signature.

### boardsEqual(a, b)

Used by TD §4.4 stage 2.

1. Same reference returns true.
2. Distinct identical boards return true. Deep equality.
3. Single-cell difference at `[0, 0]` returns false.
4. Single-cell difference at `[3, 3]` returns false. Confirms full traversal.
5. `null` versus `0` returns false. `null` is the canonical empty marker (TD §3.2).
6. After a no-op move, `boardsEqual(b, applyMove(b, d).board)` is true exactly when the move did not change `b`.

### spawnTile(board, rng?)

Per TD §4.1 rule 3, §9.

1. Empty board: places one tile; result has 15 nulls.
2. Single empty cell: tile lands there; result has 0 nulls.
3. Full board: **throws**. Caller bug — `GameStore` should detect lose state before spawning, so `spawnTile` being called on a full board is unreachable in correct usage. Surfacing the bug is preferable to silent no-op.
4. Spawned value is always `2` or `4`.
5. Spawn weight roughly 90/10 over many calls.
6. Spawn lands only on null cells; existing tiles preserved.
7. Returns a new board, does not mutate.
8. Deterministic with injected RNG: `rng = () => 0` spawns `2`; `rng = () => 0.95` spawns `4`.
9. Default RNG (no arg) uses `Math.random`.
10. Cell selection is uniform across empties.

### checkWin(board)

Per TD §4.1 rule 5, §9.

1. Board with `2048` returns true (TD §7.2 verbatim).
2. Board with only `4096` (no `2048`) returns false. `checkWin` is exact `=== winTile`; once `2048` evolves into `4096`, the function returns false. Won state is retained by `GameStore` (status stays `WON` once flipped), not by `checkWin` re-detection.
3. Max tile `1024`, no `2048`: false.
4. Empty board: false.
5. `2048` in any of the 16 positions: true. Verifies full scan.
6. Configurable `WIN_TILE` (e.g., 1024) is reflected.
7. String `"2048"` is not equal to number `2048`. Strict equality.

### checkLose(board)

Per TD §4.1 rule 6.

1. Lose board (TD §7.2 example, checkerboard): true.
2. Full board with at least one mergeable adjacent pair: false.
3. Any empty cell: false (slide-into-empty is a valid move).
4. Empty board or single tile: false.
5. Adjacent equals horizontally only on a full board: false.
6. Adjacent equals vertically only on a full board: false.
7. Diagonals equal but no row/column equals on a full board: true (diagonals do not merge).
8. Win tile present and no moves available: returns true. checkWin and checkLose are independent predicates; sequencing in store decides precedence (TD §4.4).
9. Spawn-fills-last-cell-causes-lose: a board with one empty cell that fills with no merges remaining returns true after the spawn, false before. Stage 5 of TD §4.4 depends on this.
10. All distinct values, full board (e.g. `[[2, 4, 8, 16], …]`): true.

---

## AI Layer

### Heuristic components: monotonicity, smoothness, cornerBonus, emptyCells

Per TD §5.3.

1. Empty board: each component returns a defined value (likely 0 or sentinel). Boundary.
2. `emptyCells` guarded against full board: `log₂(0)` would be `-Infinity`. Guard with `log₂(max(empty, 1))` or equivalent.
3. All same value: monotonicity high (non-strict trend), smoothness max (zero diffs).
4. Strictly increasing rows: monotonicity high.
5. Largest tile in corner versus centre: cornerBonus differs significantly.
6. Smoothness invariant under reflect/transpose (neighbour-difference sum).
7. Deterministic: same board returns same value.
8. `null` cells handled: no NaN from arithmetic on null.
9. `monotonicity` and `smoothness` skip null cells consistently — null carries no order signal, must not be treated as `log₂(0) = 0`. Two boards with the same real-tile trend score identically regardless of how nulls are positioned.
10. `cornerBonus` is invariant under iteration order — when the max tile appears in multiple cells (corner _and_ centre, or two corners), reward fires if _any_ corner holds the max. Bug pattern: `>` strict-greater + first-write-wins resolves ties by scan order rather than position.

### expectimax(board, depth)

Per TD §5.1, §5.2. `expectimax` is value-returning: returns a `number`. Direction selection lives in `getSuggestion`.

1. Depth 0 returns leaf heuristic; no recursion.
2. Depth 1 on lose board: no max-children; returns heuristic of current board.
3. Depth 3 on empty board (16 empties, worst-case branching) completes without timeout.
4. Chance node weighting uses 0.9 / 0.1, not uniform. TD §5.1 explicit formula.
5. Does not mutate input board.
6. Determinism: same `(board, depth)` returns same value across calls.
7. Performance: depth 3 within ~100ms on a midgame board (TD §5.2 estimate).
8. Heuristic at leaves uses full `H(board) = α·M + β·S + γ·log₂(E) + δ·C` per TD §5.3.

### getSuggestion(board)

Per TD §5.6, §11.

1. Standard board: direction in `{left, right, up, down}` and reasoning matches one of the rationale templates. TD §7.2 spec test.
2. Reasoning is the rationale clause only (no `"Move {Direction} — "` prefix; the direction label is rendered separately, bolded, by the UI).
3. Lose board: defined behaviour. Document the contract (return null, throw, or fallback).
4. Win board: still returns advice (continue-after-win, assumption #4).
5. Single-direction-only-valid: chooses that direction; three no-op directions get scored but are not selected. (Moved from expectimax — direction selection lives here.)
6. All-tied directions: deterministic tie-breaking. Required for reproducible advice (TD §5.6). (Moved from expectimax.)
7. Reasoning template selected by dominant heuristic delta per TD §5.6 step 3.
8. Generic template `"best overall position"` when all deltas under 5% of total score (TD §5.6).
9. Dominant delta computed against second-best direction, not third or worst.
10. `debug` populated with `{ scores, computedInMs, nodesEvaluated, depthSearched }` per TD §11.
11. All four direction scores present in `debug.scores`, including no-op directions.
12. Determinism: same board returns identical advice across calls, including identical `debug.scores`.
13. Side effects: `console.log('[AI]', advice)`, `window.__lastAdvice`, `window.__adviceHistory.push(advice)` per TD §11. Mocked in tests.
14. `AI_MODE='remote'` routes to fetch; `'local'` routes to expectimax. TD §5.5 code path. Remote failure (non-2xx or parse error) falls back to local suggestion so the UI never sees a rejected promise.

---

## Store / Sequencing Layer

### GameStore.applyMove(direction)

The 6-stage pipeline per TD §4.4. Most likely source of timing bugs for this kind of game.

1. Stage 2: no-change move. Board, score, status all unchanged; no spawn. TD §6.6 and §7.2.
2. Stage 3: move creates 2048. Status becomes WON; no new tile spawned. TD §6.6 and §7.2.
3. Stage 3: scoreDelta from the winning merge is included before the status flip. Score reflects the win-tile creation.
4. Stage 4: spawn after a valid non-winning move. Exactly one new tile (TD §7.2).
5. Stage 5: lose triggered post-spawn. A board with a single empty cell, where the spawn fills it and no merges remain, transitions to LOST. checkLose runs on `boardWithTile`, not `newBoard`. TD §4.4 stage 5.
6. Stage 5: lose NOT triggered when merges remain. A full board with adjacent equals stays in PLAYING.
7. Score increments cumulatively (`score += scoreDelta`), never reassigned. TD §6.5. Common bug: score stuck at 0.
8. `bestScore` updates on a new high; preserved across resets. TD §6.5.
9. Win-then-lose precedence: stage 3 returns before stage 4, so lose-after-win cannot fire. Final status is WON. TD §4.4.
10. Move while WON: continues per assumption #4; applyMove proceeds normally.
11. Move while LOST: defined behaviour (no-op or guarded). Document.
12. localStorage save on every valid move (TD §8); no save on a no-change move.
13. Board replaced by a new reference, not mutated in place. Subscribers see a new ref.
14. Explicit LOST guard: a mobile board with `status: LOST` stays unchanged. Without the guard the no-change early-return only catches structurally-immovable boards (case 11), so this case forces the explicit `status === LOST` check.
15. RNG injection consumed by `spawnTile`: passing `{ rng: () => 0 }` vs `{ rng: () => 0.99 }` produces different post-spawn boards from the same starting position. Catches the "constructor accepts opts.rng but discards it" failure mode.
16. Valid move while already WON still spawns. `checkWin` is `=== WIN_TILE`, so the stage-3 win branch fires on every move once 2048 exists. The win branch must gate on the WON _transition_ (status was not WON before this move), not on `checkWin` alone — otherwise post-win continuation drains the board with no new spawns.
17. `lastDirection` tracks the direction of the most recent board-changing move. `null` initially and after `reset()`. Used by `useGame` to drive motion inference; not part of game logic, just metadata.

### GameStore.isActive (getter)

Per TD §6.3 + assumption #4 (continue-after-win).

1. Returns `true` for PLAYING and WON; returns `false` for IDLE and LOST. WON is included so the player can keep moving past 2048 without resetting.

### GameStore.largestTile (getter)

Per TD §6.3.

1. Returns the maximum tile value across the board.
2. Returns `null` on a board with no tiles (avoids `Math.max()` returning `-Infinity` and avoids a `0` sentinel that could be confused with a real tile value).

### GameStore.reset()

Per TD §6.5.

1. `board = initBoard()`. Fresh random board.
2. `score = 0`; `bestScore` preserved. TD §6.5.
3. `status = PLAYING`. TD §6.4.
4. `advice = null`; `adviceLoading = false`.
5. localStorage updated with the new board; bestScore key untouched.
6. Reset on IDLE transitions to PLAYING (first-mount path).
7. Reset on WON or LOST starts a fresh game.

### GameStore.requestAdvice()

Per TD §6.5.

1. Synchronously sets `adviceLoading = true`; **last advice is preserved** (the UI dims it via `[data-loading="true"]` so a repeat tap doesn't flicker the line empty — TD §3.3 advice rendering contract).
2. On result: `advice = { direction, reasoning, debug }`; loading cleared.
3. Local mode: calls expectimax synchronously or as a Promise.
4. Remote mode seam: routing through `AI_MODE='remote'` reaches `remoteSuggestion`, which falls back to `localSuggestion` on any transport / parse error (TD §5.5 — remote provider not implemented). The store contract is the same either way: loading clears, advice is set.
5. Concurrent calls: end-state remains consistent — `adviceLoading=false` and a non-null `advice` after both resolve.
6. Determinism: same board returns identical advice across calls; `__adviceHistory` grows.
7. Does not mutate `this.board`.
8. In-flight guard: when called while `adviceLoading=true`, returns immediately without firing a duplicate `notify()` or a duplicate `getSuggestion` call.
9. Loading paint (manual, cross-browser): on Safari and Chromium, trigger Ask AI on a non-trivial board — "Computing…" must appear and stay ≥150ms before the result replaces it. Regression guard for the rAF + setTimeout yield (TD §3.3).

### GameStore.modalOpen / acknowledgedStatus / setAcknowledgedStatus

Per TD §6.3, §6.4. Drives the WON/LOST overlay show/hide without coupling presentation to status.

1. `modalOpen` is `true` when `status ∈ {WON, LOST}` and `status !== acknowledgedStatus`; `false` otherwise.
2. `setAcknowledgedStatus()` writes the current status into `acknowledgedStatus` (idempotent — repeated calls in the same status are no-ops, no extra `notify()`).
3. `reset()` clears `acknowledgedStatus` so a fresh game starts un-acknowledged.
4. Refresh-into-end-state path: hydrating with `status: WON` and no acknowledgement still surfaces the modal once (`modalOpen=true`); the StatusOverlay's lazy-init acknowledges immediately if mounting into an end-state to avoid re-prompting on refresh — see E2E §UI #9.
5. `applyMove` no-ops while `modalOpen=true` so a queued keypress can't slip past an open dialog.

---

## Hook Layer

### useGame load/save helpers

Per TD §8.

1. `loadGameState(raw)` returns a valid state object when JSON parses and matches shape (`{ board: 4×4 of number|null, status: GameStatus, score: number }`); returns `null` on parse failure or shape mismatch.
2. `loadBestScore(raw)` returns a finite non-negative number; returns `0` on missing or invalid input.
3. `saveGameState(state)` writes JSON to localStorage; tolerates `localStorage.setItem` throwing (private mode, quota exceeded) silently.
4. `saveBestScore(score)` same tolerance for write failures.

### useGame keyboard + init helpers

Per TD §3.3 (input) and §6.4 (status lifecycle).

1. `keyToDirection(key)` maps `'ArrowLeft'/'ArrowRight'/'ArrowUp'/'ArrowDown'` to the matching `Direction`; returns `null` for any other key (letters, Enter, Space, etc.).
2. `initStore(store)` hydrates the store from a valid saved state in `localStorage` (board, score, status restored).
3. `initStore(store)` falls back to `store.reset()` when the saved state JSON is invalid or the key is missing.
4. `initStore(store)` sets `bestScore` from `localStorage` when valid; defaults to `0` on missing or invalid input.
5. End-to-end: empty `localStorage` + fresh `GameStore` → after `initStore`, board has 2–8 tiles all equal to `2`, status is `PLAYING`. Holds the full chain (initStore → reset → initBoard) in one test so a reviewer doesn't have to chain transitively across two files.
6. `isAdviceKey(key)` returns `true` for `' '` (Space) and `false` for any other key (arrows, letters, Enter, Escape).
7. `swipeToDirection(startX, startY, endX, endY, threshold?)` maps swipe coordinate pairs to a `Direction` per TD §3.3. Threshold defaults to `30`. Returns `null` when both axes are below threshold (tap or accidental drift). Horizontal swipe wins when `|dx| > |dy|`: positive dx → `'right'`, negative → `'left'`. Vertical swipe wins when `|dy| ≥ |dx|`: positive dy → `'down'`, negative → `'up'`. Diagonal: greater absolute axis wins (standard 2048 convention).

### useGame motion inference (`inferMotions` + `MotionTracker`)

Per TD §3.4. Tile motion is a stream of `TileMotion[]` inferred from before/after boards plus the last direction; the overlay keys tiles by stable id so React reconciles same-DOM-node sliding cell to cell.

`inferMotions(prevBoard, prevIds, nextBoard, lastDirection)` satisfies:

1. Produces one motion entry per non-null cell in `nextBoard`.
2. Slide motion: `fromRow/fromCol` differ from `row/col`; `merged: false`; `spawned: false`.
3. Merge motion: target tile has `merged: true`; **plus** an additional "ghost" motion entry per consumed source tile so the source can be animated sliding into the target before unmounting (`hooks/motion.ts` emits source ghosts in the direction of travel).
4. Spawn motion: `spawned: true`; `fromRow/fromCol` equal `row/col` (no slide, fade-in only).
5. Output also includes the new id-board; ids of moved tiles persist; merged source ids are dropped; spawned cell gets a fresh id.
6. Determinism: same `(prevBoard, prevIds, nextBoard, lastDirection)` yields identical motions and id-board.
7. Ghost-tile ordering matches the merge direction (so the two source tiles slide visibly toward the merge cell, not away from it).

`MotionTracker` (lives in `useGame.ts`) wraps `inferMotions` to carry the id-board across renders:

8. Init: starts with a fresh id-board matching the initial board's non-null cells.
9. `track(prevBoard, nextBoard, direction)` invokes `inferMotions` with the cached id-board and updates the cache to the returned id-board.
10. `reset(board)` clears the id-board to match `board` so a `New Game` doesn't reuse old ids.

---

## UI Layer (E2E)

Playwright covers DOM/wiring seams unit tests can't reach. Browser matrix, fixtures, entry points: see TD §12.

1. All 4 directions (parameterised: Left, Right, Up, Down). Seeded board, arrow key, assert exact post-collapse cells, exact `scoreDelta`, and that one new tile has spawned.
2. Ask AI integration. Click → after resolve, `window.__lastAdvice` contains `{direction, scores, depth}` with `direction ∈ {left,right,up,down}`; reasoning text is one of the known rationale templates (no `"Move "` prefix — the direction is rendered separately, bolded, by the UI); button returns to enabled state (native `disabled=false`); `window.__adviceHistory.length` increments. Second click on the same board: same direction, history increments again.
3. Restart / new game. Play to non-zero score; Restart; exactly 2 tiles of value 2, `score === 0`, `bestScore` preserved.
4. WIN at spawn boundary. Seed `[..., 1024, 1024, ...]` row; ArrowLeft; WON overlay shown before the post-move spawn would have landed (status === WON in same tick as the merge).
5. WIN Continue keeps status WON. Click Continue; overlay closes; `status === 'won'` persists; subsequent moves succeed; Ask AI still returns advice (TD assumption #4).
6. LOST state, no crash. Seeded near-full board, lock with one move; LOST overlay shown with both buttons; no console errors; `spawnTile` not invoked post-lock.
7. LOST View Board dismisses. Click View Board; overlay closes; `status === 'lost'` persists; arrow keys no-op.
8. Refresh restores full state. Make moves; reload; board cells, score, and bestScore match pre-reload.
9. Refresh into end-state does NOT re-prompt. Drive to WON, refresh; overlay must not auto-open (lazy-init invariant, `StatusOverlay.tsx` L11–12).
10. No-spawn on no-op move. Wall-stacked `[2,4,8,16]` row; ArrowLeft; tile count and score both unchanged.
11. Touch swipe (WebKit only). iPhone viewport; horizontal touch gesture across `<main>` exceeding the 30px `swipeToDirection` threshold; same collapse + delta as #1 Left.
12. bestScore high-water mark. Play to X; refresh; play to Y > X; refresh; `bestScore === Y`.
13. Cold-load initial board. Clear localStorage; navigate to `/`; ≥1 non-null cell, all non-null values === 2, `score === 0`, status === PLAYING.
14. Input gated while overlay open. Drive to WON; press multiple arrow keys; board cells, score, and overlay all unchanged. Defends "tiles move behind modal" — native `<dialog>` inert blocks pointer/focus but not window-level keydown.
15. Landscape phone layout. Set viewport to 844×390 (iPhone landscape); assert board and Ask AI button both fully visible in viewport (`toBeInViewport({ ratio: 1 })`); CTA top edge ≥ board bottom edge (no occlusion). Defends the `@media (orientation: landscape) and (max-height: 500px)` rule.
16. Status colour on WON dialog. Drive to WON; dialog opens (~500ms after the spawn-settle delay); the title `[data-status="won"]` has computed `color` matching `--color-status-won` (gold). Manual visual check: header title also picks up the gold tint via the same token.
17. Status colour on LOST dialog. Drive to LOST; the dialog title `[data-status="lost"]` has computed `color` matching `--color-status-lost` (oxblood). Header LOST tint is intentionally a muted blue-grey, distinct from the dialog's louder accent.
18. Dialog spawn-settle delay. From the move that triggers WON/LOST, dialog `[open]` should not be true within the first ~480ms (gives the tile spawn animation time to land); becomes true around the 500ms mark. Regression guard for the `setTimeout(..., 500)` in `StatusOverlay.tsx`.
19. Constrained-column boundary at 480px. Set viewport to 479×900 → AIPanel renders fixed-bottom CTA (`position: fixed`); set viewport to 481×900 → AIPanel renders in-flow under the board (`position: static`, board-width). Defends the `@media (min-width: 480px)` boundary.

---

## Cross-cutting properties

Tested once as shared property tests, not repeated per function:

- Purity: every domain function returns a new object/array; never mutates input. Snapshot-and-compare runs each function with a frozen input.
- `null` is the only empty marker (TD §3.2). Predicates use `=== null`, never `Boolean()` or `== null`.
- Determinism of AI: no `Math.random` inside expectimax or getSuggestion. Same board produces same advice.
- Full-board assertions: all move/merge unit tests compare the entire 4×4 board before/after via `toEqual` rather than asserting affected rows only.

---

## Manual / device benchmarks

Not part of the automated suite. Recorded in [`bench/BENCHMARK_REPORT.md`](./bench/BENCHMARK_REPORT.md): the Node self-play harness (random / greedy / d2 / d3) and the browser-side d3 latency check on the deployed build under Chrome's "Low-tier mobile" CPU profile.
