# bench/

Self-play harness for measuring AI quality and latency. The full write-up lives next to the source in [`BENCHMARK_REPORT.md`](./BENCHMARK_REPORT.md).

## File map

**Source (4 files):**

| File         | Purpose                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `play.ts`    | One self-play game. Policy-pluggable (`random`, `greedy`, `expectimax`). Returns `GameStats`.                         |
| `run.ts`     | CLI driver. Runs N games under one policy. Writes `results-{tag}.json` + streams `results-{tag}.jsonl` mid-run.       |
| `rng.ts`     | Seedable `mulberry32` RNG. Deterministic game trajectories per seed.                                                  |
| `analyze.ts` | Aggregates one or more `results-*.json` files into report-ready summary stats (Wilson CIs, percentiles, reach rates). |

**Data (3 files committed; one missing — see note):**

| File                  | Games | Purpose                                                                                                                                                                                                                                         |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `results-random.json` | 100   | Baseline (random direction) — calibrates floor.                                                                                                                                                                                                 |
| `results-greedy.json` | 100   | Baseline (max-immediate-`scoreDelta`) — calibrates "cheap heuristic" floor.                                                                                                                                                                     |
| `results-d2.json`     | 50    | Expectimax depth 2.                                                                                                                                                                                                                             |
| `results-d3.json`     | —     | **Not committed.** d3 raw was lost during a seed-12 isolation rerun (output path collision since fixed via `--out-tag`). Aggregate stats are in `BENCHMARK_REPORT.md`. Regenerate via the d3 command below if you need raw data; takes ~3.7 hr. |

**Note on `.jsonl` files.** `bench/results-*.jsonl` is the per-game streaming output (appended as each game finishes). Useful mid-run if a kill happens; redundant with the final `.json` afterward. **Gitignored** (`bench/results-*.jsonl` in `.gitignore`) — they're regenerated locally on each run.

## Quick start

```bash
# From repo root.
# Run one policy (writes bench/results-{policy}.json):
npx vite-node bench/run.ts -- --policy random     --games 100 --seed-start 1
npx vite-node bench/run.ts -- --policy greedy     --games 100 --seed-start 1
npx vite-node bench/run.ts -- --policy expectimax --depth 2 --games 50  --seed-start 1
npx vite-node bench/run.ts -- --policy expectimax --depth 3 --games 100 --seed-start 1

# Aggregate one or more results into summary stats:
npx vite-node bench/analyze.ts -- \
  bench/results-random.json \
  bench/results-greedy.json \
  bench/results-d2.json \
  bench/results-d3.json
```

Total wall time on Apple M4 Pro: random/greedy <1s each, d2 ~2 min, d3 ~3.7 hr.

## CLI flags (run.ts)

| Flag           | Default      | Notes                                                                                     |
| -------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `--policy`     | `expectimax` | `random` / `greedy` / `expectimax`                                                        |
| `--depth`      | `3`          | Only used when `--policy expectimax`                                                      |
| `--games`      | `50`         | Number of games to play                                                                   |
| `--seed-start` | `1`          | First seed; subsequent games use `seedStart+i`                                            |
| `--move-cap`   | `5000`       | Safety bound; observed games end via `checkLose` well below this                          |
| `--out-tag`    | `''`         | Optional suffix on output file to avoid clobbering main results (e.g. `--out-tag seed12`) |

Output paths follow `bench/results-{tag}.json` where `tag = d{depth}` for expectimax, otherwise the policy name. With `--out-tag X`, the suffix becomes `{tag}-{X}`.

## Verifying claims in `BENCHMARK_REPORT.md`

Spot-check the report by reading the JSON directly. Each `results-*.json` has shape:

```jsonc
{
  "policy": "expectimax",
  "depth": 3,
  "games": 100,
  "seedStart": 1,
  "results": [
    {
      "seed": 1,
      "policy": "expectimax",
      "depth": 3,
      "score": 35464,
      "maxTile": 2048,
      "moves": 1813,
      "totalMs": 112215.28,
      "msPerMove": [...],     // length === moves
      "nodesPerMove": [...],  // length === moves
      "reached": [256, 512, 1024, 2048],
      "terminalReason": "lose"
    },
    // ...
  ]
}
```

Common checks:

- Win rate at 2048: count `results` where `maxTile >= 2048`.
- Reach rate at 4096: count `results` where `maxTile >= 4096`.
- p95 ms/move: flatten `msPerMove` across all games, sort, take the 95th percentile.

## Architecture notes

- **No production code modified.** `bench/play.ts` calls `chanceValue` (already exported from `src/ai/expectimax.ts` for unit tests) directly with a depth override, bypassing `CONFIG.AI_DEPTH`.
- **Production parity.** The expectimax policy calls `scoreComponents` per legal direction so latency includes the same work `getSuggestion` does. `console.log` + `window` mirror side effects are excluded.
- **RNG decorrelation.** When using the `random` policy, decisions are drawn from a separate `mulberry32` stream (`seed ^ 0x9e3779b9`) so they don't perturb the spawn sequence.
- **Determinism.** Game trajectories (board states, scores, max tiles) are bit-exact reproducible per seed. Latency numbers are not — they depend on system load, GC, JIT, thermal state.
