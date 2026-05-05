# Technical Design Document: 2048

This document explains the design decisions behind the implementation. Architectural decisions are documented here before implementation — if a better approach emerges during development, this document is updated to reflect it.

---

## 1. Assumptions

The spec leaves several values unspecified. All assumptions are externalised to `config.js` — logged to console on start, and configurable by editing the file directly.

| # | Assumption | Reason |
|---|---|---|
| 1 | Initial board places 2–6 tiles of value `2` | Spec says "random number of 2s" — range chosen for playability |
| 2 | Spawn probability: 90% for `2`, 10% for `4` | Spec says "a 2 or 4" — standard 2048 convention |
| 3 | Score = sum of all merged tile values | Standard 2048 scoring convention — same as the original game |
| 4 | Win state allows player to continue | Spec detects win but does not say game ends — continue or restart offered |
| 5 | Expectimax depth = 4 | See section 5.2 for full rationale |
| 6 | AI uses local Expectimax search | Deterministic, zero setup, fully testable. Remote AI provider path is documented as a pluggable alternative in `config.js` and `.env.example` |

---

## 2. Tech Stack

ESM (ECMAScript Modules) is the native JS module system browsers support directly — `import/export` syntax. Vite serves ESM files to the browser in dev without bundling, making startup near-instant. Webpack bundles everything first; changes trigger a full or partial rebundle. Vite replaced Webpack-based CRA as the React community standard.

