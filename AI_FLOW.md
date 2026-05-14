# AI Flow

Expectimax search flow diagrams. Companion to `TECHNICAL_DESIGN.md` §5 (design rationale) and the source files in `src/ai/`.

## At a glance

Alternate MAX (you pick) with CHANCE (tile spawns) until depth runs out, then score.

```
   MAX  d=3                                       ← player move: max over up/down/left/right
   ├─ up    → CHANCE d=2                          ← spawn: avg over outcomes
   │           ├─ spawn 2 at empty cell → MAX d=2 → …
   │           ├─ spawn 4 at empty cell → MAX d=2 → …
   │           └─ … every empty cell × {2 @ 90%, 4 @ 10%}
   ├─ down  → CHANCE d=2 → …
   ├─ left  → CHANCE d=2 → …
   └─ right → CHANCE d=2 → …

   directions that don't change the board are skipped.
   recurses until MAX d=0 → leafValue(board)
                          = α·monotonicity + β·smoothness + γ·log₂(empties) + δ·corner
```

Module layout:

- `heuristics.ts` — board-quality components (monotonicity, smoothness, emptyCells, cornerBonus)
- `expectimax.ts` — value-returning search (returns a `number`, not a direction)
- `getSuggestion.ts` — direction loop, debug payload, reasoning template (next module)

## expectimax flow

```
maxValue(board, depth):
   if depth == 0                          ──▶ leafValue(board)            [EXIT]
   for each Direction:
      applyMove(board, direction) ─ if changed ─▶ chanceValue(board', depth-1)
   if no direction changed (lose)         ──▶ leafValue(board)            [EXIT]
   return max over children

chanceValue(board, depth):
   if board full                          ──▶ maxValue(board, depth)     [BYPASS, no layer]
   for each empty cell c:
      for each (value v, prob p) ∈ {(2, .9), (4, .1)}:
         child = maxValue(cloneWithCell(board, c, v), depth)
         total += p · child
   return total / |empties|

leafValue(board) = α·monotonicity + β·smoothness + γ·emptyCells + δ·cornerBonus
```

### Depth flow

```
max → chance:  depth − 1   (one layer: player just made a move)
chance → max:  same depth  (a spawn isn't a layer, just dice)

depth = "how many player moves ahead before falling to leafValue"

depth=3:  max ─▶ chance ─▶ max ─▶ chance ─▶ max ─▶ chance ─▶ max ─▶ leaf
          3      2          2     1          1     0          0
```

### Chance-node formula

Spawn picks `(cell, value)` jointly, two independent dice:

- `cell`: uniform over empties → `P(cell) = 1/|empties|`
- `value`: 2 with `.9`, 4 with `.1` → `P(value) = .9` or `.1`

Joint: `P(c, v) = (1/|empties|) · P(v)`

```
E[child] = Σ over (c, v) of  P(c, v) · maxValue(spawned)
         = (1/|empties|) · Σ  P(v) · maxValue(...)        ← factor out 1/N
```

In code: inner loop accumulates `p · child`, outer return divides by `|empties|`.

### All paths terminate at leafValue

- `maxValue` exits to `leafValue` when `depth == 0` OR lose state
- `chanceValue` never exits directly — bounces or recurses
- all recursion eventually hits a `maxValue` with `depth == 0` (or a lose)
