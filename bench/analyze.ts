// Aggregates bench results into the summary stats reported in BENCHMARK_REPORT.md
// (score quantiles, max-tile distribution, ms-per-move tail, Wilson reach-rate CIs).
// Usage: npx vite-node bench/analyze.ts -- bench/results-d2.json bench/results-d3.json ...
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GameStats } from './play';

type Run = {
  policy?: string;
  depth: number;
  games: number;
  seedStart: number;
  results: GameStats[];
};

const MILESTONES = [256, 512, 1024, 2048, 4096, 8192];

// Linear interpolation percentile — matches NumPy's default. Expects sorted asc.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function mean(a: number[]): number {
  if (a.length === 0) return 0;
  let s = 0;
  for (const x of a) s += x;
  return s / a.length;
}

// Wilson 95% binomial CI — narrower than normal-approx at small n.
function wilsonCi(successes: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 0 };
  const z = 1.96;
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = phat + (z * z) / (2 * n);
  const halfwidth = z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return {
    lo: +(((centre - halfwidth) / denom) * 100).toFixed(1),
    hi: +(((centre + halfwidth) / denom) * 100).toFixed(1),
  };
}

function summarize(run: Run) {
  const n = run.results.length;
  const scoresAsc = run.results.map((r) => r.score).sort((a, b) => a - b);
  const movesAsc = run.results.map((r) => r.moves).sort((a, b) => a - b);
  const totalMsAsc = run.results.map((r) => r.totalMs).sort((a, b) => a - b);
  const msAsc = run.results.flatMap((r) => r.msPerMove).sort((a, b) => a - b);
  const nodesAsc = run.results.flatMap((r) => r.nodesPerMove).sort((a, b) => a - b);

  const reachCount: Record<number, number> = {};
  for (const m of MILESTONES) reachCount[m] = 0;
  for (const r of run.results) for (const m of r.reached) reachCount[m]++;

  const reachRate: Record<number, { rate: number; ci95: { lo: number; hi: number } }> = {};
  for (const m of MILESTONES) {
    reachRate[m] = {
      rate: +(reachCount[m] / n).toFixed(3),
      ci95: wilsonCi(reachCount[m], n),
    };
  }

  const maxTileCounts: Record<number, number> = {};
  for (const r of run.results) maxTileCounts[r.maxTile] = (maxTileCounts[r.maxTile] ?? 0) + 1;

  return {
    policy: run.policy ?? 'expectimax',
    depth: run.depth,
    n,
    score: {
      mean: Math.round(mean(scoresAsc)),
      p25: Math.round(percentile(scoresAsc, 25)),
      p50: Math.round(percentile(scoresAsc, 50)),
      p75: Math.round(percentile(scoresAsc, 75)),
      min: scoresAsc[0],
      max: scoresAsc[scoresAsc.length - 1],
    },
    maxTileDistribution: maxTileCounts,
    movesPerGame: {
      mean: Math.round(mean(movesAsc)),
      p50: Math.round(percentile(movesAsc, 50)),
    },
    timePerGameSec: {
      mean: +(mean(totalMsAsc) / 1000).toFixed(1),
      p50: +(percentile(totalMsAsc, 50) / 1000).toFixed(1),
    },
    msPerMove: {
      mean: +mean(msAsc).toFixed(2),
      p50: +percentile(msAsc, 50).toFixed(2),
      p75: +percentile(msAsc, 75).toFixed(2),
      p95: +percentile(msAsc, 95).toFixed(2),
      p99: +percentile(msAsc, 99).toFixed(2),
      p999: +percentile(msAsc, 99.9).toFixed(2),
      max: +(msAsc[msAsc.length - 1] ?? 0).toFixed(2),
      samples: msAsc.length,
    },
    nodesPerMove: {
      mean: Math.round(mean(nodesAsc)),
      p95: Math.round(percentile(nodesAsc, 95)),
    },
    reachRate,
  };
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('usage: vite-node bench/analyze.ts -- <results-*.json>...');
  process.exit(1);
}

const summaries = files.map((f) => {
  const run = JSON.parse(readFileSync(resolve(process.cwd(), f), 'utf8')) as Run;
  return summarize(run);
});

console.log(JSON.stringify(summaries, null, 2));