| Tool | Why |
|---|---|
| **React** | Component model fits tile-based grid UI naturally |
| **Vite** | Native ESM dev server — instant startup, no webpack bundling overhead |
| **Vitest** | Shares Vite's config, aliases, and transforms — no duplicate pipeline. Jest on a Vite project needs `babel-jest`, `ts-jest`, and manual `moduleNameMapper` to replicate what Vitest gets for free. `npm test` works out of the box. |
| **Plain class store** | Framework-agnostic, injectable, testable without React |

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
│   board.js · moves.js                │
│   heuristics.js · expectimax.js      │
│   Pure functions, zero side effects  │
└──────────────────────────────────────┘
```

The architecture follows MVVM. `GameStore` has no React imports — game logic is tested independently of the UI. Domain functions are pure, which makes them easy to test in isolation. The layered structure follows from that.

### 3.2 Domain Language

Core types are modelled explicitly so function signatures reflect the domain rather than raw primitives.

| Concept | Module | Shape |
|---|---|---|
| `Board` | `board.js` | `(number \| null)[][]` — `null` = empty cell, `number` = tile value |
| `Direction` | `moves.js` | `'left' \| 'right' \| 'up' \| 'down'` |
| `MoveResult` | `moves.js` | `{ board, changed, scoreDelta }` |
| `GameStatus` | `gameStore.js` | `'idle' \| 'playing' \| 'won' \| 'lost'` |
| `AIAdvice` | `expectimax.js` | `{ direction, reasoning, debug }` |

---

## 4. Core Domain Logic

### 4.1 Game Rules

Six rules from the spec govern all gameplay. Configurable values live in `config.js`:

| # | Rule | Detail |
|---|---|---|
| 1 | Init | Start with a random number of `2` tiles at random cells. Range `INIT_TILE_COUNT` (default 2–6) |
| 2 | Move | Slide all tiles in the chosen direction, merging adjacent equals (see 4.3) |
| 3 | Spawn | After a valid move, one new tile spawns at a random empty cell — `2` with 90% probability, `4` with 10%. Weights: `SPAWN_WEIGHTS` |
| 4 | No-change move | If the move does not change the board, no spawn happens |
| 5 | Win | The `WIN_TILE` (default 2048) appears on the board |
| 6 | Lose | No valid move exists in any direction |

### 4.2 Data Structure: 2D Array over Bitboard

Board is a plain `(number | null)[][]`. Bitboard representation (packing the board into a 64-bit integer, 4 bits per cell storing the tile exponent) was considered and rejected.

**Complexity analysis:**

Each move processes 4 rows of 4 cells — a single linear pass per row:
```
moveLeft = O(4 rows × 4 cells) = O(16) = O(1)
```
The board is fixed size. Every move is constant time regardless of representation.

Bitboard + LUT precomputation yields ~5–10× speedup. At depth 4 that takes our ~8ms baseline to ~0.8ms — both are imperceptible to a user. A 10× multiplier only becomes meaningful when the baseline is large enough to cross a perceptible threshold. At depth 5 (~400ms baseline), the same 10× improvement would bring latency to ~40ms — a real UX difference worth the complexity. At depth 4, it is not.

If search depth is increased beyond 4 or board size grows, switching to Bitboard + LUT is a natural phase 2 — replacing the board representation throughout `board.js`, `moves.js`, and `expectimax.js`. The store and components are unaffected as they interface through `MoveResult` and `GameStore`, not the raw board format. Estimated effort: ~1–2 days for an experienced developer — the board representation, move logic, and LUT precomputation all need rewriting, but the surface area is small (three files) and the algorithm itself doesn't change.

### 4.3 Move Pipeline

All four directions are transforms around a single `moveLeft`:

```
moveRight → reflect horizontally  → moveLeft → reflect back
moveUp    → transpose             → moveLeft → transpose back
moveDown  → transpose + reflect   → moveLeft → reflect + transpose back
```

Merge logic exists in exactly one place — `mergeRow`. When a merge bug is found or behaviour changes, there is one function to fix and one set of tests to update. No risk of fixing `mergeLeft` and forgetting `mergeRight`. Direction handling is pure geometry (reflect, transpose), completely separate from merge logic — neither knows about the other.

Each row passes through three single-responsibility functions:

```
Input:   [2, 2, null, 2]
slide:   [2, 2, 2, null]     compress nulls out — null removed ✓
merge:   [4, null, 2, null]  merge adjacent equals — gap created
slide:   [4, 2, null, null]  compress after merge — gap removed ✓
```

**Merge rules — purpose-built examples isolating each rule. All shown as Move Left:**

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

For Move Right, Up, Down — the same rules apply but in the corresponding direction. The transform pipeline (reflect, transpose) ensures `mergeRow` only ever sees a left-to-right problem. The transforms themselves are tested independently — `reflect(reflect(board)) === board`, `transpose(transpose(board)) === board`.

`MoveResult` returned by `applyMove`:
```js
{
  board: Board,        // new board state
  changed: boolean,    // did any cell move or merge?
  scoreDelta: number   // sum of all merged tile values this move
                       // e.g. [2,2]→4 and [4,4]→8 in one move = scoreDelta: 12
}
```

### 4.4 Move Sequencing

The order of operations in `GameStore.applyMove()` matters — incorrect sequencing is a common source of win/lose bugs.

```
1. newBoard = applyMove(board, direction)
2. boardsEqual(board, newBoard)  → if true: return unchanged (no spawn)
3. checkWin(newBoard)            → if true: status = 'won', return (no spawn)
4. boardWithTile = spawnTile(newBoard)
5. checkLose(boardWithTile)      → if true: status = 'lost'
6. update state
```

Each stage has a dedicated test. Stage 2 guards against spawning on a no-change move. Stage 3 guards against spawning after a win.

---

## 5. AI Strategy: Local Expectimax

### 5.1 Why Expectimax, Not Minimax

Minimax assumes two players: one maximising, one minimising. This is the right model for adversarial games like chess, but tile spawns in 2048 are random — not adversarial. Minimax would pessimistically assume the worst tile always appears in the worst position, leading to overcautious play.

Expectimax handles randomness correctly by computing expected value at chance nodes, weighted by actual spawn probabilities:
```
P(tile = 2) = 0.9,  P(tile = 4) = 0.1
Chance node = 0.9 × value(board with 2) + 0.1 × value(board with 4)
```

### 5.2 Search Depth: Why Depth 4

Depth 4 covers exactly 2 full turns:

```
Turn 1:  your 1st move     (Max node — 4 choices)
         → tile spawns     (Chance node — ~12 outcomes)
Turn 2:  your 2nd move     (Max node — 4 choices)
         → tile spawns     (Chance node — ~12 outcomes)
         → evaluate with heuristic
