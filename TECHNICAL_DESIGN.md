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
| 5   | Expectimax depth = 3                        | See section 5.2 for full rationale                                                                                                              |
| 6   | AI uses local Expectimax search             | Deterministic, zero setup, fully testable. Remote AI provider path is documented as a pluggable alternative via `CONFIG.AI_MODE` in `config.ts` |

---

## 2. Tech Stack

ESM (ECMAScript Modules) is the native JS module system browsers support directly — `import/export` syntax. Vite serves ESM files to the browser in dev without bundling, making startup near-instant. Webpack bundles everything first; changes trigger a full or partial rebundle. Vite replaced Webpack-based CRA as the React community standard.

| Tool                  | Why                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React**             | Component model fits tile-based grid UI naturally                                                                                                                                                                                   |
| **TypeScript**        | Static types — catches indexing and merge bugs early                                                                                                                                                                                |
| **Vite**              | Native ESM dev server — instant startup, no webpack bundling overhead                                                                                                                                                               |
| **Vitest**            | Shares Vite's config, aliases, and transforms — no duplicate pipeline. Jest on a Vite project needs `babel-jest`, `ts-jest`, and manual `moduleNameMapper` to replicate what Vitest gets for free. `npm test` works out of the box. |
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

The architecture follows MVVM. `GameStore` has no React imports — game logic is tested independently of the UI. Domain functions are pure, which makes them easy to test in isolation. The layered structure follows from that.

### 3.2 Domain Language

Core types are modelled explicitly so function signatures reflect the domain rather than raw primitives.

| Concept      | Module          | Shape                                                               |
| ------------ | --------------- | ------------------------------------------------------------------- |
| `Board`      | `board.ts`      | `(number \| null)[][]` — `null` = empty cell, `number` = tile value |
| `Direction`  | `moves.ts`      | `'left' \| 'right' \| 'up' \| 'down'`                               |
| `MoveResult` | `moves.ts`      | `{ board, changed, scoreDelta }`                                    |
| `GameStatus` | `gameStore.ts`  | `'idle' \| 'playing' \| 'won' \| 'lost'`                            |
| `AIAdvice`   | `expectimax.ts` | `{ direction, reasoning, debug }`                                   |

### 3.3 UI Layout

Single screen. Score bar, centred 4×4 grid, AI panel beside the grid.

```
┌──────────────────────────────────────────────┐
│  2048                Score: 1024             │
│                      Best:  2048             │
├──────────────────────────────────────────────┤
│   ┌────┬────┬────┬────┐                      │
│   │  2 │    │  4 │    │     [ Suggest move ] │
│   ├────┼────┼────┼────┤                      │
│   │    │  8 │    │  2 │     Last advice: ←   │
│   ├────┼────┼────┼────┤     "Move Left —     │
│   │    │    │  4 │    │      frees board     │
│   ├────┼────┼────┼────┤      space"          │
│   │  2 │  4 │    │ 16 │                      │
│   └────┴────┴────┴────┘                      │
│                                              │
│              ← ↑ → ↓  to move                │
└──────────────────────────────────────────────┘
```

- Score bar shows current score and best score with a `ⓘ` tooltip (section 8).
- Grid renders 4×4 tiles coloured by value; empty cells stay visible.
- AI panel button requests a suggestion; result shows direction + reasoning template (section 5.4).
- Status overlay (not shown): centred modal on win or lose, Continue/Restart actions.
- Input: arrow keys only. No on-screen direction buttons.

---

## 4. Core Domain Logic

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

Bitboard + LUT precomputation yields ~5–10× speedup. At our depth-3 target (~110ms baseline in pure JS), 10× brings latency to ~11ms; both are well under any UX threshold. The speedup only earns its complexity when the baseline crosses into perceptible territory: at depth 5 (~400ms+ in pure JS), 10× to ~40ms is a real UX difference worth pursuing.

If search depth is raised or board size grows, switching to Bitboard + LUT is a natural phase 2: replacing the board representation in `board.ts`, `moves.ts`, and `expectimax.ts`. The store and components interface through `MoveResult` and `GameStore`, so they're unaffected. The algorithm doesn't change; only the data layout does.

### 4.3 Move Pipeline

All four directions are transforms around a single `moveLeft`:

