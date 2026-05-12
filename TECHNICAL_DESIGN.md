# Technical Design Document: 2048

This document explains the design decisions behind the implementation. Architectural decisions are documented here before implementation — if a better approach emerges during development, this document is updated to reflect it.

---

## 1. Assumptions

The spec leaves several values unspecified. All assumptions are externalised to `config.ts` — logged to console on start, and configurable by editing the file directly.

| #   | Assumption                                  | Reason                                                                                                                                          |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Initial board places 2–8 tiles of value `2` | Spec says "random number of 2s" — range matches density of the spec example                                                                     |
| 2   | Spawn probability: 90% for `2`, 10% for `4` | Spec says "a 2 or 4" — standard 2048 convention                                                                                                 |
| 3   | Score = sum of all merged tile values       | Standard 2048 scoring convention — same as the original game                                                                                    |
| 4   | Win state allows player to continue         | Spec detects win but does not say game ends — continue or restart offered                                                                       |
| 5   | Expectimax depth = 3                        | See §5.2 for rationale & phase 2 adaptive depth that was spotted during implementation.                                                                   |
| 6   | AI uses local Expectimax search             | Local search keeps tests deterministic and needs no setup. Remote provider available via `CONFIG.AI_MODE` — see §5.4.                           |

---

## 2. Tech Stack

| Tool                  | Why                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React**             | Component model fits tile-based grid UI naturally                                                                                                                                                                                   |
| **TypeScript**        | Static types — catches indexing and merge bugs early                                                                                                                                                                                |
| **Vite**              | Native ESM dev server — instant startup, no webpack bundling overhead                                                                                                                                                               |
| **Vitest**            | Shares Vite's config, aliases, and transforms — no duplicate pipeline. `npm test` works out of the box.                                                                                                                             |
| **Plain class store** | Framework-agnostic, injectable, testable without React                                                                                                                                                                              |

---

## 3. System Architecture

### 3.1 Layers

```
┌──────────────────────────────────────┐
│            View Layer                │
│   React components — render only     │
│   React.memo on stable components    │
├──────────────────────────────────────┤
│          ViewModel Layer             │
│   GameStore — plain class            │
│   No React imports                   │
│   Tested independently of React      │
├──────────────────────────────────────┤
│           Domain Layer               │
│   board.ts · moves.ts                │
│   heuristics.ts · expectimax.ts      │
│   Pure functions, zero side effects  │
└──────────────────────────────────────┘
```

`GameStore` has zero React imports, so game logic runs and tests in plain Node. Domain functions stay pure for the same reason — easy to test in isolation. That separation is what makes the MVVM split worth it here, not the label.

### 3.2 Domain Language

Each domain concept gets its own type so signatures read as domain (`Board`, `Direction`, `MoveResult`) instead of primitives like `(number | null)[][]`.

Domain types live in `domain/types.ts`. Const-backed types (`Direction`) live alongside their runtime const object (`DIRECTION`). Module-specific types live with their module — `AIAdvice` in `src/ai/types.ts`, `GameStatus`/`STATUS` (when added) in `src/store/types.ts`.

| Concept      | Where                | Shape                                                               |
| ------------ | -------------------- | ------------------------------------------------------------------- |
| `Board`      | `domain/types.ts`    | `Row[]` (alias chain: `Cell = number \| null`, `Row = Cell[]`)      |
| `Direction`  | `domain/types.ts`    | `'left' \| 'right' \| 'up' \| 'down'`                               |
| `MoveResult` | `domain/types.ts`    | `{ board, changed, scoreDelta }`                                    |
| `GameStatus` | `store/types.ts`     | `'idle' \| 'playing' \| 'won' \| 'lost'` *(pending §6 build)*       |
| `AIAdvice`   | `ai/types.ts`        | `{ direction, reasoning, debug }` *(pending §5.4 getSuggestion)*    |

### 3.3 UI Layout

Three-row shell: full-bleed top bar / centred board / bottom AI CTA. Responsive via a single 768px breakpoint — same DOM, the swap is button label/size and CTA positioning, not a layout reflow.

**Breakpoint system:** standard sm/md/lg/xl tokens (640/768/1024/1280 px) in `tokens.css`; only `md` (768) is structurally active here — the layout has one mobile↔desktop boundary.

```
Mobile (<768px)                       Desktop (≥768px)
┌──────────────────────────┐          ┌──────────────────────────────────────┐
│ 2048   SCORE BEST   ↺    │          │ 2048      SCORE BEST     [New Game]  │
├──────────────────────────┤          ├──────────────────────────────────────┤
│                          │          │                                      │
│   ┌────┬────┬────┬────┐  │          │       ┌────┬────┬────┬────┐          │
│   │  2 │    │  4 │    │  │          │       │  2 │    │  4 │    │          │
│   ├────┼────┼────┼────┤  │          │       ├────┼────┼────┼────┤          │
│   │    │  8 │    │  2 │  │          │       │    │  8 │    │  2 │          │
│   ├────┼────┼────┼────┤  │          │       ├────┼────┼────┼────┤          │
│   │    │    │  4 │    │  │          │       │    │    │  4 │    │          │
│   ├────┼────┼────┼────┤  │          │       ├────┼────┼────┼────┤          │
│   │  2 │  4 │    │ 16 │  │          │       │  2 │  4 │    │ 16 │          │
│   └────┴────┴────┴────┘  │          │       └────┴────┴────┴────┘          │
│                          │          │                                      │
│                          │          │          [✨ Ask AI (Space)]         │
├──────────────────────────┤          │                                      │
│  [✨ Ask AI (Space)]     │ ← fixed  └──────────────────────────────────────┘
└──────────────────────────┘
```