```

Depth 1 is purely greedy — sees only immediate merges. Depth 4 evaluates **setup moves**: a 1st move that scores nothing but creates a clean large merge on the 2nd move.

Depth table (estimated — actual values will be measured during build):

```
Depth | Approx nodes  | Est. ms | Assessment
  3   |   ~110,000    |  <1ms   | Misses 2nd-move setups
  4   |  ~5,300,000   |  ~8ms   | ✓ Sweet spot
  5   | ~254,000,000  | ~400ms  | User-perceptible lag, marginal quality gain
```

Node counts derived from `48^d`. The 48 factor reflects empirical mid-game branching: ~6 empty cells × 2 tile outcomes (`2` or `4` spawning) × 4 player directions. Empty cell count varies through the game — early game has ~14, late game ~2 — 6 is a representative midgame snapshot. Real branching and timing will be measured and recorded in section 5.4 during build.

`EXPECTIMAX_DEPTH = 4` is a named constant in `config.js`.

### 5.3 Heuristic Function

When Expectimax hits maximum depth it estimates board quality via a scoring formula — the **leaf node heuristic**. Without it all leaf nodes score equally and the algorithm cannot compare them.

```
H(board) = α·Monotonicity + β·Smoothness + γ·log₂(EmptyCells) + δ·CornerBonus
```

| Component | What it measures | Why it matters |
|---|---|---|
| **Monotonicity** | Values increase or decrease consistently in one direction | Keeps large tiles ordered, prevents fragmentation |
| **Smoothness** | Adjacent tiles have similar values | Close values merge sooner |
| **log₂(EmptyCells)** | Available space | More space = more options. `log₂` because each extra cell is worth less than the previous: 0→1 empty is huge, 9→10 barely matters |
| **CornerBonus** | Largest tile anchored to a corner | Frees the rest of the board for merging |

**Why heuristic quality matters more than search depth:**

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

### 5.4 AI Suggestion & Human-Readable Reasoning

Expectimax is the AI suggestion engine. When the player asks for a suggestion, it searches all possible moves to depth 4 and returns the best direction. Plain-English reasoning is derived from the heuristic score deltas — the same values that drove the decision. Both the move and the reasoning are deterministic and fully testable.

**nneonneo/2048-ai vs our own implementation**

nneonneo/2048-ai (1.2k stars) was the primary alternative considered. It uses Expectimax with a bitboard representation — a 64-bit integer encoding the board as 16 cells × 4 bits (tile exponent). Combined with a precomputed LUT for all possible row transformations, it searches ~10M positions/second. At its default depth 8, it reaches the 2048 tile in 100% of games and the 16384 tile in 94% of games (source: nneonneo's own 100-game benchmark).

We start with our own Expectimax at depth 4 — same heuristics, pure JS, zero setup, directly unit testable. Win rate will be benchmarked during build and documented in the table below. If results are not acceptable, the AI module is isolated behind a single interface and can be swapped without touching the game engine.

**Switching to nneonneo — our preferred path**

If we switch, we host nneonneo in Docker. Docker locks the build environment — pinned C++ toolchain, Python version, and library versions inside an isolated container. The reviewer runs `docker-compose up` and gets a working AI server regardless of their host OS. No Xcode setup, no platform-specific compilation issues, no "works on my machine" failures. This is a strength of the Docker approach, not a workaround.

The full switch involves: Docker container hosting nneonneo's compiled C++ binary, a thin Python Flask wrapper exposing `POST /suggest`, and board format translation (2D array ↔ 64-bit bitboard) inside the wrapper. The single integration point in our code is one line:

```js
// src/ai/getSuggestion.js
export async function getSuggestion(board) {
  if (CONFIG.AI_MODE === 'remote') {
    // POST board to local Docker container running nneonneo
    // Translation between 2D array and bitboard happens server-side
    // Credentials (if any) stay server-side via .env
    return await fetch('/api/suggest', {
      method: 'POST',
      body: JSON.stringify({ board })
    }).then(r => r.json())
  }
  return localExpectimax(board)  // default — pure JS, no infrastructure
}
```

We start with `AI_MODE=local`. Switching to remote requires changing one config value and starting the Docker container — the React code does not change.

**Benchmark (to be filled during build):**
```
Implementation:   Own Expectimax, depth 4
2048 reach rate:  __% (n=100 games)
Avg move time:    __ms
```

**How the suggestion works:**

```
Step 1 — score all 4 directions:
  Left:  847  ← highest
  Up:    651
  Right: 203
  Down:  189

