import { describe, it, expect } from 'vitest';
import { boardsEqual } from './board';
import type { Board } from './types';

describe('boardsEqual', () => {
  it('returns true for the same reference', () => {
    const board: Board = [
      [2, 4, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(boardsEqual(board, board)).toBe(true);
  });

  it('returns true for distinct boards with identical values', () => {
    const a: Board = [
      [2, 4, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const b: Board = [
      [2, 4, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(boardsEqual(a, b)).toBe(true);
  });

  it('returns false on single-cell difference at [0][0]', () => {
    const a: Board = [
      [2, 4, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const b: Board = [
      [8, 4, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(boardsEqual(a, b)).toBe(false);
  });

  it('returns false on single-cell difference at [3][3] (full traversal)', () => {
    const a: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    const b: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, 4],
    ];
    expect(boardsEqual(a, b)).toBe(false);
  });

  it('treats null and 0 as different (null is the canonical empty marker)', () => {
    const withNulls: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const withZeros: Board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(boardsEqual(withNulls, withZeros)).toBe(false);
  });
});