```
moveRight → reflect horizontally  → moveLeft → reflect back
moveUp    → transpose             → moveLeft → transpose back
moveDown  → transpose + reflect   → moveLeft → reflect + transpose back
```

Merge logic exists in exactly one place: `mergeRow`. When a merge bug is found or behaviour changes, there is one function to fix and one set of tests to update. No risk of fixing `mergeLeft` and forgetting `mergeRight`. Direction handling is pure geometry (reflect, transpose), completely separate from merge logic; neither knows about the other.

Within `moveLeft`, each row passes through `compressRow → mergeRow → compressRow`:

```
Input:    [2, 2, null, 2]
compress: [2, 2, 2, null]     pack values toward index 0
merge:    [4, null, 2, null]  merge adjacent equals
compress: [4, 2, null, null]  pack again to fill the gap
```

`compressRow` and `mergeRow` always work toward index 0 — the start of the array. They take no direction parameter. Player direction (Move Left/Right/Up/Down) is mapped to a left-pass via the reflect/transpose pipeline above, so these row primitives only ever solve one problem: pack values to the front, merge adjacent equals.

### Merge rules

Purpose-built examples isolating each rule. All shown as Move Left:

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

Minimax assumes two players: one maximising, one minimising. This is the right model for adversarial games like chess, but tile spawns in 2048 are random, not adversarial. Minimax would pessimistically assume the worst tile always appears in the worst position, leading to overcautious play.

Expectimax handles randomness correctly by computing expected value at chance nodes, weighted by actual spawn probabilities:

```
P(tile = 2) = 0.9,  P(tile = 4) = 0.1
Chance node = 0.9 × value(board with 2) + 0.1 × value(board with 4)
```

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
Depth | Approx nodes | Time (pure JS) | Assessment
  2   |    ~2,300    |  ~2ms          | Misses setup chains
  3   |  ~110,000    |  ~100ms        | Tractable in pure JS, captures setups
  4   | ~5,300,000   |  ~1–5s         | Requires sampling/pruning; out of scope
```

Node counts derive from `48^d`: 4 player directions × ~12 chance outcomes (~6 empty × 2 tile values) per turn. Empty-cell count varies (early game ~14, late game ~2); 6 is a midgame snapshot.

Pure JS without bitboard or chance-node sampling tops out around ~1M heuristic evals/sec. Depth 4 (5.3M nodes) needs sampling or the bitboard + LUT approach, both deferred to phase 2. Section 5.4 documents the swap path to nneonneo (depth 8 in C++) if stronger play is needed.

`EXPECTIMAX_DEPTH = 3` is a named constant in `config.ts`.

### 5.3 Heuristic Function

When Expectimax hits maximum depth it estimates board quality via a scoring formula: the **leaf node heuristic**. Without it all leaf nodes score equally and the algorithm cannot compare them.

```
H(board) = α·Monotonicity + β·Smoothness + γ·log₂(EmptyCells) + δ·CornerBonus
```

| Component            | What it measures                                          | Why it matters                                                                                                                    |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Monotonicity**     | Values increase or decrease consistently in one direction | Keeps large tiles ordered, prevents fragmentation                                                                                 |
| **Smoothness**       | Adjacent tiles have similar values                        | Close values merge sooner                                                                                                         |
| **log₂(EmptyCells)** | Available space                                           | More space = more options. `log₂` because each extra cell is worth less than the previous: 0→1 empty is huge, 9→10 barely matters |
| **CornerBonus**      | Largest tile anchored to a corner                         | Frees the rest of the board for merging                                                                                           |

Why heuristic quality matters more than search depth:

```
Bad heuristic (score only):
  Board A: score=128, largest tile centred, fragmented
  Board B: score=128, largest tile in corner, monotonic rows
  → treated as equal. Board A is one move from losing.

Good heuristic:
  Board A → 340,  Board B → 850
  → algorithm correctly avoids Board A
