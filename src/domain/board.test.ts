import { describe, it, expect } from 'vitest';
import { boardsEqual, checkWin, checkLose, initBoard, spawnTile } from './board';
import { CONFIG } from '../config';
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

describe('initBoard', () => {
  it('places between INIT_TILE_COUNT.min and max tiles, all value 2', () => {
    const board = initBoard();
    const tiles = board.flat().filter((cell) => cell !== null);
    expect(tiles.length).toBeGreaterThanOrEqual(CONFIG.INIT_TILE_COUNT.min);
    expect(tiles.length).toBeLessThanOrEqual(CONFIG.INIT_TILE_COUNT.max);
    expect(tiles.every((tile) => tile === 2)).toBe(true);
  });

  it('produces neither a winning nor losing initial board', () => {
    const board = initBoard();
    expect(checkWin(board, CONFIG.WIN_TILE)).toBe(false);
    expect(checkLose(board)).toBe(false);
  });

  it('returns a new board reference on each call', () => {
    const first = initBoard();
    const second = initBoard();
    expect(first).not.toBe(second);
  });

  it('varies tile count across many calls', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const board = initBoard();
      counts.add(board.flat().filter((cell) => cell !== null).length);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('is deterministic when given the same RNG (case 7)', () => {
    const first = initBoard(() => 0.5);
    const second = initBoard(() => 0.5);
    expect(boardsEqual(first, second)).toBe(true);
  });
});

describe('spawnTile', () => {
  const emptyBoard: Board = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];

  it('places exactly one tile on an empty board', () => {
    const result = spawnTile(emptyBoard, () => 0);
    const tiles = result.flat().filter((cell) => cell !== null);
    expect(tiles.length).toBe(1);
  });

  it('places a tile in the only empty cell when one remains', () => {
    const board: Board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [8192, 16384, 32768, null],
    ];
    const result = spawnTile(board, () => 0);
    expect(result[3]![3]).not.toBe(null);
  });

  it('preserves existing tiles', () => {
    const board: Board = [
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const result = spawnTile(board, () => 0.5);
    expect(result[0]![0]).toBe(2);
  });

  it('returns a new board reference and does not mutate input', () => {
    const snapshot = JSON.stringify(emptyBoard);
    const result = spawnTile(emptyBoard, () => 0);
    expect(JSON.stringify(emptyBoard)).toBe(snapshot);
    expect(result).not.toBe(emptyBoard);
  });

  it('with rng returning 0, spawns a 2 at [0][0]', () => {
    const result = spawnTile(emptyBoard, () => 0);
    const placed = result.flat().filter((cell) => cell !== null);
    expect(placed).toEqual([2]);
    // floor(0 * 16) = 0 → first empty position is [0][0]
    expect(result[0]![0]).toBe(2);
  });

  it('with rng returning 0.95, spawns a 4 at [3][3]', () => {
    const result = spawnTile(emptyBoard, () => 0.95);
    const placed = result.flat().filter((cell) => cell !== null);
    expect(placed).toEqual([4]);
    // floor(0.95 * 16) = 15 → last empty position is [3][3]
    expect(result[3]![3]).toBe(4);
  });

  it('uses default RNG when no rng arg is provided', () => {
    const result = spawnTile(emptyBoard);
    const tiles = result.flat().filter((cell) => cell !== null);
    expect(tiles.length).toBe(1);
    expect([2, 4]).toContain(tiles[0]);
  });

  it('throws when no empty cells remain (full board)', () => {
    const fullBoard: Board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4096],
      [8192, 16384, 32768, 65536],
    ];
    expect(() => spawnTile(fullBoard, () => 0)).toThrow();
  });

  it('spawned value is always 2 or 4 across many calls', () => {
    for (let i = 0; i < 50; i++) {
      const result = spawnTile(emptyBoard);
      const placed = result.flat().filter((cell) => cell !== null);
      expect([2, 4]).toContain(placed[0]);
    }
  });

  it('cell selection covers every empty position over many calls', () => {
    const seenFlatIndices = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const result = spawnTile(emptyBoard);
      result.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell !== null) seenFlatIndices.add(r * 4 + c);
        });
      });
    }
    expect(seenFlatIndices.size).toBe(16);
  });
});
