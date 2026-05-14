import { describe, it, expect } from 'vitest';
import { expectimax, WEIGHTS } from './expectimax';
import { monotonicity, smoothness, cornerBonus, emptyCells } from './heuristics';
import { CONFIG } from '../config';
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
  it('weights spawn outcomes per CONFIG.SPAWN_WEIGHTS against hand-computed H', () => {
    // Single-empty-cell board where only Right is a legal move. After Right,
    // the empty slot moves to [3][0]; the chance node spawns 2 or 4 in that cell,
    // weighted by CONFIG.SPAWN_WEIGHTS, and depth-0 evaluates each via leafValue.
    // Pulling the weights from config rather than hardcoding 0.9/0.1 keeps the
    // test honest if the spawn distribution is ever retuned — but still catches
    // a reversed-wiring bug (using p[4] for the 2-spawn term and vice versa).
    const board: Board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [8192, 16384, 32768, null],
    ];
    const postRight: Board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [null, 8192, 16384, 32768],
    ];
    const setCell = (b: Board, value: number): Board =>
      b.map((row, r) => row.map((cell, c) => (r === 3 && c === 0 ? value : cell))) as Board;
    const expected =
      CONFIG.SPAWN_WEIGHTS[2] * manualH(setCell(postRight, 2)) +
      CONFIG.SPAWN_WEIGHTS[4] * manualH(setCell(postRight, 4));
    expect(expectimax(board, 1)).toBeCloseTo(expected, 6);
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
