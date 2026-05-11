# Test Plan

Function-by-function test case enumeration. Companion to `TECHNICAL_DESIGN.md` (design rationale) and `*.test.ts` (implementations).

This is a living checklist. Cases discovered during build are added in the same commit as the test that catches them.

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
10. `cornerBonus` is invariant under iteration order — when the max tile appears in multiple cells (corner *and* centre, or two corners), reward fires if *any* corner holds the max. Bug pattern: `>` strict-greater + first-write-wins resolves ties by scan order rather than position.

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

Per TD §5.4, §11.

1. Standard board: direction in `{left, right, up, down}` and reasoning matches one of the templates. TD §7.2 spec test.
2. Reasoning string starts with `"Move "`. TD §7.2 spec test.
3. Lose board: defined behaviour. Document the contract (return null, throw, or fallback).
4. Win board: still returns advice (continue-after-win, assumption #4).
5. Single-direction-only-valid: chooses that direction; three no-op directions get scored but are not selected. (Moved from expectimax — direction selection lives here.)
6. All-tied directions: deterministic tie-breaking. Required for reproducible advice (TD §5.4). (Moved from expectimax.)
7. Reasoning template selected by dominant heuristic delta per TD §5.4 step 3.
8. Generic template `"Move {dir} — best overall position"` when all deltas under 5% of total score (TD §5.4).
9. Dominant delta computed against second-best direction, not third or worst.
10. `debug` populated with `{ scores, computedInMs, nodesEvaluated, depthSearched }` per TD §11.
11. All four direction scores present in `debug.scores`, including no-op directions.
12. Determinism: same board returns identical advice across calls, including identical `debug.scores`.
13. Side effects: `console.log('[AI]', advice)`, `window.__lastAdvice`, `window.__adviceHistory.push(advice)` per TD §11. Mocked in tests.
14. `AI_MODE='remote'` routes to fetch; `'local'` routes to expectimax. TD §5.4 code path.

---

## Store / Sequencing Layer

### GameStore.applyMove(direction)

The 6-stage pipeline per TD §4.4. Most likely source of timing bugs in past submissions.

1. Stage 2: no-change move. Board, score, status all unchanged; no spawn. TD §6.6 and §7.2.
2. Stage 3: move creates 2048. Status becomes WON; no new tile spawned. TD §6.6 and §7.2.
3. Stage 3: scoreDelta from the winning merge is included before the status flip. Score reflects the win-tile creation.
4. Stage 4: spawn after a valid non-winning move. Exactly one new tile (TD §7.2).
5. Stage 5: lose triggered post-spawn. A board with a single empty cell, where the spawn fills it and no merges remain, transitions to LOST. checkLose runs on `boardWithTile`, not `newBoard`. TD §4.4 stage 5.
6. Stage 5: lose NOT triggered when merges remain. A full board with adjacent equals stays in PLAYING.
7. Score increments cumulatively (`score += scoreDelta`), never reassigned. TD §6.5. Past failure: score stuck at 0.
8. `bestScore` updates on a new high; preserved across resets. TD §6.5.
9. Win-then-lose precedence: stage 3 returns before stage 4, so lose-after-win cannot fire. Final status is WON. TD §4.4.
10. Move while WON: continues per assumption #4; applyMove proceeds normally.
11. Move while LOST: defined behaviour (no-op or guarded). Document.
12. localStorage save on every valid move (TD §8); no save on a no-change move.
13. Board replaced by a new reference, not mutated in place. Subscribers see a new ref.
14. Explicit LOST guard: a mobile board with `status: LOST` stays unchanged. Without the guard the no-change early-return only catches structurally-immovable boards (case 11), so this case forces the explicit `status === LOST` check.
15. RNG injection consumed by `spawnTile`: passing `{ rng: () => 0 }` vs `{ rng: () => 0.99 }` produces different post-spawn boards from the same starting position. Catches the "constructor accepts opts.rng but discards it" failure mode.

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

1. Synchronously sets `adviceLoading = true`, `advice = null`.
2. On result: `advice = { direction, reasoning, debug }`; loading cleared.
3. Local mode: calls expectimax synchronously or as a Promise.
4. Remote mode: fetch failure clears loading and either sets advice to null or surfaces an error.
5. Concurrent calls: end-state remains consistent — `adviceLoading=false` and a non-null `advice` after both resolve.
6. Determinism: same board returns identical advice across calls; `__adviceHistory` grows.
7. Does not mutate `this.board`.
8. In-flight guard: when called while `adviceLoading=true`, returns immediately without firing a duplicate `notify()` or a duplicate `getSuggestion` call.

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

### useGame motion inference (deferred — time-permitting)

Per TD §3.3 deferred-polish bullet. Tile animations and the stable-ID identity tracking that drives them ship only if time permits after the static UI is complete. The DOM is structured to receive them without restructuring (slot grid + absolute-positioned tile overlay is already in place).

When implemented, `inferMotions(oldBoard, oldIds, newBoard, direction)` is expected to satisfy:

1. Produces one motion entry per non-null cell in `newBoard`.
2. Slide motion: `fromRow/fromCol` differ from `row/col`; `merged: false`; `spawned: false`.
3. Merge motion: target tile has `merged: true`; the consumed source tile is not present in the output (it animates by sliding into the target, then the merged flag triggers the pop).
4. Spawn motion: `spawned: true`; `fromRow/fromCol` equal `row/col` (no slide, fade-in only).
5. Output also includes the new id-board; ids of moved tiles persist; merged source ids are dropped; spawned cell gets a fresh id.
6. Determinism: same `(oldBoard, oldIds, newBoard, direction)` yields identical motions and id-board.

---

## UI Layer (E2E, time-permitting)

Manual browser testing covers these by default. If time, Playwright E2E tests on the running dev server:

1. Arrow key dispatches a move; tile slides and score updates.
2. AI panel button click → reasoning string appears; loading state visible during fetch.
3. WON state → status overlay shown; Continue dismisses (status stays WON, play continues); Restart starts fresh.
4. LOST state → status overlay shown with Restart only.
5. Refresh page mid-game → board, score, bestScore restored from localStorage.

---

## Cross-cutting properties

Tested once as shared property tests, not repeated per function:

- Purity: every domain function returns a new object/array; never mutates input. Snapshot-and-compare runs each function with a frozen input.
- `null` is the only empty marker (TD §3.2). Predicates use `=== null`, never `Boolean()` or `== null`.
- Determinism of AI: no `Math.random` inside expectimax or getSuggestion. Same board produces same advice.

---

## Cross-reference: past-comment patterns addressed

Patterns extracted from prior reviewer comments and where they are caught:

| Past failure pattern                     | Where addressed in this plan                    |
| ---------------------------------------- | ----------------------------------------------- |
| Win/lose timing wrong (post-spawn check) | GameStore.applyMove cases 1, 2, 5, 9            |
| Spawn on no-op move                      | applyMove case 1; GameStore.applyMove case 1    |
| AI module not tested                     | expectimax (10 cases), getSuggestion (12 cases) |
| spawnTile errors on full board           | spawnTile case 3                                |
| Score always 0                           | GameStore.applyMove case 7                      |
| Lose-by-spawn missed                     | checkLose case 9; GameStore.applyMove case 5    |
| Win-and-lose simultaneity                | GameStore.applyMove case 9                      |
