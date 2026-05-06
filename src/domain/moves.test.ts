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
  it('merges independent adjacent pairs without re-merging', () => {
    expect(mergeRow([2, 2, 2, 2])).toEqual({
      row: [4, 4, null, null],
      scoreDelta: 8,
    });
  });
});
