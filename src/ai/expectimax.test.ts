import { describe, it, expect } from 'vitest';
import { expectimax, WEIGHTS } from './expectimax';
import { monotonicity, smoothness, cornerBonus, emptyCells } from './heuristics';
import type { Board } from '../domain/types';

const emptyBoard: Board = [
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
];

const loseBoard: Board = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
];

const sortedBoard: Board = [
  [2, 4, 8, 16],
  [4, 8, 16, 32],
  [8, 16, 32, 64],
  [16, 32, 64, 128],
];

function manualH(board: Board): number {
  return (
    WEIGHTS.monotonicity * monotonicity(board) +
    WEIGHTS.smoothness * smoothness(board) +
    WEIGHTS.emptyCells * emptyCells(board) +
    WEIGHTS.cornerBonus * cornerBonus(board)
  );
}

describe('expectimax — leaf evaluation (cases 1, 8)', () => {
  it('depth 0 returns full H(board)', () => {
    expect(expectimax(sortedBoard, 0)).toBeCloseTo(manualH(sortedBoard));
  });

  it('depth 0 leaf uses full α·M + β·S + γ·E + δ·C formula', () => {
    const board: Board = [
      [2, 4, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(expectimax(board, 0)).toBeCloseTo(manualH(board));
  });
});

describe('expectimax — terminal lose board (case 2)', () => {
  it('depth 1 on lose board returns leaf heuristic (no max-children)', () => {
    expect(expectimax(loseBoard, 1)).toBeCloseTo(manualH(loseBoard));
  });
});

describe('expectimax — completes within budget (cases 3, 7)', () => {
  it('depth 3 on empty board (worst-case branching) finishes under 1s', () => {
    const start = Date.now();
    expectimax(emptyBoard, 3);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('expectimax — chance node weighting (case 4)', () => {
  it('produces a finite value on a board with one empty cell (smoke)', () => {
    // Real 0.9/0.1 weighting verification belongs in a hand-checked equality
    // test once impl lands; this is a smoke check that the chance branch
    // executes without NaN/Infinity. Tighten later.
    const board: Board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [8192, 16384, 32768, null],
    ];
    expect(Number.isFinite(expectimax(board, 1))).toBe(true);
  });
});

describe('expectimax — purity (case 5)', () => {
  it('does not mutate the input board', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const snapshot = JSON.stringify(board);
    expectimax(board, 2);
    expect(JSON.stringify(board)).toBe(snapshot);
  });
});

describe('expectimax — determinism (case 6)', () => {
  it('returns identical value across repeated calls', () => {
    expect(expectimax(sortedBoard, 2)).toBe(expectimax(sortedBoard, 2));
  });
});
