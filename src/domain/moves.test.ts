import { describe, it, expect } from 'vitest';
import {
  applyMove,
  compressRow,
  mergeRow,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  reflect,
  transpose,
} from './moves';
import { DIRECTION } from './types';
import type { Board } from './types';

describe('compressRow', () => {
  it('packs values toward index 0', () => {
    expect(compressRow([2, null, 2, null])).toEqual([2, 2, null, null]);
  });

  it('returns row unchanged when no nulls', () => {
    expect(compressRow([2, 4, 8, 16])).toEqual([2, 4, 8, 16]);
  });

  it('returns all-null row unchanged', () => {
    expect(compressRow([null, null, null, null])).toEqual([null, null, null, null]);
  });

  it('preserves relative order of non-null values', () => {
    expect(compressRow([null, 4, null, 2])).toEqual([4, 2, null, null]);
  });

  it('moves a single trailing value to index 0', () => {
    expect(compressRow([null, null, null, 2])).toEqual([2, null, null, null]);
  });

  it('leaves all-same-value row unchanged (compress is not merge)', () => {
    expect(compressRow([2, 2, 2, 2])).toEqual([2, 2, 2, 2]);
  });

  it('preserves duplicate values without merging them', () => {
    expect(compressRow([null, 2, 4, 2])).toEqual([2, 4, 2, null]);
  });

  it('treats 0 as a value, not as null (=== null, not Boolean truthiness)', () => {
    expect(compressRow([0, null, 0, null])).toEqual([0, 0, null, null]);
  });
});

describe('mergeRow', () => {
  it('merges independent adjacent pairs without re-merging, leaving gaps', () => {
    expect(mergeRow([2, 2, 2, 2])).toEqual({
      row: [4, null, 4, null],
      scoreDelta: 8,
    });
  });

  it('returns row unchanged when no adjacent equals', () => {
    expect(mergeRow([2, 4, 8, 16])).toEqual({
      row: [2, 4, 8, 16],
      scoreDelta: 0,
    });
  });

  it('merges a single adjacent pair leaving gap', () => {
    expect(mergeRow([2, 2, null, null])).toEqual({
      row: [4, null, null, null],
      scoreDelta: 4,
    });
  });

  it('merges leftmost pair only when third tile has no partner', () => {
    expect(mergeRow([2, 2, 2, null])).toEqual({
      row: [4, null, 2, null],
      scoreDelta: 4,
    });
  });

  it('sums scoreDelta across multiple merges of different values', () => {
    expect(mergeRow([4, 4, 8, 8])).toEqual({
      row: [8, null, 16, null],
      scoreDelta: 24,
    });
  });

  it('merges two non-overlapping pairs of different values', () => {
    expect(mergeRow([4, 4, 2, 2])).toEqual({
      row: [8, null, 4, null],
      scoreDelta: 12,
    });
  });

  it('merges inner pair without re-merging the trailing tile', () => {
    expect(mergeRow([2, 4, 4, 8])).toEqual({
      row: [2, 8, null, 8],
      scoreDelta: 8,
    });
  });

  it('does not compress a non-compressed input (merge alone leaves gaps)', () => {
    expect(mergeRow([2, null, 2, null])).toEqual({
      row: [2, null, 2, null],
      scoreDelta: 0,
    });
  });

  it('creates the win tile from 1024 + 1024', () => {
    expect(mergeRow([1024, 1024, null, null])).toEqual({
      row: [2048, null, null, null],
      scoreDelta: 2048,
    });
  });
});