Step 2 — select: Left

Step 3 — heuristic component deltas for Left:
  monotonicity:  +34  ← dominant
  corner bonus:  +0   ← maintained
  smoothness:    +12
  empty cells:   -1

Step 4 — dominant delta → template:
  "Move Left — tiles are better ordered, largest tile stays in corner"
```

Deterministic — given the same board, output is always identical. Fully testable:

```js
expect(getAdvice(knownBoard)).toEqual({
  direction: 'left',
  reasoning: 'Move Left — tiles are better ordered, largest tile stays in corner'
})
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

| Factor | MobX | Plain class (our choice) |
|---|---|---|
| Re-render granularity | Property-level via Proxy | Component-level |
| Test injection | Identical | Identical |
| Extra dependencies | `mobx`, `mobx-react-lite` | None |
| Boilerplate | `makeObservable` + decorators | None |
| Value at 4×4 scale | Marginal | Sufficient |

Test injection — the core reason for a class store — works identically either way.

### 6.3 Store Shape

`GameStatus` and `Direction` are constant enums imported from `domain/types.js`:

```js
export const STATUS = { IDLE: 'idle', PLAYING: 'playing', WON: 'won', LOST: 'lost' }
export const DIRECTION = { LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down' }
```

```js
class GameStore {
  board          // Board
  status         // STATUS value
  score          // number — cumulative; += scoreDelta on each move (never reset until game reset)
  bestScore      // number — persists across resets
  advice         // AIAdvice | null
  adviceLoading  // boolean

  get isActive()   { return this.status === STATUS.PLAYING }
  get largestTile(){ return Math.max(...this.board.flat().filter(Boolean)) }

  applyMove(direction)
  requestAdvice()
  reset()
}
```

### 6.4 Actions

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

### 6.5 VM Test Injection

```js
// gameStore.test.js — zero framework imports
import { GameStore } from '../store/gameStore'

it('transitions to won when 2048 is reached', () => {
  const store = new GameStore()
  store.board = nearWinBoard
  store.applyMove('left')
  expect(store.status).toBe('won')
})

it('does not spawn a tile after winning', () => {
  const store = new GameStore()
  store.board = nearWinBoard
  const tileBefore = countTiles(store.board)
  store.applyMove('left')
  expect(countTiles(store.board)).toBe(tileBefore)
})

it('does not mutate state on no-change move', () => {
  const store = new GameStore()
  store.board = immovableLeftBoard
  const snapshot = deepCopy(store.board)
  store.applyMove('left')
  expect(store.board).toEqual(snapshot)
  expect(store.score).toBe(0)
})
```

These exact test cases appear in `gameStore.test.js`.

---

## 7. Test Strategy

TDD is the development methodology. Tests are written before implementation — Red → Green → Refactor.

**First tests written are spec examples** — the spec provides concrete input/output pairs that map directly to test cases.

**Build order:**
1. `slideRow`
2. `mergeRow`
3. `moveLeft` (composes slide + merge + slide)
4. All four directions via transforms
5. `MoveResult` and move sequencing
6. `GameStore` (ViewModel)
7. AI heuristics
8. Expectimax search and suggestion

### 7.1 Test Layers

| Layer | File | What is tested |
|---|---|---|
| Board primitives | `board.test.js` | `initBoard` (correct tile count, all `2`s, random positions), `boardsEqual`, `spawnTile` (probability distribution over many runs) |
| Move operations | `moves.test.js` | `slideRow`, `mergeRow`, transforms (`reflect`, `transpose` involutions), all four directions — full board snapshots |
| Win/lose detection | `gameStore.test.js` | `checkWin`, `checkLose` |
| Move sequencing | `gameStore.test.js` | All 6 stages in section 4.4 |
| AI heuristics | `heuristics.test.js` | Each heuristic component independently |
| Expectimax | `expectimax.test.js` | Known board → expected best direction |
| Advice generation | `expectimax.test.js` | Known board → expected reasoning template (deterministic) |
| ViewModel | `gameStore.test.js` | State transitions, zero React imports |

### 7.2 Critical Test Cases

**From spec — first tests written. Every spec input/output pair becomes a test case verbatim.**