**Top bar (full viewport width, both viewports):**
- Title "2048" on the left.
- Score and Best pills in the centre.
- Restart on the right: circular-arrow icon on mobile (`aria-label="New game"`), "New Game" text on desktop.

**Board area (centred, both viewports):**
- 4×4 grid coloured by `log₂(rank)` via a generative HSL function in `palette.ts` (runtime, applied as inline style on Tile). Empty cells stay visible (`var(--color-cell-empty)` from `tokens.css`).
- Static 4×4 cell layer with an absolute-positioned tile overlay on top. The overlay keys tiles by stable id; slide / spawn / merge-pop animations are driven by CSS transitions on the standalone `translate` property (see §3.4). `prefers-reduced-motion` zeroes every motion token.

**AI CTA (bottom, both viewports):**
- Mobile (<768px): fixed to the bottom of the viewport, full-width. Thumb-zone friendly.
- Desktop (≥768px): normal flow below the board, board-width, centred.
- Click or press `Space` to request a suggestion. Loading state shows "Computing…" inline. Result direction + reasoning template (§5.4) renders below the button.
- Loading paint: the `adviceLoading=true` render is followed by `requestAnimationFrame(() => setTimeout(0))` before sync expectimax — bare `setTimeout(0)` never painted on Safari (WebKit coalesces short tasks; Chromium opportunistically paints between them).