describe('moveLeft', () => {
  it('moves left — spec example (TD §7.2)', () => {
    const before: Board = [
      [null, 8, 2, 2],
      [4, 2, null, 2],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    const after: Board = [
      [8, 4, null, null],
      [4, 4, null, null],
      [null, null, null, null],
      [2, null, null, null],
    ];
    const result = moveLeft(before);
    expect(result.board).toEqual(after);
    expect(result.changed).toBe(true);
    expect(result.scoreDelta).toBe(8);
  });
});

describe('reflect', () => {
  it('reverses each row horizontally', () => {
    expect(
      reflect([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
      ]),
    ).toEqual([
      [4, 3, 2, 1],
      [8, 7, 6, 5],
      [12, 11, 10, 9],
      [16, 15, 14, 13],
    ]);
  });

  it('returns an all-null board unchanged when input is empty', () => {
    const empty: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(reflect(empty)).toEqual(empty);
  });

  it('is an involution: reflect(reflect(b)) deep-equals b', () => {
    const board: Board = [
      [2, null, 4, 8],
      [null, 16, null, 2],
      [32, 4, null, null],
      [null, null, 8, 64],
    ];
    expect(reflect(reflect(board))).toEqual(board);
  });

  it('returns new arrays at every level; original references unchanged after call', () => {
    const board: Board = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    const snapshot: Board = board.map((row) => [...row]);
    const result = reflect(board);
    expect(result).not.toBe(board);
    expect(result.every((row, rowIndex) => row !== board[rowIndex])).toBe(true);
    expect(board).toEqual(snapshot);
  });

  it('reflects rows, not columns — distinguishable from transpose', () => {
    const board: Board = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    expect(reflect(board)).not.toEqual(transpose(board));
  });
});

describe('transpose', () => {
  it('swaps rows and columns', () => {
    expect(
      transpose([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
      ]),
    ).toEqual([
      [1, 5, 9, 13],
      [2, 6, 10, 14],
      [3, 7, 11, 15],
      [4, 8, 12, 16],
    ]);
  });

  it('returns an all-null board unchanged when input is empty', () => {
    const empty: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(transpose(empty)).toEqual(empty);
  });

  it('is an involution: transpose(transpose(b)) deep-equals b', () => {
    const board: Board = [
      [2, null, 4, 8],
      [null, 16, null, 2],
      [32, 4, null, null],
      [null, null, 8, 64],
    ];
    expect(transpose(transpose(board))).toEqual(board);
  });

  it('is distinguishable from reflect on an asymmetric board', () => {
    const board: Board = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    expect(transpose(board)).not.toEqual(reflect(board));
  });

  it('returns new arrays at every level (no shared row references with input)', () => {
    const board: Board = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    const snapshot: Board = board.map((row) => [...row]);
    const result = transpose(board);
    expect(result).not.toBe(board);
    expect(result.every((row, rowIndex) => row !== board[rowIndex])).toBe(true);
    expect(board).toEqual(snapshot);
  });
});

describe('moveRight', () => {
  it('moves right — spec example (TD §7.2)', () => {
    const before: Board = [
      [null, 8, 2, 2],
      [4, 2, null, 2],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    const after: Board = [
      [null, null, 8, 4],
      [null, null, 4, 4],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    const result = moveRight(before);
    expect(result.board).toEqual(after);
    expect(result.changed).toBe(true);
    expect(result.scoreDelta).toBe(8);
  });
});

describe('moveUp', () => {
  it('moves up — spec example (TD §7.2)', () => {
    const before: Board = [
      [null, 8, 2, 2],
      [4, 2, null, 2],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    const after: Board = [
      [4, 8, 2, 4],
      [null, 2, null, 2],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const result = moveUp(before);
    expect(result.board).toEqual(after);
    expect(result.changed).toBe(true);
    expect(result.scoreDelta).toBe(4);
  });
});

describe('moveDown', () => {
  it('moves down — spec example (closes 4-direction coverage)', () => {
    const before: Board = [
      [null, 8, 2, 2],
      [4, 2, null, 2],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    const after: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, 8, null, 2],
      [4, 2, 2, 4],
    ];
    const result = moveDown(before);
    expect(result.board).toEqual(after);
    expect(result.changed).toBe(true);
    expect(result.scoreDelta).toBe(4);
  });
});

describe('applyMove', () => {
  it('routes each direction to its corresponding move function', () => {
    const board: Board = [
      [null, 8, 2, 2],
      [4, 2, null, 2],
      [null, null, null, null],
      [null, null, null, 2],
    ];
    expect(applyMove(board, DIRECTION.LEFT)).toEqual(moveLeft(board));
    expect(applyMove(board, DIRECTION.RIGHT)).toEqual(moveRight(board));
    expect(applyMove(board, DIRECTION.UP)).toEqual(moveUp(board));
    expect(applyMove(board, DIRECTION.DOWN)).toEqual(moveDown(board));
  });

  it('returns unchanged result for empty board across all directions', () => {
    const empty: Board = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    ([DIRECTION.LEFT, DIRECTION.RIGHT, DIRECTION.UP, DIRECTION.DOWN] as const).forEach((d) => {
      const result = applyMove(empty, d);
      expect(result.changed, `direction=${d}`).toBe(false);
      expect(result.scoreDelta, `direction=${d}`).toBe(0);
      expect(result.board, `direction=${d}`).toEqual(empty);
    });
  });

  it('returns unchanged result for full immovable checkerboard across all directions', () => {
    const checkerboard: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    ([DIRECTION.LEFT, DIRECTION.RIGHT, DIRECTION.UP, DIRECTION.DOWN] as const).forEach((d) => {
      const result = applyMove(checkerboard, d);
      expect(result.changed, `direction=${d}`).toBe(false);
      expect(result.scoreDelta, `direction=${d}`).toBe(0);
      expect(result.board, `direction=${d}`).toEqual(checkerboard);
    });
  });

  it('reports changed: true with scoreDelta 0 on slide-only moves (no merges)', () => {
    const before: Board = [
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const after: Board = [
      [null, null, null, 2],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const result = applyMove(before, DIRECTION.RIGHT);
    expect(result.board).toEqual(after);
    expect(result.changed).toBe(true);
    expect(result.scoreDelta).toBe(0);
  });

  it('aggregates scoreDelta across multiple rows', () => {
    const before: Board = [
      [2, 2, null, null],
      [4, 4, null, null],
      [2, 2, null, null],
      [null, null, null, null],
    ];
    const result = applyMove(before, DIRECTION.LEFT);
    expect(result.scoreDelta).toBe(4 + 8 + 4);
    expect(result.changed).toBe(true);
  });

  it('produces scoreDelta 2048 when a move creates the 2048 tile', () => {
    const before: Board = [
      [1024, 1024, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const result = applyMove(before, DIRECTION.LEFT);
    expect(result.scoreDelta).toBe(2048);
    expect(result.changed).toBe(true);
    expect(result.board[0]?.[0]).toBe(2048);
  });

  it('produces mirror-image boards for Left and Right on a vertically-symmetric input', () => {
    const symmetric: Board = [
      [2, 4, 4, 2],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const left = applyMove(symmetric, DIRECTION.LEFT);
    const right = applyMove(symmetric, DIRECTION.RIGHT);
    expect(left.board).toEqual(reflect(right.board));
    expect(left.scoreDelta).toBe(right.scoreDelta);
  });
});