```js
// Spec requirement 1: init board
it('initBoard places tiles within configured range, all value 2', () => {
  const board = initBoard()
  const tiles = board.flat().filter(c => c !== null)
  expect(tiles.length).toBeGreaterThanOrEqual(CONFIG.INIT_TILE_COUNT.min)
  expect(tiles.length).toBeLessThanOrEqual(CONFIG.INIT_TILE_COUNT.max)
  expect(tiles.every(t => t === 2)).toBe(true)
})

// Spec requirement 2: Move Left
it('moves left — spec example', () => {
  const before = [
    [null, 8,    2,    2],
    [4,    2,    null, 2],
    [null, null, null, null],
    [null, null, null, 2]
  ]
  const after = [
    [8,    4,    null, null],
    [4,    4,    null, null],
    [null, null, null, null],
    [2,    null, null, null]
  ]
  expect(applyMove(before, 'left').board).toEqual(after)
})

// Spec requirement 3: Move Right
it('moves right — spec example', () => {
  const before = [
    [null, 8,    2,    2],
    [4,    2,    null, 2],
    [null, null, null, null],
    [null, null, null, 2]
  ]
  const after = [
    [null, null, 8,    4],
    [null, null, 4,    4],
    [null, null, null, null],
    [null, null, null, 2]
  ]
  expect(applyMove(before, 'right').board).toEqual(after)
})

// Spec requirement 4: Move Up
it('moves up — spec example', () => {
  const before = [
    [null, 8,    2,    2],
    [4,    2,    null, 2],
    [null, null, null, null],
    [null, null, null, 2]
  ]
  const after = [
    [4,    8,    2,    4],
    [null, 2,    null, 2],
    [null, null, null, null],
    [null, null, null, null]
  ]
  expect(applyMove(before, 'up').board).toEqual(after)
})

// Spec requirement 5: spawn after valid move
it('spawns one tile after valid move', () => {
  const before = [
    [null, 8,    2,    2],
    [4,    2,    null, 2],
    [null, null, null, null],
    [null, null, null, 2]
  ]
  const store = new GameStore()
  store.board = before
  const tilesBefore = countTiles(store.board)
  const mergesInMove = 2  // [2,2] in row 0, [2,2] in column 3
  store.applyMove('up')
  // each merge reduces tile count by 1, then one spawn adds 1
  expect(countTiles(store.board)).toBe(tilesBefore - mergesInMove + 1)
})

// Spec requirement 5 (second): lose condition
it('detects lose — no moves available', () => {
  const loseBoard = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ]
  expect(checkLose(loseBoard)).toBe(true)
})

// Spec requirement 5 (second): win condition
it('detects win — 2048 tile present', () => {
  const winBoard = [
    [4,    null, null, 2],
    [2048, null, null, null],
    [4,    2,    null, null],
    [4,    null, null, null]
  ]
  expect(checkWin(winBoard)).toBe(true)
})

// Spec requirement 6: AI suggestion
it('AI returns a valid direction and reasoning for a known board', () => {
  const board = [
    [2,    2,    null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ]
  const advice = getSuggestion(board)
  expect(['left', 'right', 'up', 'down']).toContain(advice.direction)
  expect(advice.reasoning).toMatch(/^Move /)
})
```

**Merge edge cases:**
```js
// Two independent merges in one row — commonly misunderstood
it('[2,2,2,2] → [4,4,null,null]', () => {
  expect(mergeRow([2, 2, 2, 2])).toEqual({
    row: [4, 4, null, null],
    scoreDelta: 8
  })
})

// Null between tiles — compress brings them adjacent first
it('[2,null,2,null] → [4,null,null,null]', () => {
  expect(mergeRow(slideRow([2, null, 2, null]))).toEqual({
    row: [4, null, null, null],
    scoreDelta: 4
  })
})
```

**Sequencing — common bugs:**
```js
// No spawn on no-change move
it('does not spawn when move changes nothing', () => {
  const board = [
    [2,    4,    2,    4],
    [4,    2,    4,    2],
    [null, null, null, null],
    [null, null, null, null]
  ]
  const result = applyMove(board, 'left')
  expect(result.changed).toBe(false)
  expect(result.board).toEqual(board)
})

// No spawn after win
it('does not spawn after reaching 2048', () => {
  const store = new GameStore()
  store.board = nearWinBoard
  const tileCount = countTiles(store.board)
  store.applyMove('left')
  expect(store.status).toBe('won')
  expect(countTiles(store.board)).toBe(tileCount)
})
```

