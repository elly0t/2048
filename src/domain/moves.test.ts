import { describe, it, expect } from 'vitest';
import { compressRow, mergeRow } from './moves';

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
});
