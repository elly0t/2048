import type { Board, Row } from '../domain/types';
import { transpose } from '../domain/moves';

// Weights and formula per TD §5.3. Components return raw scores;
// aggregation (H = α·M + β·S + γ·E + δ·C) lives at the expectimax leaf.
// Values from nneonneo's published 2048 AI analysis.

// Heuristics use log₂ space — gaps between tiles become merge-distances.
// (2, 4) and (1024, 2048) are both 1 merge apart, weighted equally.
// In raw values they differ by 500×, big tiles would dominate.

function rowMonotonicity(row: Row): number {
  // Score the row under two hypotheses (each ≤ 0; closer to 0 is better):
  //   bigOnLeft  — row should descend going left → right (e.g. [16, 8, 4, 2])
  //   bigOnRight — row should ascend  going left → right (e.g. [2, 4, 8, 16])
  // Each adjacent pair pays a penalty in the hypothesis it contradicts.
  // Pairs containing a null are skipped — empties carry no order signal.
  // Return the better hypothesis: sorted-either-way rows escape; zigzag pays.
  let bigOnLeft = 0;
  let bigOnRight = 0;
  for (let i = 0; i + 1 < row.length; i++) {
    const a = row[i]!;
    const b = row[i + 1]!;
    if (a === null || b === null) continue;
    const current = Math.log2(a);
    const next = Math.log2(b);
    if (current > next) bigOnRight += next - current;
    else bigOnLeft += current - next;
  }
  return Math.max(bigOnLeft, bigOnRight);
}

export function monotonicity(board: Board): number {
  const horizontal = board.reduce((sum, row) => sum + rowMonotonicity(row), 0);
  const vertical = transpose(board).reduce((sum, row) => sum + rowMonotonicity(row), 0);
  return horizontal + vertical;
}

function rowSmoothness(row: Row): number {
  let total = 0;
  for (let i = 0; i + 1 < row.length; i++) {
    const a = row[i]!;
    const b = row[i + 1]!;
    if (a === null || b === null) continue;
    total -= Math.abs(Math.log2(a) - Math.log2(b));
  }
  return total;
}

export function smoothness(board: Board): number {
  const horizontal = board.reduce((sum, row) => sum + rowSmoothness(row), 0);
  const vertical = transpose(board).reduce((sum, row) => sum + rowSmoothness(row), 0);
  return horizontal + vertical;
}

export function cornerBonus(board: Board): number {
  let maxValue = 0;
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell !== null && cell > maxValue) maxValue = cell;
    });
  });
  if (maxValue === 0) return 0;
  // Reward if ANY corner holds the max — ties on max value should not be
  // resolved by iteration order. Both [0][0] and [3][3] qualifying is fine.
  const corners = [board[0]![0], board[0]![3], board[3]![0], board[3]![3]];
  return corners.includes(maxValue) ? Math.log2(maxValue) : 0;
}

export function emptyCells(board: Board): number {
  // log₂(max(count, 1)) — guarded against -Infinity on a full board (TD §5.3).
  const count = board.reduce(
    (sum, row) => sum + row.filter((cell) => cell === null).length,
    0,
  );
  return Math.log2(Math.max(count, 1));
}
