// Single-game self-play harness backing the empirical results in BENCHMARK_REPORT.md.
// Policy-pluggable: expectimax(depth), random, greedy. Expectimax mirrors getSuggestion's
// per-direction loop — scoreComponents runs per legal direction so measured ms/move
// covers the same work production does, not just the search.
import type { Board, Direction } from '../src/domain/types';
import { ALL_DIRECTIONS } from '../src/domain/types';
import { applyMove } from '../src/domain/moves';
import { initBoard, spawnTile, checkLose } from '../src/domain/board';
import { chanceValue, type SearchStats } from '../src/ai/expectimax';
import { scoreComponents } from '../src/ai/heuristics';
import { mulberry32 } from './rng';

export type PolicyName = 'random' | 'greedy' | 'expectimax';

// Per-game record streamed to results-*.jsonl. Schema consumed by analyze.ts.
// `depth` is 0 for non-expectimax policies — kept on the type for schema stability.
export type GameStats = {
  seed: number;
  policy: PolicyName;
  depth: number;
  score: number;
  maxTile: number;
  moves: number;
  totalMs: number;
  msPerMove: number[];
  nodesPerMove: number[];
  reached: number[];
  terminalReason: 'lose' | 'no-direction' | 'move-cap';
};

function maxTileOf(board: Board): number {
  let m = 0;
  for (const row of board) for (const cell of row) if (cell !== null && cell > m) m = cell;
  return m;
}

function legalDirections(board: Board): Direction[] {
  return ALL_DIRECTIONS.filter((d) => applyMove(board, d).changed);
}

type DecisionFn = (board: Board) => { direction: Direction | null; nodes: number; ms: number };

// Random policy: pick uniformly among legal directions.
function makeRandomPolicy(rng: () => number): DecisionFn {
  return (board) => {
    const start = performance.now();
    const legal = legalDirections(board);
    if (legal.length === 0) return { direction: null, nodes: 0, ms: performance.now() - start };
    const idx = Math.floor(rng() * legal.length);
    return { direction: legal[idx], nodes: 0, ms: performance.now() - start };
  };
}

// Greedy policy: pick direction with maximum immediate scoreDelta. Ties broken by
// ALL_DIRECTIONS iteration order — same convention as expectimax.
function makeGreedyPolicy(): DecisionFn {
  return (board) => {
    const start = performance.now();
    let best: Direction | null = null;
    let bestDelta = -1;
    for (const direction of ALL_DIRECTIONS) {
      const result = applyMove(board, direction);
      if (!result.changed) continue;
      if (result.scoreDelta > bestDelta) {
        bestDelta = result.scoreDelta;
        best = direction;
      }
    }
    return { direction: best, nodes: 0, ms: performance.now() - start };
  };
}

// Expectimax policy at a given depth. Calls scoreComponents per direction to
// mirror getSuggestion's full work (reasoning-template input). Production parity.
function makeExpectimaxPolicy(depth: number): DecisionFn {
  return (board) => {
    const start = performance.now();
    const stats: SearchStats = { nodesEvaluated: 0 };
    let best: Direction | null = null;
    let bestScore = -Infinity;
    for (const direction of ALL_DIRECTIONS) {
      const result = applyMove(board, direction);
      if (!result.changed) continue;
      // Production evaluates scoreComponents per direction for the reasoning template.
      // Cheap relative to the search, but kept inside the timing block for parity.
      scoreComponents(result.board);
      const score = chanceValue(result.board, depth - 1, stats);
      if (score > bestScore) {
        bestScore = score;
        best = direction;
      }
    }
    return { direction: best, nodes: stats.nodesEvaluated, ms: performance.now() - start };
  };
}

function makePolicy(policy: PolicyName, depth: number, rng: () => number): DecisionFn {
  if (policy === 'random') return makeRandomPolicy(rng);
  if (policy === 'greedy') return makeGreedyPolicy();
  return makeExpectimaxPolicy(depth);
}

// External entry for one self-play episode. Deterministic given (seed, policy, depth).
// `moveCap` is a safety bound — observed expectimax games end via checkLose well below
// 5000 moves; hitting it surfaces as terminalReason='move-cap' rather than 'lose'.
export function playOneGame(
  seed: number,
  policy: PolicyName,
  depth: number,
  moveCap = 5000,
): GameStats {
  const rng = mulberry32(seed);
  // Random policy needs its own RNG stream so it doesn't perturb spawns.
  // XOR with golden-ratio bits (0x9e3779b9) to decorrelate from the spawn RNG.
  const policyRng = mulberry32(seed ^ 0x9e3779b9);
  const decide = makePolicy(policy, depth, policyRng);

  let board: Board = initBoard(rng);
  let score = 0;
  let moves = 0;
  const msPerMove: number[] = [];
  const nodesPerMove: number[] = [];
  // Reach-rate milestones reported in BENCHMARK_REPORT.md. Mirrors analyze.ts MILESTONES.
  const milestones = [256, 512, 1024, 2048, 4096, 8192];
  const reached = new Set<number>();
  const totalStart = performance.now();
  let terminalReason: GameStats['terminalReason'] = 'lose';

  while (moves < moveCap) {
    if (checkLose(board)) {
      terminalReason = 'lose';
      break;
    }
    const { direction, nodes, ms } = decide(board);
    if (direction === null) {
      terminalReason = 'no-direction';
      break;
    }
    const moveResult = applyMove(board, direction);
    if (!moveResult.changed) {
      terminalReason = 'no-direction';
      break;
    }
    board = moveResult.board;
    score += moveResult.scoreDelta;
    msPerMove.push(ms);
    nodesPerMove.push(nodes);
    moves++;
    const mt = maxTileOf(board);
    for (const m of milestones) if (mt >= m) reached.add(m);
    try {
      board = spawnTile(board, rng);
    } catch {
      // Should be unreachable (post-move board has ≥1 empty cell). Re-throw so a
      // real bug surfaces instead of being silently classified as 'lose'.
      throw new Error(
        `spawnTile threw on a non-full board — bug? seed=${seed} policy=${policy} moves=${moves}`,
      );
    }
  }
  if (moves >= moveCap) terminalReason = 'move-cap';

  return {
    seed,
    policy,
    depth: policy === 'expectimax' ? depth : 0,
    score,
    maxTile: maxTileOf(board),
    moves,
    totalMs: performance.now() - totalStart,
    msPerMove,
    nodesPerMove,
    reached: [...reached].sort((a, b) => a - b),
    terminalReason,
  };
}