**Other:**
- Status overlay: centred modal on win or lose. WON shows Continue (dismiss; play continues per assumption #4) + Restart. LOST shows View board (dismiss to inspect the final locked state) + Restart. Dismissed state is held locally; refresh-while-WON keeps the modal closed.
- Persistent end-state cue: a subtle colour tint on the Header title (`<h1>`) via `data-status="won|lost"` — gold for WON, muted grey for LOST. No separate banner / no decorative chrome.
- Input: arrow keys (moves) and `Space` (advice) captured at window level. On touch devices, finger swipes on the `<main>` content area produce moves — horizontal/vertical axis chosen by the greater absolute delta, with a 30px threshold to filter accidental drift. Swipe and keyboard converge on the same `applyMove(direction)` action; no source distinction at the store level. No on-screen direction buttons.
- Components consume state via the `useGame` hook (§10, `src/hooks/useGame.ts`) using `useSyncExternalStore`; they never reach into `GameStore` directly.
- Accessibility floor: semantic `<button>` for actions, `aria-live="polite"` on score and advice text, `aria-label` on the mobile icon-only restart button, `role="dialog"` + `aria-modal="true"` on the status overlay, palette tuned for ≥4.5:1 contrast on tile text.

### 3.4 Tile Motion

Motion is a stream of `TileMotion[]` inferred from before/after boards plus the last direction (`hooks/motion.ts`). Three kinds: survivors (slide), consumed merge sources (ghost — slides to destination then unmounts), freshly spawned tiles. The overlay keys tiles by stable id so React reconciles them across moves — same DOM node, sliding cell to cell.

**Two-beat timing.**

```
0ms ──── 180ms ──── 240ms ─────── 490ms
[slide ────────────]
[pop (if merge) ───]
                    [spawn ────────────────]
```

Slide (180ms) and merge-pop (200ms) run concurrent; spawn (250ms) is delayed 240ms so new tiles land after the board settles. Easing is `cubic-bezier(0.16, 1, 0.3, 1)` for both — bounce comes from the pop keyframe shape (`scale: 1 → 1.15 → 1`).

---

## 4. Core Domain Logic

Move processing is layered. `GameStore` handles state transitions and sequencing (§4.4); `moves.ts` handles the row-level transform (§4.3); `compressRow` and `mergeRow` are the per-row primitives. Reading top-down:

```
GameStore.applyMove(direction)                       ← store method, 6-stage sequencing (§4.4)
   │ calls
   ▼
applyMove(board, direction)                          ← dispatcher (4-way switch — §4.3)
   │
   ├── moveLeft                                      ← canonical operation
   ├── moveRight  = reflect → moveLeft → reflect
   ├── moveUp     = transpose → moveLeft → transpose
   └── moveDown   = transpose∘reflect → moveLeft → reflect∘transpose
                       │
                       ▼ for each row
                  compressRow → mergeRow → compressRow
```

### 4.1 Game Rules

Six rules from the spec govern all gameplay. Configurable values live in `config.ts`:

| #   | Rule           | Detail                                                                                                                            |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Init           | Start with a random number of `2` tiles at random cells. Range `INIT_TILE_COUNT` (default 2–8)                                    |
| 2   | Move           | Slide all tiles in the chosen direction, merging adjacent equals (see 4.3). Triggered by arrow keys.                              |
| 3   | Spawn          | After a valid move, one new tile spawns at a random empty cell — `2` with 90% probability, `4` with 10%. Weights: `SPAWN_WEIGHTS` |
| 4   | No-change move | If the move does not change the board, no spawn happens                                                                           |
| 5   | Win            | The `WIN_TILE` (default 2048) appears on the board                                                                                |
| 6   | Lose           | No valid move exists in any direction                                                                                             |

### 4.2 Data Structure: 2D Array over Bitboard

Board is a plain `(number | null)[][]`. Bitboard representation (packing the board into a 64-bit integer, 4 bits per cell storing the tile exponent) was considered and rejected.

### Complexity analysis

Each move processes 4 rows of 4 cells, a single linear pass per row:

```
moveLeft = O(4 rows × 4 cells) = O(16) = O(1)
```

The board is fixed size. Every move is constant time regardless of representation.

Bitboard + LUT precomputation yields ~5–10× speedup. At the depth-3 target (~110ms baseline in pure JS), 10× brings latency to ~11ms; both are well under any UX threshold. The speedup only earns its complexity when the baseline crosses into perceptible territory: at depth 5 (~400ms+ in pure JS), 10× to ~40ms is a real UX difference worth pursuing.

If depth or board size grows, Bitboard + LUT is a natural phase 2 — confined to the domain layer; `MoveResult` and `GameStore` insulate the rest.

### 4.3 Move Pipeline

Merge logic exists in exactly one place: `mergeRow`. When a merge bug is found or behaviour changes, there is one function to fix and one set of tests to update. No risk of fixing `mergeLeft` and forgetting `mergeRight`. Direction handling is pure geometry (reflect, transpose — see §4 opener), completely separate from merge logic; neither knows about the other.

Within `moveLeft`, each row passes through `compressRow → mergeRow → compressRow`:

```
Input:    [2, 2, null, 2]
compress: [2, 2, 2, null]     pack values toward index 0
merge:    [4, null, 2, null]  merge adjacent equals
compress: [4, 2, null, null]  pack again to fill the gap
```

`compressRow` and `mergeRow` always work toward index 0 — the start of the array. They take no direction parameter. Player direction (Move Left/Right/Up/Down) is mapped to a left-pass via the reflect/transpose pipeline above, so these row primitives only ever solve one problem: pack values to the front, merge adjacent equals.

### Merge rules

Purpose-built examples isolating each rule, shown as Move Left:

```
Rule 1: nulls compressed out toward the move direction before merging
  Move Left:
    [2, null, 2, null]  →  [2, 2, null, null]    compress nulls leftward
                        →  [4, null, null, null]  then merge adjacent equals
  Without compress first: the two 2s never become adjacent.

Rule 2: single pass in the move direction — first eligible pair merges first
  Move Left (left-to-right pass):
    [2, 2, 2, null]     →  [4, 2, null, null]    (not [2, 4, null, null])
  The leftmost pair merges. The remaining 2 has no partner.

Rule 3: a merged tile cannot merge again in the same move
  Move Left:
    [2, 2, 2, 2]        →  [4, 4, null, null]    (not [8, null, null, null])
  First pair merges to 4. That 4 is locked — cannot absorb the next 2.
  Second pair merges independently.

Rule 4: no merge if no adjacent equals after compressing
  Move Left:
    [2, 4, 8, 16]       →  [2, 4, 8, 16]         unchanged
```

For Move Right, Up, Down, the same rules apply but in the corresponding direction. The transform pipeline (reflect, transpose) ensures `mergeRow` only ever sees a left-to-right problem. The transforms themselves are tested independently: `reflect(reflect(board)) === board`, `transpose(transpose(board)) === board`.

`MoveResult` returned by `applyMove`:

```ts
{
  board: Board,        // new board state
  changed: boolean,    // did any cell move or merge?
  scoreDelta: number   // sum of all merged tile values this move
                       // e.g. [2,2]→4 and [4,4]→8 in one move = scoreDelta: 12
}
```

`changed` is detected by snapshot comparison: after the row pipeline runs, each output row is compared cell-by-cell to its input; if any row differs, the move counts as changed. The alternative is to have each pipeline function (`compressRow`, `mergeRow`) report whether it changed something alongside its output — cleaner attribution but more API surface. Snapshot is simpler and sufficient at the 4×4 scale.

### 4.4 Move Sequencing

The order of operations in `GameStore.applyMove()` matters; incorrect sequencing is a common source of win/lose bugs.

```
1. newBoard = applyMove(board, direction)
2. boardsEqual(board, newBoard)  → if true: return unchanged (no spawn)
3. checkWin(newBoard)            → if true: status = 'won', return (no spawn)
4. boardWithTile = spawnTile(newBoard)
5. checkLose(boardWithTile)      → if true: status = 'lost'
6. update state
```

Each stage has a dedicated test. Stage 2 guards against spawning on a no-change move. Stage 3 guards against spawning after a win. Stage 5 runs `checkLose` on `boardWithTile` (post-spawn), not `newBoard`, because a spawn that fills the last empty cell with no available merges can itself trigger the lose state.

---

## 5. AI Strategy: Local Expectimax

### 5.1 Why Expectimax, Not Minimax

Tile spawns in 2048 are random, not adversarial — that's the wrong shape for minimax. Minimax assumes two players (one maximising, one minimising), so it would model the spawn as the worst tile always landing in the worst slot. The AI ends up playing scared.

Expectimax fits the actual game: chance nodes weight outcomes by their real spawn probabilities.

```
P(tile = 2) = 0.9,  P(tile = 4) = 0.1
Chance node = 0.9 × value(board with 2) + 0.1 × value(board with 4)
```

How the search produces a score: from the current board, the search recurses into every reachable future — every player move (max layer) and every spawn outcome (chance layer, weighted 0.9 for a 2 and 0.1 for a 4) — until the depth limit, where each end-state board is scored by the heuristic (§5.3). Those scores aggregate back up: chance layers averaging their children, max layers picking the best. The value at the top is the expected outcome under optimal play — every reachable continuation already factored in.

### 5.2 Search Depth: Why Depth 3

Depth 3 looks 3 player moves ahead, alternating with chance nodes:

```
Move 1: your 1st move     (Max node — 4 choices)
        → tile spawns     (Chance node — ~12 outcomes per empty)
Move 2: your 2nd move     (Max node — 4 choices)
        → tile spawns     (Chance node)
Move 3: your 3rd move     (Max node — 4 choices)
        → tile spawns     (Chance node)
        → evaluate with heuristic
```

Depth 1 is purely greedy: sees only immediate merges. Depth 3 evaluates **setup moves**: an early move that creates a clean large merge later.

Depth table (estimated; actual values will be measured during build):

```
Depth | Approx midgame nodes | Time (pure JS) | Assessment
  2   |    ~2,300            |  ~2ms          | Misses setup chains
  3   |  ~110,000            |  ~100ms        | Tractable in pure JS, captures setups
  4   | ~5,300,000           |  ~1–5s         | Requires sampling/pruning; out of scope
```

Each ply branches `4 directions × 2·|empties|` = `8·|empties|` (every empty cell can get a 2 or a 4). The table assumes midgame `|empties|=6`, giving `48` per ply and the `48^d` numbers. Real spread:

```
early ~14 empties  →  112 per ply  →  d=3 ≈ 1.4M   (~13× midgame)
mid   ~6  empties  →   48 per ply  →  d=3 ≈ 110k   (what the table shows)
late  ~2  empties  →   16 per ply  →  d=3 ≈ 4k     (~27× lower)
```

Phase 2 below leans on this spread.

Pure JS without bitboard or chance-node sampling tops out around ~1M heuristic evals/sec. Depth 4 (5.3M nodes) needs sampling or the bitboard + LUT approach, both deferred to phase 2. Section 5.4 documents the swap path to nneonneo (depth 8 in C++) if stronger play is needed.

`EXPECTIMAX_DEPTH = 3` is a named constant in `config.ts`.

### Phase 2: adaptive depth

While writing the code I found one obvious thing. Branching scales hard with number of empties across the board (14 → 28 children per chance node, 2 → 4) but the depth doesn't move. ~100× spread, same budget across all of it.

Therefore depth 3 overspends early game, where there's already plenty of room, and underspends late game, where branches are cheap and looking 4–5 plies ahead would actually pay off.

The improvement that falls out: `computeDepth(board)` keyed off `|empties|`. Shallower when branching's high, deeper when small. After doing some maths to verify I also checked against nneonneo's 2048-ai afterwards: they scale depth 3→8 by distinct-tile count — same instinct, different keying function. Good signal that the move's the right one.

Wiring is small. The recursion already takes `depth` as a parameter, so it can be linked up with a dynamic function `computeDepth(board)`, table-driven in `config.ts` (sketch: `≥10 → 2`, `5–9 → 3`, `≤4 → 4`). Explicit-depth tests keep passing untouched.

The fixed-depth-3 benchmark (`bench/BENCHMARK_REPORT.md`) confirms the keying logic: depth 3 dominates depth 2 on 4096 reach rate (27% vs 14%) and mean score (+17%), but mean ms/move at depth 3 is ~74ms vs depth 2's ~1.5ms — exactly the sparse-board cost adaptive depth would avoid. Empirical baseline before tuning.

### 5.3 Heuristic Function

When Expectimax hits maximum depth it estimates board quality via a scoring formula: the **leaf node heuristic**. Without it all leaf nodes score equally and the algorithm cannot compare them.

```
H(board) = α·Monotonicity + β·Smoothness + γ·log₂(EmptyCells) + δ·CornerBonus
```

| Component            | What it measures                                          | Why it matters                                                                                                                    |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Monotonicity**     | Sorted rows (ascending or descending) score 0; zigzag rows pay | Keeps large tiles ordered, prevents fragmentation                                                                                 |
| **Smoothness**       | Adjacent tiles have similar values                        | Close values merge sooner                                                                                                         |
| **log₂(EmptyCells)** | Available space                                           | More space = more options. `log₂` because each extra cell is worth less than the previous: 0→1 empty is huge, 9→10 barely matters |
| **CornerBonus**      | Largest tile anchored to any corner                       | Frees the rest of the board for merging                                                                                           |

All heuristics use **log₂ space** — gaps between tiles become merge-distances. So `(2, 4)` and `(1024, 2048)` are both 1 merge apart and weighted equally. In raw values they differ by 500× and big tiles would dominate the heuristic regardless of structure.

**Sign convention.** Monotonicity and smoothness return `≤ 0` (penalty: 0 for ideal, negative for disorder). Empty cells and corner bonus return `≥ 0` (reward). The aggregator `H = α·M + β·S + γ·log₂(E) + δ·C` mixes both; higher H = better board. The `log₂` term is guarded against `log₂(0) = -∞` by `log₂(max(empties, 1))`, so a full board scores 0 on that term rather than blowing up the sum.

Why a multi-component heuristic matters more than score alone:

```
Same game-score, different positions:
  Board A:  score=128, largest tile centred, fragmented      → one move from losing
  Board B:  score=128, largest tile in corner, monotonic rows → safe and clean

Score-only H treats them as equal.
Multi-component H scores Board A=340 vs Board B=850 — algorithm correctly avoids A.
```

Weights:

```
α (Monotonicity) = 1.0
β (Smoothness)   = 0.1
γ (Empty cells)  = 2.7
δ (Corner)       = 1.0
```

These values come from nneonneo's published 2048 AI analysis (the same StackOverflow answer that documents the algorithm). Tuning from scratch needs hundreds of trial games — out of scope here. Cited in `heuristics.ts`.

### 5.4 AI Suggestion & Human-Readable Reasoning

The AI suggestion pipeline returns the best direction along with plain-English reasoning. Internally, `expectimax` is value-returning: it takes a board and a depth and returns a single number. `getSuggestion` runs the per-direction loop — calling `expectimax` once per direction, capturing all four scores (including no-ops, for debug), picking the max, and deriving the reasoning template from heuristic component deltas. Both the move and the reasoning are deterministic and fully testable.

### nneonneo as the alternative

nneonneo/2048-ai (1.2k stars) was the primary alternative considered: Expectimax with a bitboard representation (64-bit int = 16 cells × 4 bits, tile exponent) plus a precomputed LUT for row transforms, searching ~10M positions/second. At depth 8 it reaches the 2048 tile in 100% of games and 16384 in 94% (nneonneo's own 100-game benchmark).

Local choice: pure JS Expectimax at depth 3, same heuristics, no setup, directly unit testable. `getSuggestion` is the single swap point — flipping `CONFIG.AI_MODE` to `'remote'` and starting the Docker container leaves the game engine untouched.

### Swap path via Docker

Docker keeps the swap reproducible: pinned C++ toolchain, Python version, and library versions in one container, started with `docker-compose up` regardless of host OS — no Xcode setup, no platform-specific compilation. Behind the wrapper: nneonneo's compiled C++ binary, a thin Flask `POST /suggest`, and board-format translation (2D array ↔ 64-bit bitboard).

```ts
// src/ai/getSuggestion.ts
export async function getSuggestion(board) {
  const advice =
    CONFIG.AI_MODE === AI_MODES.REMOTE ? await remoteSuggestion(board) : localSuggestion(board);
  emitSideEffects(advice); // console.log + window.__lastAdvice + history (TD §11)
  return advice;
}
```

`AI_MODES.LOCAL` is the default. Components and `GameStore` call `getSuggestion` regardless of mode — nothing else in the codebase changes.

Benchmark (full write-up in `bench/BENCHMARK_REPORT.md`):

```
Implementation:   Own Expectimax, depth 3
2048 reach rate:  77% (n=100, Wilson 95% CI [67.8, 84.2])
Reach 4096:       27% (CI [19.3, 36.4])
Mean score:       37,561
Avg move time:    74ms (p95 187ms, max 780ms)
```

Random and greedy baselines were also run (each n=100). Both reach 0% on 2048; greedy caps at 512, random caps at 256. Calibration confirmed: the search contributes real move quality, not heuristics riding on luck.

### How the suggestion works

Selection and templating use two different signals: `chanceValue` (search-aware, drives selection) and `scoreComponents` (immediate post-move heuristic snapshot, drives templating). The numbers below are illustrative — search scores aren't simple sums of the immediate components.

```
Step 1 — score all 4 directions:
  scores     (chanceValue, search-aware):  Left: 12.4   Right: 10.6   Up: 5.2    Down: 4.8
  components (per-direction snapshot):
    Left:   { mono: −2, smooth: −1, empty: 4.0, corner: 11 }
    Right:  { mono: −4, smooth: −2, empty: 1.0, corner: 11 }
    Up:     { mono: −6, smooth: −3, empty: 1.0, corner:  0 }
    Down:   { mono: −7, smooth: −3, empty: 1.0, corner:  0 }

Step 2 — select best (highest score) and second-best:
  best        = Left   (12.4)
  second-best = Right  (10.6)

Step 3 — weighted component deltas (Left vs Right). Each component
  contributes to H scaled by its weight (α/β/γ/δ), so the deltas
  are weighted before comparison:
  empty:   2.7 × (4.0 − 1.0) = +8.1   ← largest absolute weighted delta
  mono:    1.0 × (−2  − −4)  = +2.0
  smooth:  0.1 × (−1  − −2)  = +0.1
  corner:  1.0 × ( 11 −  11) =  0

Step 4 — dominant delta → template:
  "Move Left — frees up board space"
```

**Dominant delta** = largest absolute weighted delta between the chosen direction's components and the second-best direction's. If that delta is below `CONFIG.GENERIC_TEMPLATE_THRESHOLD` (5%) of the chosen direction's score, fall back to the generic template _"Move {direction} — best overall position"_.

Template map:

| Dominant component | Reasoning template                                                |
| ------------------ | ----------------------------------------------------------------- |
| Monotonicity       | _"Move {direction} — keeps tiles ordered along rows"_                   |
| Smoothness         | _"Move {direction} — keeps similar tiles close, more merges available"_ |
| Empty cells        | _"Move {direction} — frees up board space"_                             |
| Corner             | _"Move {direction} — keeps largest tile anchored in corner"_            |

Deterministic: given the same board, output is always identical. Fully testable:

```ts
expect(await getSuggestion(knownBoard)).toMatchObject({
  direction: 'left',
  reasoning: 'Move Left — frees up board space',
});
```

---

## 6. ViewModel Layer: GameStore

### 6.1 Pattern

```
Domain (pure functions)
    ↓ called by
GameStore (plain class — no React imports)
    ↓ read by
React Components (render only)
```

Each layer only knows about the layer below it. Domain logic and store are pure JS — no browser, no DOM, no React. Tests run in Node without a renderer.

### 6.2 Why Plain Class Over MobX

MobX tracks property reads via ES6 Proxy and re-renders only the components that depend on changed properties. This shines when a small number of properties change among many subscribers — e.g. a 500-row dashboard where 3 prices update per second triggers 3 re-renders, not 500.

For 2048, most tiles change on every move. Property-level granularity buys nothing when nearly every property is dirty.

| Factor                | MobX                              | Plain class (chosen)                   |
| --------------------- | --------------------------------- | -------------------------------------- |
| Re-render granularity | Property-level via Proxy          | Component-level                        |
| Test injection        | Identical                         | Identical                              |
| Extra dependencies    | `mobx`, `mobx-react-lite`         | None                                   |
| Boilerplate           | `makeObservable` + decorators     | None                                   |
| Value at 4×4 scale    | Property-level rarely fires here  | Component-level re-renders work fine   |

Test injection — the core reason for a class store — works identically either way.

**React bridge.** Components subscribe via `useSyncExternalStore` against a monotonically incrementing `version` field bumped in `notify()`. This is the React 18 canonical pattern for external stores — tear-safe under concurrent rendering, ~3 lines of store code, no library dependency. The plain-class choice doesn't mean hand-rolling subscription primitives React already provides.

### 6.3 Store Shape

`GameStatus` and `Direction` const enums are defined in §3.2.

```ts
class GameStore {
  board;          // Board
  status;         // GameStatus
  score;          // cumulative; += scoreDelta on each move
  bestScore;      // persists across resets
  advice;         // AIAdvice | null
  adviceLoading;  // boolean

  get isActive();    // PLAYING or WON (WON interactive per assumption #4)
  get largestTile(); // max tile value; null on empty board

  applyMove(direction);
  requestAdvice();
  reset();
}
```

### 6.4 Status Lifecycle

```
new GameStore()      → status = IDLE       (constructed but not started)
useGame.ts mounts    → if saved state in localStorage: restore it
                     → else: store.reset() → status = PLAYING
applyMove() reaches 2048  → status = WON    (player can continue or restart)
applyMove() leaves no moves → status = LOST
reset()              → status = PLAYING
```

`IDLE` is the brief moment between construction and first init. The user never sees it — `useGame.ts` always transitions to `PLAYING` (via restore or reset) before render.

### 6.5 Actions

```
Action                  | State changes
------------------------|--------------------------------------------------
applyMove(direction)    | board, score (+= scoreDelta), status
requestAdvice()         | adviceLoading = true, advice = null
                        | → on result: advice = { direction, reasoning, debug }
                        |              adviceLoading = false
reset()                 | board = initBoard(), score = 0,
                        | status = STATUS.PLAYING, advice = null
                        | (bestScore preserved)
```

### 6.6 VM Test Injection

```ts
// gameStore.test.ts — zero framework imports
import { GameStore } from '../store/gameStore';

it('transitions to won when 2048 is reached', () => {
  const store = new GameStore();
  store.board = nearWinBoard;
  store.applyMove('left');
  expect(store.status).toBe('won');
});

it('does not spawn a tile after winning', () => {
  const store = new GameStore();
  store.board = nearWinBoard;
  const tileBefore = countTiles(store.board);
  store.applyMove('left');
  expect(countTiles(store.board)).toBe(tileBefore);
});

it('does not mutate state on no-change move', () => {
  const store = new GameStore();
  store.board = immovableLeftBoard;
  const snapshot = deepCopy(store.board);
  store.applyMove('left');
  expect(store.board).toEqual(snapshot);
  expect(store.score).toBe(0);
});
```

These exact test cases appear in `gameStore.test.ts`.

---

## 7. Test Strategy

Detailed function-by-function case enumeration in [`TEST_PLAN.md`](./TEST_PLAN.md).

TDD is the development methodology. Tests are written before implementation: Red → Green → Refactor.

Spec examples are committed verbatim as test cases. Build order (above) is bottom-up (compressRow comes first), but every spec input/output pair below must appear in the test suite.

Build order:

1. `compressRow`
2. `mergeRow`
3. `moveLeft` (composes slide + merge + slide)
4. All four directions via transforms
5. `MoveResult` and move sequencing
6. `GameStore` (ViewModel)
7. AI heuristics
8. Expectimax search and suggestion

### 7.1 Test Layers

| Layer              | File                 | What is tested                                                                                                                                                 |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board primitives   | `board.test.ts`      | `initBoard` (correct tile count, all `2`s, random positions), `boardsEqual`, `spawnTile` (cell selection + value is 2 or 4; branching tested via injected RNG) |
| Move operations    | `moves.test.ts`      | `compressRow`, `mergeRow`, transforms (`reflect`, `transpose` involutions), all four directions — full board snapshots                                         |
| Win/lose detection | `board.test.ts`         | `checkWin`, `checkLose`                                                                                                                                        |
| Move sequencing    | `gameStore.test.ts`     | All 6 stages in §4.4                                                                                                                                           |
| AI heuristics      | `heuristics.test.ts`    | Each heuristic component independently                                                                                                                         |
| Expectimax         | `expectimax.test.ts`    | Known board → expected search value (number, not direction)                                                                                                    |
| Advice generation  | `getSuggestion.test.ts` | Known board → expected direction + reasoning template (deterministic)                                                                                          |
| ViewModel          | `gameStore.test.ts`     | State transitions, zero React imports                                                                                                                          |

### 7.2 Critical Test Cases

Spec input/output pairs are committed verbatim. Three exemplars below; full per-function enumeration in `TEST_PLAN.md`.

```ts
// Spec example: Move Left
it('moves left — spec example', () => {
  const before = [
    [null, 8, 2, 2],
    [4, 2, null, 2],
    [null, null, null, null],
    [null, null, null, 2],
  ];
  const after = [
    [8, 4, null, null],
    [4, 4, null, null],
    [null, null, null, null],
    [2, null, null, null],
  ];
  expect(applyMove(before, 'left').board).toEqual(after);
});

// Merge edge case: pure-merge leaves gaps; second compressRow fills them
it('[2,2,2,2] → [4,null,4,null]', () => {
  expect(mergeRow([2, 2, 2, 2])).toEqual({ row: [4, null, 4, null], scoreDelta: 8 });
});

// Sequencing: no spawn on no-change move
it('does not spawn when move changes nothing', () => {
  const board = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [null, null, null, null],
    [null, null, null, null],
  ];
  const result = applyMove(board, 'left');
  expect(result.changed).toBe(false);
  expect(result.board).toEqual(board);
});
```

Move Right / Up / Down, lose/win detection, spawn placement, no-spawn-after-win, and the full sequencing matrix are in `TEST_PLAN.md`.

### 7.3 Pre-Push Hooks

`husky` runs `npm test` before every `git push`. Bypass: `git push --no-verify`.

---

## 8. Persistence

```ts
// src/constants/storageKeys.ts
export const STORAGE_KEYS = {
  GAME_STATE: '2048_game_state',
  BEST_SCORE: '2048_best_score',
};
```

Loaded at app init in `useGame.ts`. On mount: restore from localStorage if valid state exists, otherwise start fresh. Saves on every valid move. `bestScore` stored separately — survives resets.

A `ⓘ` tooltip on the score display shows: _"Score = cumulative sum of merged tile values. Merging two 4s adds 8."_

---

## 9. Configuration

```ts
// src/config.ts
export const CONFIG = {
  WIN_TILE: 2048,
  INIT_TILE_COUNT: { min: 2, max: 8 }, // spec unspecified — see assumptions
  SPAWN_WEIGHTS: { 2: 0.9, 4: 0.1 }, // spec unspecified — see assumptions
  EXPECTIMAX_DEPTH: 3,
  AI_MODE: 'local', // 'local' | 'remote' — see TD §5.4
};
```

Inspect config:

1. **Console on start** — `[Config] { ... }` logged at app init
2. **Edit `config.ts` directly** — no magic, no env vars, no runtime mutation

---

## 10. File Structure

```
/
├── src/
│   ├── domain/                   # Pure functions — zero framework imports
│   │   ├── board.ts              # initBoard, boardsEqual, spawnTile, checkWin, checkLose, emptyCellPositions, cloneWithCell
│   │   ├── board.test.ts
│   │   ├── moves.ts              # compressRow, mergeRow, applyMove
│   │   ├── moves.test.ts
│   │   └── types.ts              # Board, Cell, Row, Direction, MoveResult, ALL_DIRECTIONS
│   │
│   ├── store/
│   │   ├── gameStore.ts          # Plain class ViewModel
│   │   └── gameStore.test.ts     # VM tests — zero React imports
│   │
│   ├── ai/
│   │   ├── heuristics.ts         # monotonicity, smoothness, cornerBonus, emptyCells
│   │   ├── heuristics.test.ts
│   │   ├── expectimax.ts         # value-returning search
│   │   ├── expectimax.test.ts
│   │   ├── getSuggestion.ts      # direction loop + reasoning + remote adapter
│   │   ├── getSuggestion.test.ts
│   │   └── types.ts              # AIAdvice, SearchStats
│   │
│   ├── hooks/
│   │   ├── persistence.ts        # loadGameState, loadBestScore, saveGameState, saveBestScore (split for isolated unit tests)
│   │   ├── persistence.test.ts
│   │   ├── useGame.ts            # useSyncExternalStore bridge + localStorage + arrow keys (motion inference: deferred polish — §3.3)
│   │   └── useGame.test.ts       # hook-level tests if any (no React render tests)
│   │
│   ├── components/
│   │   ├── Header.tsx            # Title, Score, Best, Restart
│   │   ├── Header.module.css
│   │   ├── Board.tsx             # 16 Cells (slots) + N Tiles (animation-ready overlay; animations deferred — §3.3)
│   │   ├── Board.module.css
│   │   ├── Cell.tsx              # Static empty slot
│   │   ├── Cell.module.css
│   │   ├── Tile.tsx              # Absolute-positioned, React.memo (CSS-transform animation deferred — §3.3)
│   │   ├── Tile.module.css
│   │   ├── AIPanel.tsx           # Suggest button + advice display + loading state
│   │   ├── AIPanel.module.css
│   │   ├── StatusOverlay.tsx     # Win/lose modal — Continue (WON) or View board (LOST) + Restart
│   │   └── StatusOverlay.module.css
│   │
│   ├── styles/
│   │   ├── tokens.css            # log₂(rank) HSL palette + spacing + radii + transition durations
│   │   └── index.css             # global box-sizing + system font stack
│   │
│   ├── constants/
│   │   └── storageKeys.ts
│   │
│   ├── i18n/
│   │   └── copy.ts               # Centralised user-facing strings — future-extensible to per-locale files (en.ts, zh.ts, …)
│   │
│   ├── config.ts
│   ├── App.tsx
│   └── main.tsx
│
├── README.md
├── TECHNICAL_DESIGN.md
├── TEST_PLAN.md
├── AI_FLOW.md
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 11. AI Debug Output

`getSuggestion()` returns the direction, reasoning, and a `debug` object capturing the search internals. After each suggestion, the result is logged to console and exposed on `window` for inspection — visible to anyone with DevTools, invisible to the player.

```ts
console.log('[AI]', advice);
window.__lastAdvice = advice;
window.__adviceHistory ??= [];
window.__adviceHistory.push(advice);

// Reviewer can then:
//   window.__lastAdvice                              → latest suggestion
//   window.__adviceHistory                           → all suggestions this session
//   window.__adviceHistory.map(a => a.direction)     → move pattern
```

The full advice object:

```ts
{
  direction: 'left',
  reasoning: 'Move Left — frees up board space',
  debug: {
    scores: { left: 12.4, right: 10.6, up: null, down: 4.8 },
    computedInMs: 7.3,
    nodesEvaluated: 5240,
    depthSearched: 3
  }
}
```

`debug.scores` allows `null` per direction — a `null` entry marks a no-op (the move didn't change the board), so it's still listed in the payload but excluded from selection. On a lose state (no direction changes the board) `direction` is `null` and `reasoning` is `'No moves available.'`.

The debug payload makes the search inspectable: score per direction, reasoning mapped to component deltas, latency, node count, depth. The console gives a live trace; `window.__adviceHistory` keeps the full session for post-hoc inspection. The player-facing UI stays untouched.
