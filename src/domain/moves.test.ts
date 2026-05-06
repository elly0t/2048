import { describe, it, expect } from 'vitest';
import { compressRow } from './moves';

describe('compressRow', () => {
  it('packs values toward index 0', () => {
    expect(compressRow([2, null, 2, null])).toEqual([2, 2, null, null]);
  });
});