```

A shallow search with a good heuristic outperforms a deep search with a bad one.

Weights:

```
α (Monotonicity) = 1.0
β (Smoothness)   = 0.1
γ (Empty cells)  = 2.7
δ (Corner)       = 1.0
```

These values are taken from nneonneo's published 2048 AI analysis (the same StackOverflow answer that documents the algorithm). Tuning weights from scratch requires hundreds of trial games and is well outside the scope of this submission. Using community-validated values lets the AI work as intended without inventing the wheel poorly. Cited in `heuristics.ts` source.

### 5.4 AI Suggestion & Human-Readable Reasoning

Expectimax is the AI suggestion engine. When the player asks for a suggestion, it searches all possible moves to depth 4 and returns the best direction. Plain-English reasoning is derived from the heuristic score deltas, the same values that drove the decision. Both the move and the reasoning are deterministic and fully testable.

### nneonneo/2048-ai vs our own implementation

nneonneo/2048-ai (1.2k stars) was the primary alternative considered. It uses Expectimax with a bitboard representation: a 64-bit integer encoding the board as 16 cells × 4 bits (tile exponent). Combined with a precomputed LUT for all possible row transformations, it searches ~10M positions/second. At its default depth 8, it reaches the 2048 tile in 100% of games and the 16384 tile in 94% of games (source: nneonneo's own 100-game benchmark).

We start with our own Expectimax at depth 3: same heuristics, pure JS, zero setup, directly unit testable. Win rate will be benchmarked during build and documented in the table below. If depth 3 isn't strong enough, the AI module is isolated behind a single interface and can be swapped to nneonneo (depth 8) without touching the game engine.

### Switching to nneonneo: our preferred path

If we switch, we host nneonneo in Docker. Docker locks the build environment with a pinned C++ toolchain, Python version, and library versions inside an isolated container. The reviewer runs `docker-compose up` and gets a working AI server regardless of their host OS. No Xcode setup, no platform-specific compilation issues, no "works on my machine" failures. This is a strength of the Docker approach, not a workaround.

The full switch involves: Docker container hosting nneonneo's compiled C++ binary, a thin Python Flask wrapper exposing `POST /suggest`, and board format translation (2D array ↔ 64-bit bitboard) inside the wrapper. The single integration point in our code is one line:

```ts
// src/ai/getSuggestion.ts
export async function getSuggestion(board) {
  if (CONFIG.AI_MODE === 'remote') {
    // POST board to local Docker container running nneonneo
    // Translation between 2D array and bitboard happens server-side
    return await fetch('/api/suggest', {
      method: 'POST',
      body: JSON.stringify({ board }),
    }).then((r) => r.json());
  }
  return localExpectimax(board); // default — pure JS, no infrastructure
}
```

We start with `AI_MODE='local'` set in `config.ts`. Switching to remote requires changing that constant and starting the Docker container; the React code does not change.

Benchmark (to be filled during build):

```
Implementation:   Own Expectimax, depth 3
2048 reach rate:  __% (n=100 games)
Avg move time:    __ms
```

### How the suggestion works

```
Step 1 — score all 4 directions, capturing each component:
  Left:  847  components: { mono: 200, smooth: 47, empty: 350, corner: 250 }
  Right: 651  components: { mono: 150, smooth: 51, empty: 200, corner: 250 }
  Up:    203  components: { mono: 50,  smooth: 53, empty: 50,  corner: 50 }
  Down:  189  components: { mono: 49,  smooth: 50, empty: 40,  corner: 50 }

Step 2 — select highest: Left
         second highest: Right

Step 3 — compute deltas (Left vs Right) — what made Left win:
  empty:  +150  ← largest absolute delta = dominant
  mono:    +50
  corner:    0
  smooth:   -4

Step 4 — dominant delta → template:
  "Move Left — frees up board space"
