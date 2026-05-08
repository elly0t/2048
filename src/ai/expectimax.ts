import type { Board, Direction } from '../domain/types';
import { DIRECTION } from '../domain/types';
import { applyMove } from '../domain/moves';
import { CONFIG } from '../config';
import { monotonicity, smoothness, cornerBonus, emptyCells } from './heuristics';

// Weights for the heuristic aggregator H(board) = α·M + β·S + γ·E + δ·C.
// Values from nneonneo's 2048 AI analysis (cited in TD §5.3).
export const WEIGHTS = {
  monotonicity: 1.0,
  smoothness: 0.1,
  emptyCells: 2.7,
  cornerBonus: 1.0,
} as const;

const ALL_DIRECTIONS: readonly Direction[] = [
  DIRECTION.LEFT,
  DIRECTION.RIGHT,
  DIRECTION.UP,
  DIRECTION.DOWN,
];

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

// Max node. Tries each direction; recurses through chance node on ones that
// changed the board. If no direction changes the board (lose state), returns
// the leaf heuristic so the caller still gets a comparable value.
function maxValue(board: Board, depth: number): number {
  if (depth === 0) return leafValue(board);

  let best = -Infinity;
  let anyChanged = false;
  for (const direction of ALL_DIRECTIONS) {
    const result = applyMove(board, direction);
    if (!result.changed) continue;
    anyChanged = true;
    const value = chanceValue(result.board, depth - 1);
    if (value > best) best = value;
  }
  return anyChanged ? best : leafValue(board);
}

// Chance node. After a player move, one tile spawns at a uniformly chosen
// empty cell with value 2 (P=0.9) or 4 (P=0.1).
//   E[v] = (1/|empties|) · Σ_cell  Σ_outcome  P(outcome) · maxValue(spawn)
// If the board is full, no spawn happens — drain a depth and recurse.
function chanceValue(board: Board, depth: number): number {
  const empties: Array<[number, number]> = [];
  for (let rowIndex = 0; rowIndex < board.length; rowIndex++) {
    const row = board[rowIndex]!;
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      if (row[colIndex] === null) empties.push([rowIndex, colIndex]);
    }
  }
  if (empties.length === 0) return maxValue(board, depth);

  let total = 0;
  for (const [rowIndex, colIndex] of empties) {
    for (const { value, prob } of SPAWN_OUTCOMES) {
      const next = board.map((row) => row.slice());
      next[rowIndex]![colIndex] = value;
      total += prob * maxValue(next, depth);
    }
  }
  return total / empties.length;
}

export function expectimax(
  board: Board,
  depth: number = CONFIG.EXPECTIMAX_DEPTH,
): number {
  return maxValue(board, depth);
}