### 7.3 Pre-Push Hooks

`husky` runs `npm test` before every `git push`. Bypass: `git push --no-verify`.

---

## 8. Persistence

```js
// src/constants/storageKeys.js
export const STORAGE_KEYS = {
  GAME_STATE: '2048_game_state',
  BEST_SCORE: '2048_best_score'
}
```

Loaded at app init in `useGame.js`. On mount: restore from localStorage if valid state exists, otherwise start fresh. Saves on every valid move. `bestScore` stored separately — survives resets.

A `ⓘ` tooltip on the score display shows: *"Score = cumulative sum of merged tile values. Merging two 4s adds 8."*

---

## 9. Configuration

```js
// src/config.js
export const CONFIG = {
  BOARD_SIZE: 4,
  WIN_TILE: 2048,
  INIT_TILE_COUNT: { min: 2, max: 6 },  // spec unspecified — see assumptions
  SPAWN_WEIGHTS: { 2: 0.9, 4: 0.1 },    // spec unspecified — see assumptions
  EXPECTIMAX_DEPTH: 4,
  AI_MODE: 'local'                        // 'local' | 'remote' — see .env.example
}
```

Inspect config:
1. **Console on start** — `[Config] { ... }` logged at app init
2. **Edit `config.js` directly** — no magic, no env vars, no runtime mutation

---

## 10. File Structure

```
/
├── src/
│   ├── domain/                   # Pure functions — zero framework imports
│   │   ├── board.js              # initBoard, boardsEqual, spawnTile
│   │   ├── board.test.js
│   │   ├── moves.js              # slideRow, mergeRow, applyMove
│   │   ├── moves.test.js
│   │   ├── heuristics.js         # monotonicity, smoothness, corner, empty
│   │   ├── heuristics.test.js
│   │   ├── expectimax.js         # search + reasoning
│   │   └── expectimax.test.js
│   │
│   ├── store/
│   │   ├── gameStore.js          # Plain class ViewModel
│   │   └── gameStore.test.js     # VM tests — zero React imports
│   │
│   ├── ai/
│   │   └── getSuggestion.js      # Adapter — local or remote
│   │
│   ├── hooks/
│   │   └── useGame.js            # React bridge to GameStore + localStorage
│   │
│   ├── components/
│   │   ├── GameBoard.jsx         # Grid renderer
│   │   ├── TileCell.jsx          # Single tile — React.memo applied
│   │   ├── AIPanel.jsx           # Advice button, result display
│   │   ├── ScoreBar.jsx          # Score + bestScore + ⓘ
│   │   └── StatusOverlay.jsx     # Win/lose modal — Continue or Restart
│   │
│   ├── constants/
│   │   └── storageKeys.js
│   │
│   ├── config.js
│   ├── App.jsx
│   └── main.jsx
│
├── .env.example
├── README.md
├── vite.config.js
└── package.json
```

---

## 11. AI Debug Output

`getSuggestion()` returns the direction, reasoning, and a `debug` object capturing the search internals. After each suggestion, the result is logged to console and exposed on `window` for inspection — visible to anyone with DevTools, invisible to the player.

```js
console.log('[AI]', advice)
window.__lastAdvice = advice
window.__adviceHistory ??= []
window.__adviceHistory.push(advice)

// Reviewer can then:
//   window.__lastAdvice                              → latest suggestion
//   window.__adviceHistory                           → all suggestions this session
//   window.__adviceHistory.map(a => a.direction)     → move pattern
```

The full advice object:
```js
{
  direction: 'left',
  reasoning: 'Move Left — tiles are better ordered, largest tile stays in corner',
  debug: {
    scores: { left: 847, up: 651, right: 203, down: 189 },
    computedInMs: 7.3,
    nodesEvaluated: 5240,
    depthSearched: 4
  }
}
```

Purpose: lets the reviewer verify the AI is doing real work — score per direction, reasoning mapped to score deltas, latency within budget. The console gives a live trace; `window.__adviceHistory` allows post-hoc analysis of an entire session. No UI cost — the player-facing interface stays clean.