```

**Dominant delta** = largest absolute delta between the chosen direction's components and the second-best direction's components. If all deltas are small (< 5% of total score), use a generic template _"Move {dir} — best overall position"_.

Template map:

| Dominant component | Reasoning template                                                |
| ------------------ | ----------------------------------------------------------------- |
| Monotonicity       | _"Move {dir} — keeps tiles ordered along rows"_                   |
| Smoothness         | _"Move {dir} — keeps similar tiles close, more merges available"_ |
| Empty cells        | _"Move {dir} — frees up board space"_                             |
| Corner             | _"Move {dir} — keeps largest tile anchored in corner"_            |

Deterministic: given the same board, output is always identical. Fully testable:

```ts
expect(getAdvice(knownBoard)).toEqual({
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

For 2048, most tiles change on every move. Property-level granularity gains us nothing when nearly every property is dirty.

| Factor                | MobX                          | Plain class (our choice) |
| --------------------- | ----------------------------- | ------------------------ |
| Re-render granularity | Property-level via Proxy      | Component-level          |
| Test injection        | Identical                     | Identical                |
| Extra dependencies    | `mobx`, `mobx-react-lite`     | None                     |
| Boilerplate           | `makeObservable` + decorators | None                     |
| Value at 4×4 scale    | Marginal                      | Sufficient               |

Test injection — the core reason for a class store — works identically either way.

### 6.3 Store Shape

`GameStatus` and `Direction` are constant enums imported from `domain/types.ts`:

```ts
export const STATUS = { IDLE: 'idle', PLAYING: 'playing', WON: 'won', LOST: 'lost' } as const;
export const DIRECTION = { LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down' } as const;

export type GameStatus = (typeof STATUS)[keyof typeof STATUS]; // 'idle' | 'playing' | 'won' | 'lost'
export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION]; // 'left' | 'right' | 'up' | 'down'
```

```ts
class GameStore {
  board; // Board
  status; // STATUS value
  score; // number — cumulative; += scoreDelta on each move (never reset until game reset)
  bestScore; // number — persists across resets
  advice; // AIAdvice | null
  adviceLoading; // boolean

  get isActive() {
    return this.status === STATUS.PLAYING;
  }
  get largestTile() {
    return Math.max(...this.board.flat().filter(Boolean));
  }

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
| Win/lose detection | `gameStore.test.ts`  | `checkWin`, `checkLose`                                                                                                                                        |
| Move sequencing    | `gameStore.test.ts`  | All 6 stages in section 4.4                                                                                                                                    |
| AI heuristics      | `heuristics.test.ts` | Each heuristic component independently                                                                                                                         |
| Expectimax         | `expectimax.test.ts` | Known board → expected best direction                                                                                                                          |
| Advice generation  | `expectimax.test.ts` | Known board → expected reasoning template (deterministic)                                                                                                      |
| ViewModel          | `gameStore.test.ts`  | State transitions, zero React imports                                                                                                                          |

### 7.2 Critical Test Cases

From spec, every input/output pair below is committed as a test case verbatim.

```ts
// Spec requirement 1: init board
it('initBoard places tiles within configured range, all value 2', () => {
  const board = initBoard();
  const tiles = board.flat().filter((c) => c !== null);
  expect(tiles.length).toBeGreaterThanOrEqual(CONFIG.INIT_TILE_COUNT.min);
  expect(tiles.length).toBeLessThanOrEqual(CONFIG.INIT_TILE_COUNT.max);
  expect(tiles.every((t) => t === 2)).toBe(true);
});

// Spec requirement 2: Move Left
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

// Spec requirement 3: Move Right
it('moves right — spec example', () => {
  const before = [
    [null, 8, 2, 2],
    [4, 2, null, 2],
    [null, null, null, null],
    [null, null, null, 2],
  ];
  const after = [
    [null, null, 8, 4],
    [null, null, 4, 4],
    [null, null, null, null],
    [null, null, null, 2],
  ];
  expect(applyMove(before, 'right').board).toEqual(after);
});

// Spec requirement 4: Move Up
it('moves up — spec example', () => {
  const before = [
    [null, 8, 2, 2],
    [4, 2, null, 2],
    [null, null, null, null],
    [null, null, null, 2],
  ];
  const after = [
    [4, 8, 2, 4],
    [null, 2, null, 2],
    [null, null, null, null],
    [null, null, null, null],
  ];
  expect(applyMove(before, 'up').board).toEqual(after);
});

// Spec requirement 5: spawn after valid move
it('spawns one tile after valid move', () => {
  const before = [
    [null, 8, 2, 2],
    [4, 2, null, 2],
    [null, null, null, null],
    [null, null, null, 2],
  ];
  const store = new GameStore();
  store.board = before;
  const tilesBefore = countTiles(store.board);
  const mergesInMove = 2; // [2,2] in row 0, [2,2] in column 3
  store.applyMove('up');
  // each merge reduces tile count by 1, then one spawn adds 1
  expect(countTiles(store.board)).toBe(tilesBefore - mergesInMove + 1);
});

// Spec requirement 5 (second): lose condition
it('detects lose — no moves available', () => {
  const loseBoard = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  expect(checkLose(loseBoard)).toBe(true);
});

// Spec requirement 5 (second): win condition
it('detects win — 2048 tile present', () => {
  const winBoard = [
    [4, null, null, 2],
    [2048, null, null, null],
    [4, 2, null, null],
    [4, null, null, null],
  ];
  expect(checkWin(winBoard)).toBe(true);
});

// Spec requirement 6: AI suggestion
it('AI returns a valid direction and reasoning for a known board', () => {
  const board = [
    [2, 2, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
  const advice = getSuggestion(board);
  expect(['left', 'right', 'up', 'down']).toContain(advice.direction);
  expect(advice.reasoning).toMatch(/^Move /);
});
```

Merge edge cases:

```ts
// Two independent merges in one row — commonly misunderstood
it('[2,2,2,2] → [4,4,null,null]', () => {
  expect(mergeRow([2, 2, 2, 2])).toEqual({
    row: [4, 4, null, null],
    scoreDelta: 8,
  });
});

// Null between tiles — compress brings them adjacent first
it('[2,null,2,null] → [4,null,null,null]', () => {
  expect(mergeRow(compressRow([2, null, 2, null]))).toEqual({
    row: [4, null, null, null],
    scoreDelta: 4,
  });
});
```

Sequencing, common bugs:

```ts
// No spawn on no-change move
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

// No spawn after win
it('does not spawn after reaching 2048', () => {
  const store = new GameStore();
  store.board = nearWinBoard;
  const tileCount = countTiles(store.board);
  store.applyMove('left');
  expect(store.status).toBe('won');
  expect(countTiles(store.board)).toBe(tileCount);
});
```

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
  BOARD_SIZE: 4,
  WIN_TILE: 2048,
  INIT_TILE_COUNT: { min: 2, max: 8 }, // spec unspecified — see assumptions
  SPAWN_WEIGHTS: { 2: 0.9, 4: 0.1 }, // spec unspecified — see assumptions
  EXPECTIMAX_DEPTH: 3,
  AI_MODE: 'local', // 'local' | 'remote' — see TD section 5.4
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
│   │   ├── board.ts              # initBoard, boardsEqual, spawnTile
│   │   ├── board.test.ts
│   │   ├── moves.ts              # compressRow, mergeRow, applyMove
│   │   ├── moves.test.ts
│   │   ├── heuristics.ts         # monotonicity, smoothness, corner, empty
│   │   ├── heuristics.test.ts
│   │   ├── expectimax.ts         # search + reasoning
│   │   └── expectimax.test.ts
│   │
│   ├── store/
│   │   ├── gameStore.ts          # Plain class ViewModel
│   │   └── gameStore.test.ts     # VM tests — zero React imports
│   │
│   ├── ai/
│   │   └── getSuggestion.ts      # Adapter — local or remote
│   │
│   ├── hooks/
│   │   └── useGame.ts            # React bridge to GameStore + localStorage + arrow keys
│   │
│   ├── components/
│   │   ├── GameBoard.tsx         # Grid renderer
│   │   ├── TileCell.tsx          # Single tile — React.memo applied
│   │   ├── AIPanel.tsx           # Advice button, result display
│   │   ├── ScoreBar.tsx          # Score + bestScore + ⓘ
│   │   └── StatusOverlay.tsx     # Win/lose modal — Continue or Restart
│   │
│   ├── constants/
│   │   └── storageKeys.ts
│   │
│   ├── config.ts
│   ├── App.tsx
│   └── main.tsx
│
├── README.md
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
  reasoning: 'Move Left — tiles are better ordered, largest tile stays in corner',
  debug: {
    scores: { left: 847, up: 651, right: 203, down: 189 },
    computedInMs: 7.3,
    nodesEvaluated: 5240,
    depthSearched: 3
  }
}
```

Purpose: lets the reviewer verify the AI is doing real work — score per direction, reasoning mapped to score deltas, latency within budget. The console gives a live trace; `window.__adviceHistory` allows post-hoc analysis of an entire session. No UI cost — the player-facing interface stays clean.
