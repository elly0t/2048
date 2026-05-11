// CLI driver behind the runs reported in BENCHMARK_REPORT.md. One policy per invocation.
// Usage:
//   npx vite-node bench/run.ts -- --policy expectimax --depth 3 --games 100
//   npx vite-node bench/run.ts -- --policy random --games 100
//   npx vite-node bench/run.ts -- --policy greedy  --games 100
import { writeFileSync, appendFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { playOneGame, type GameStats, type PolicyName } from './play';

function parseNum(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return Number(process.argv[idx + 1]);
  return fallback;
}

function parseStr(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const policy = parseStr('policy', 'expectimax') as PolicyName;
const depth = parseNum('depth', 3);
const games = parseNum('games', 50);
const seedStart = parseNum('seed-start', 1);
const moveCap = parseNum('move-cap', 5000);
const outTag = parseStr('out-tag', ''); // optional suffix to keep partial reruns from clobbering main results

const baseTag = policy === 'expectimax' ? `d${depth}` : policy;
const tag = outTag ? `${baseTag}-${outTag}` : baseTag;
const jsonPath = resolve(process.cwd(), `bench/results-${tag}.json`);
const jsonlPath = resolve(process.cwd(), `bench/results-${tag}.jsonl`);

console.error(
  `[bench] policy=${policy}${policy === 'expectimax' ? ` depth=${depth}` : ''} games=${games} seedStart=${seedStart} moveCap=${moveCap}`,
);

// Stream JSONL per game so a SIGINT mid-run still leaves the completed games on disk.
if (existsSync(jsonlPath)) unlinkSync(jsonlPath);

const results: GameStats[] = [];
const overallStart = Date.now();
for (let i = 0; i < games; i++) {
  const seed = seedStart + i;
  const t0 = Date.now();
  const stats = playOneGame(seed, policy, depth, moveCap);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.error(
    `[bench] seed=${seed} score=${stats.score} max=${stats.maxTile} moves=${stats.moves} ${elapsed}s reason=${stats.terminalReason}`,
  );
  results.push(stats);
  appendFileSync(jsonlPath, JSON.stringify(stats) + '\n');
}
const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
console.error(`[bench] done in ${totalElapsed}s`);

writeFileSync(
  jsonPath,
  JSON.stringify({ policy, depth, games, seedStart, results }, null, 2),
);
console.error(`[bench] wrote ${jsonPath}`);
process.stdout.write(JSON.stringify({ policy, depth, games, jsonPath }) + '\n');
