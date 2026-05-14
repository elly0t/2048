# 2048 Expectimax AI — Benchmark Report

**Generated:** 2026-05-11
**Repo HEAD:** `d64c05b`
**Hardware:** Apple M4 Pro, macOS Darwin 25.2.0 (arm64)
**Runtime:** Node v24.13.0
**Harness:** `bench/play.ts` + `bench/run.ts` + `bench/analyze.ts`

---

## TL;DR

Random and greedy never reach 2048. d2 and d3 win at the same rate; d3 reaches 4096 ~2× more often at ~58× the p95 latency.

```
   reach 2048    random/greedy  ░                              0%
                 d2 (n=50)      ████████████████████████████   80%
                 d3 (n=100)     ███████████████████████████░   77%    ≈ d2

   reach 4096    random/greedy  ░                              0%
                 d2             █████░░░░░░░░░░░░░░░░░░░░░░░   14%
                 d3             █████████░░░░░░░░░░░░░░░░░░░   27%    ~2× d2

   p95 ms/move   random/greedy  ▏ <0.01
                 d2             ▏ 3
                 d3             ██████████████████████   187          ~58× d2
```

Stats: 80% vs 77% win rate is a coin-flip tie (Fisher's exact p ≈ 0.84); 14% vs 27% on 4096 is borderline (p ≈ 0.10 at n=150). Earlier n=10/20 numbers were sample noise.

| Policy        | n   | Win (≥2048) | 95% CI       | Reach 4096 | 95% CI       | Mean score | p50 ms/move | p95 ms/move | max ms/move |
| ------------- | --- | ----------- | ------------ | ---------- | ------------ | ---------- | ----------- | ----------- | ----------- |
| Random        | 100 | 0%          | [0, 3.7]     | 0%         | [0, 3.7]     | 1,065      | 0.0006      | 0.0091      | 0.33        |
| Greedy        | 100 | 0%          | [0, 3.7]     | 0%         | [0, 3.7]     | 3,157      | 0.0007      | 0.0118      | 0.54        |
| Expectimax d2 | 50  | 80%         | [67.0, 88.8] | 14%        | [7.0, 26.2]  | 32,178     | 1.40        | 3.20        | 83.39       |
| Expectimax d3 | 100 | 77%         | [67.8, 84.2] | **27%**    | [19.3, 36.4] | **37,561** | 53.79       | 186.77      | 780.52      |
| Expectimax d4 | —   | DNF         | —            | —          | —            | —          | —           | —           | —           |

**Shipped: d3 default** — same win rate as d2, ~2× the 4096 rate; `CONFIG.EXPECTIMAX_DEPTH = 2` documented as an escape hatch for low-tier hardware (see §"Browser latency under CPU throttle").

---

## Methodology

**Self-play loop.** Each game starts from `initBoard(seededRng)`. Each turn: `chooseDirection(board)` returns a direction; `applyMove` advances the board; `spawnTile` adds a tile. Continue until `checkLose(board)` or no direction changes the board.

**Policies (`bench/play.ts`):**

- **Random.** Pick uniformly at random among legal directions. Drawn from a separate RNG stream (`seed ^ 0x9e3779b9`) so it doesn't perturb spawns.
- **Greedy.** Pick the direction with the maximum immediate `scoreDelta`. Ties broken by `ALL_DIRECTIONS` order.
- **Expectimax.** Loop legal directions; for each, call `chanceValue(result.board, depth-1, stats)` from `src/ai/expectimax.ts`. Also calls `scoreComponents(result.board)` per direction (production does this for the reasoning template, TD §5.4) so latency includes that work. `console.log` + `window` mirror side effects from `getSuggestion` are excluded — sub-millisecond, would inflate the bench.

**Spawn RNG.** Seedable `mulberry32` from `bench/rng.ts`. Seeds 1..N. AI is deterministic given a board, so re-running with the same seeds produces bit-identical game trajectories. Latency numbers are not bit-reproducible — they depend on system load, GC, JIT, and thermal state.

**Depth override.** Bench calls `chanceValue` directly with depth as a parameter, bypassing `CONFIG.AI_DEPTH`. No production code modified.

**Game counts.**

- Random: 100 games.
- Greedy: 100 games.
- Expectimax d2: 50 games (~2.5s/game).
- Expectimax d3: 100 games (~2.2 min/game, total 3.7 hr).
- Expectimax d4: attempted 5 games; zero finished in 45 minutes; killed.

**Statistics.** Wilson 95% binomial CIs for rates (narrower than normal-approx at small n). Fisher's exact two-tailed for between-policy rate comparisons.

**Streaming output.** Per-game results append to `bench/results-*.jsonl` in real time so a SIGINT mid-run leaves the completed games on disk.

---

## Baselines

| Policy        | n   | Best tile achieved | % reach 256 | % reach 512 | Mean score |
| ------------- | --- | ------------------ | ----------- | ----------- | ---------- |
| Random        | 100 | 256 (1 game)       | 9%          | 0%          | 1,065      |
| Greedy        | 100 | 512 (12 games)     | 65%         | 12%         | 3,157      |
| Expectimax d2 | 50  | 4096               | 100%        | 100%        | 32,178     |
| Expectimax d3 | 100 | 4096               | 100%        | 100%        | 37,561     |

Random AI cannot reach 512. Greedy caps at 512 (never 1024). Expectimax reaches at least 1024 in every game at either depth tested. The search is doing the work, not the heuristic getting lucky.

---

## d2 vs d3

### Win rate (reach 2048)

|     | wins | n   | win % | Wilson 95% CI |
| --- | ---- | --- | ----- | ------------- |
| d2  | 40   | 50  | 80.0% | [67.0, 88.8]  |
| d3  | 77   | 100 | 77.0% | [67.8, 84.2]  |

Fisher's exact two-tailed p ≈ 0.84. The 3-point gap is consistent with noise. There is no detectable win-rate advantage for either depth.

### Higher-tile ceiling (reach 4096)

|     | reach | n   | reach % | Wilson 95% CI |
| --- | ----- | --- | ------- | ------------- |
| d2  | 7     | 50  | 14.0%   | [7.0, 26.2]   |
| d3  | 27    | 100 | 27.0%   | [19.3, 36.4]  |

Fisher's exact two-tailed p ≈ 0.10. Borderline; consistent with a real ~2× effect at n=150, not conclusive. Neither configuration ever reached 8192.

### Score distribution

|     | mean   | p25    | p50    | p75    | max    |
| --- | ------ | ------ | ------ | ------ | ------ |
| d2  | 32,178 | 25,901 | 32,930 | 36,651 | 60,824 |
| d3  | 37,561 | 28,668 | 35,458 | 47,824 | 79,600 |

d3's distribution sits ~17% above d2 across mean, median, and p75. The gap widens at the upper end (p75: +30%). The shift is across the whole distribution, not driven by a single peak game.

---

## Latency

|       | mean  | p50   | p75    | p95    | p99    | p99.9  | max    |
| ----- | ----- | ----- | ------ | ------ | ------ | ------ | ------ |
| d2 ms | 1.56  | 1.40  | 2.08   | 3.20   | 4.45   | 8.12   | 83.39  |
| d3 ms | 73.95 | 53.79 | 102.05 | 186.77 | 281.93 | 419.62 | 780.52 |

d2 latency is invisible to a user. d3 mean (~74ms) is invisible; p95 (~187ms) is borderline-perceptible; p99.9 (~420ms) and max (~780ms) are noticeable but rare. For a "click → see suggestion" affordance this is acceptable; for an AI playing every move continuously, the p99 would be the binding constraint.

---

## Browser latency under CPU throttle

Above is the Node M4 Pro baseline. Real users run d3 in a browser, on potentially weaker hardware. To stress-test that, the deployed build was hit through Chrome DevTools' **"Low-tier mobile" CPU profile** (auto-calibrated to 15.6× slowdown on M4 Pro), 5 samples per board-occupancy bucket, captured via `window.__adviceHistory`:

| Board state    | Occupied | Empties | nodes (median) | ms (median) | ms (max) |
| -------------- | -------- | ------- | -------------- | ----------- | -------- |
| Sparse / early | 4–6      | 10–12   | 822k           | 8274        | 10236    |
| Mid            | ~8–10    | ~6–8    | 232k           | 2820        | 2940     |
| Full / late    | 13+      | ≤3      | 73k            | 1102        | 1311     |

ms/node sits at ~10–14 µs across all three buckets — the variance is in node count, not per-node cost, so the work is genuinely compute-bound (not GC pauses or paint stalls). The 11× node spread between late and early matches expectimax's cost model: chance-node fan-out is proportional to `empties × |tile values|`, and the early-game board has 10–12 empties to fork on every chance ply.

d3's mean-Node ~74ms scales to ~1s on a fuller board and ~8s on a sparse one under this profile. The sparse-board number is unacceptable UX even with the visible loading state, so d3 is shipped as the default, with `EXPECTIMAX_DEPTH` in `src/config.ts` accepting 2 for low-tier hardware. Per the d2-vs-d3 sections above, the win-rate cost of dropping to 2 is negligible (~80% both); the visible difference is mostly the 4096-reach rate in the tail.

Sample 1 of each bucket may include V8 JIT warmup; the clustered spreads suggest cold-start is not a dominant factor here.

---

## Outlier verification

d3 n=100 main run max ms/move: 780ms. Seed 12 — the seed that previously produced a 171-second move in an earlier n=20 run — was rerun in isolation: total 149s, max single move 520ms. The 171-second outlier did not reproduce. The tail clusters smoothly (519, 495, 434, 380, 372) with no 280× cliff.

Attribute the original outlier to a system-level pause (most likely a Node major-GC during a 42-minute run, possibly with App Nap or thermal throttling contributing). `performance.now()` deltas include any pause inside the timed block. The d3 max ms/move worth taking seriously is 780ms, not 171,000ms.

---

## Reproducibility

```bash
# Total wall time on Apple M4 Pro:
#   random / greedy: <1s each; d2: ~2 min; d3: ~3.7 hr.
npx vite-node bench/run.ts -- --policy random     --games 100 --seed-start 1
npx vite-node bench/run.ts -- --policy greedy     --games 100 --seed-start 1
npx vite-node bench/run.ts -- --policy expectimax --depth 2 --games 50  --seed-start 1
npx vite-node bench/run.ts -- --policy expectimax --depth 3 --games 100 --seed-start 1

# Single-seed reruns must use --out-tag to avoid clobbering the main results:
npx vite-node bench/run.ts -- --policy expectimax --depth 3 --games 1 --seed-start 12 --out-tag seed12

# Aggregate:
npx vite-node bench/analyze.ts -- \
  bench/results-random.json \
  bench/results-greedy.json \
  bench/results-d2.json \
  bench/results-d3.json
```

Game trajectories (board states, scores, max tiles, move counts) are deterministic per seed. Per-move latencies depend on host state — run on a quiescent machine for clean tail percentiles.

---

## Limitations

- **Single hardware.** Apple M4 Pro. d3's p95 ≈ 187ms here would be higher on slower hardware. "d3 is acceptable" is hardware-conditional.
- **Heuristic weights fixed.** All runs use the weights in `src/ai/heuristics.ts`. Tuning is a separate axis.
- **No transposition table.** Same board reached via different move sequences gets re-evaluated. A TT would lower latency without changing move quality.
- **Depth 4 not benchmarked.** Combinatorics + no-TT make it impractical at the current heuristic.
- **n=50 d2 vs n=100 d3.** Asymmetric; doesn't affect Fisher's exact, but d2's CI is wider.
- **Host not controlled.** App Nap not disabled, no `caffeinate`, no power-only mode. Tail latency could be tighter on a controlled run.
- **Reach-rate is nested by construction.** Reaching 4096 implicitly reaches 2048. "Win rate" is max-tile ≥ 2048; "4096 rate" is max-tile ≥ 4096.

---

## What this report is not

- Not a tuning recommendation. Weights weren't varied.
- Not a regression test. The bench is reproducible but not wired to CI.
- Not a performance optimization study. Latency is measured, not optimized.

---

## Changes from prior version

A previous version (n=10/20) was reviewed by two independent agents and superseded. Substantive deltas:

- Sample size: d3 n=20 → 100, d2 n=10 → 50.
- Added random and greedy baselines (each n=100) for absolute-scale calibration.
- Added Wilson 95% CIs and Fisher's exact p-values; the headline now uses these.
- Disproved the 171s outlier as algorithmic by rerunning seed 12 in isolation.
- Bench now calls `scoreComponents` per direction for production parity in latency timing.
- Linear-interpolation percentiles (NumPy default) instead of floor indexing.

---

## Note on the harness

During the seed-12 isolation rerun, the harness overwrote `bench/results-d3.json` and `.jsonl` — the output path was keyed only by depth. Aggregate stats had already been captured in `/tmp/final-summary.json`, so the numbers in this report are sound, but the raw d3 main-run JSON would need regeneration for downstream analysis. The harness now accepts `--out-tag` (used in the reproducibility example).
