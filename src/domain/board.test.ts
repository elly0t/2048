import { describe, it, expect } from 'vitest';
import { boardsEqual, checkWin, checkLose } from './board';
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

describe('checkWin', () => {
  it('returns true when board contains the win tile', () => {
    const board: Board = [
      [4, null, null, 2],
      [2048, null, null, null],
      [4, 2, null, null],
      [4, null, null, null],
    ];
    expect(checkWin(board, 2048)).toBe(true);
  });

  it('returns false when only tiles above the win tile exist (post-win merge state)', () => {
    const board: Board = [
      [4096, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkWin(board, 2048)).toBe(false);
  });

  it('returns false when max tile is below the win tile', () => {
    const board: Board = [
      [1024, 512, 256, 128],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkWin(board, 2048)).toBe(false);
  });

  it('returns false on empty board', () => {
    const board: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkWin(board, 2048)).toBe(false);
  });

  it('detects the win tile in any of 16 positions', () => {
    for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
      for (let colIndex = 0; colIndex < 4; colIndex++) {
        const board: Board = [
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ];
        board[rowIndex]![colIndex] = 2048;
        expect(checkWin(board, 2048), `position [${rowIndex}][${colIndex}]`).toBe(true);
      }
    }
  });

  it('respects a configurable winTile', () => {
    const board: Board = [
      [1024, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkWin(board, 1024)).toBe(true);
    expect(checkWin(board, 2048)).toBe(false);
  });
});

describe('checkLose', () => {
  it('returns true on classic checkerboard lose state', () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(checkLose(board)).toBe(true);
  });

  it('returns false when a full board has a mergeable adjacent pair', () => {
    const board: Board = [
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ];
    expect(checkLose(board)).toBe(false);
  });

  it('returns false when at least one cell is empty', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, null],
    ];
    expect(checkLose(board)).toBe(false);
  });

  it('returns false on empty board', () => {
    const board: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkLose(board)).toBe(false);
  });

  it('returns false when full board has a horizontal adjacent pair only', () => {
    const board: Board = [
      [2, 2, 4, 8],
      [16, 32, 64, 128],
      [4, 8, 16, 32],
      [64, 128, 256, 512],
    ];
    expect(checkLose(board)).toBe(false);
  });

  it('returns false when full board has a vertical adjacent pair only', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [2, 8, 16, 32],
      [4, 16, 32, 64],
      [8, 32, 64, 128],
    ];
    expect(checkLose(board)).toBe(false);
  });

  it('returns true when only diagonals are equal (diagonals do not merge)', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [4, 2, 16, 8],
      [8, 16, 2, 4],
      [16, 8, 4, 2],
    ];
    expect(checkLose(board)).toBe(true);
  });

  it('returns true when win tile is present but no moves available (independent of checkWin)', () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2048],
    ];
    expect(checkLose(board)).toBe(true);
  });

  it('returns false before spawn fills last cell, true after if no merges remain', () => {
    const beforeSpawn: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, null],
    ];
    expect(checkLose(beforeSpawn)).toBe(false);

    const afterSpawn: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(checkLose(afterSpawn)).toBe(true);
  });

  it('returns true on full board with all 16 distinct values', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [8192, 16384, 32768, 65536],
    ];
    expect(checkLose(board)).toBe(true);
  });
});
