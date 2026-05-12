import type { Board } from '../domain/types';
import { ALL_DIRECTIONS } from '../domain/types';
import { applyMove } from '../domain/moves';
import { cloneWithCell, emptyCellPositions } from '../domain/board';
import { CONFIG } from '../config';
import { monotonicity, smoothness, cornerBonus, emptyCells } from './heuristics';

// Weights from nneonneo's 2048 AI analysis (TD §5.3).
export const WEIGHTS = {
  monotonicity: 1.0,
  smoothness: 0.1,
  emptyCells: 2.7,
  cornerBonus: 1.0,
} as const;

export type SearchStats = { nodesEvaluated: number };

const SPAWN_OUTCOMES: ReadonlyArray<{ value: number; prob: number }> = [
  { value: 2, prob: CONFIG.SPAWN_WEIGHTS[2] },
  { value: 4, prob: CONFIG.SPAWN_WEIGHTS[4] },
];

function leafValue(board: Board): number {
  return (
    WEIGHTS.monotonicity * monotonicity(board) +
    WEIGHTS.smoothness * smoothness(board) +
    WEIGHTS.emptyCells * emptyCells(board) +
    WEIGHTS.cornerBonus * cornerBonus(board)
  );
}

// Max node. No valid direction → leaf H (lose-state fallback).
function maxValue(board: Board, depth: number, stats?: SearchStats): number {
  if (depth === 0) {
    if (stats) stats.nodesEvaluated++;
    return leafValue(board);
  }

  const childValues = ALL_DIRECTIONS.map((direction) => applyMove(board, direction))
    .filter((result) => result.changed)
    .map((result) => chanceValue(result.board, depth - 1, stats));

  if (childValues.length === 0) {
    if (stats) stats.nodesEvaluated++;
    return leafValue(board);
  }
  return Math.max(...childValues);
}

// Chance node. E[v] = (1 / |empties|) · Σ P(outcome) · maxValue(spawn).
// Full board: no spawn, recurse to maxValue at the same depth.
// Exported for tests + bench/play.ts (production parity) — don't inline.
export function chanceValue(board: Board, depth: number, stats?: SearchStats): number {
  const empties = emptyCellPositions(board);
  if (empties.length === 0) return maxValue(board, depth, stats);

  let total = 0;
  empties.forEach(([rowIndex, colIndex]) => {
    SPAWN_OUTCOMES.forEach(({ value, prob }) => {
      total += prob * maxValue(cloneWithCell(board, rowIndex, colIndex, value), depth, stats);
    });
  });
  return total / empties.length;
}

// TODO(phase 2): adaptive depth via computeDepth(board) — see TD §5.2.
export function expectimax(
  board: Board,
  depth: number = CONFIG.EXPECTIMAX_DEPTH,
  stats?: SearchStats,
): number {
  return maxValue(board, depth, stats);
}
