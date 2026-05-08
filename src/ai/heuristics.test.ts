import { describe, it, expect } from 'vitest';
import { monotonicity, smoothness, cornerBonus, emptyCells } from './heuristics';
import { reflect, transpose } from '../domain/moves';
import type { Board } from '../domain/types';

const emptyBoard: Board = [
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
];

const fullBoard: Board = [
  [2, 4, 8, 16],
  [32, 64, 128, 256],
  [512, 1024, 2048, 4096],
  [8192, 16384, 32768, 65536],
];

const allSame: Board = [
  [2, 2, 2, 2],
  [2, 2, 2, 2],
  [2, 2, 2, 2],
  [2, 2, 2, 2],
];

const sortedRows: Board = [
  [2, 4, 8, 16],
  [2, 4, 8, 16],
  [2, 4, 8, 16],
  [2, 4, 8, 16],
];

const scrambled: Board = [
  [16, 2, 8, 4],
  [4, 16, 2, 8],
  [8, 4, 16, 2],
  [2, 8, 4, 16],
];

describe('heuristic components — empty board boundary (case 1)', () => {
  it('monotonicity returns a finite number on empty board', () => {
    expect(Number.isFinite(monotonicity(emptyBoard))).toBe(true);
  });

  it('smoothness returns a finite number on empty board', () => {
    expect(Number.isFinite(smoothness(emptyBoard))).toBe(true);
  });

  it('cornerBonus returns a finite number on empty board', () => {
    expect(Number.isFinite(cornerBonus(emptyBoard))).toBe(true);
  });

  it('emptyCells returns a finite number on empty board', () => {
    expect(Number.isFinite(emptyCells(emptyBoard))).toBe(true);
  });
});

describe('emptyCells (case 2: log₂(0) guard)', () => {
  it('returns a finite (non -Infinity) value on a full board', () => {
    expect(Number.isFinite(emptyCells(fullBoard))).toBe(true);
  });
});

describe('monotonicity (cases 3, 4)', () => {
  it('all-same board scores at least as high as a scrambled board', () => {
    expect(monotonicity(allSame)).toBeGreaterThanOrEqual(monotonicity(scrambled));
  });

  it('strictly-increasing rows score higher than a scrambled board', () => {
    expect(monotonicity(sortedRows)).toBeGreaterThan(monotonicity(scrambled));
  });
});

describe('smoothness (cases 3, 6)', () => {
  it('all-same board scores at least as high as a scrambled board', () => {
    expect(smoothness(allSame)).toBeGreaterThanOrEqual(smoothness(scrambled));
  });

  it('is invariant under reflect (neighbour-difference sum)', () => {
    expect(smoothness(sortedRows)).toBeCloseTo(smoothness(reflect(sortedRows)));
  });

  it('is invariant under transpose (neighbour-difference sum)', () => {
    expect(smoothness(sortedRows)).toBeCloseTo(smoothness(transpose(sortedRows)));
  });
});

describe('cornerBonus (case 5)', () => {
  it('rewards largest tile in a corner over the centre', () => {
    const cornerBoard: Board = [
      [2048, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const centreBoard: Board = [
      [null, null, null, null],
      [null, 2048, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(cornerBonus(cornerBoard)).toBeGreaterThan(cornerBonus(centreBoard));
  });
});

describe('determinism (case 7)', () => {
  it('same board returns same monotonicity across calls', () => {
    expect(monotonicity(sortedRows)).toBe(monotonicity(sortedRows));
  });

  it('same board returns same smoothness across calls', () => {
    expect(smoothness(sortedRows)).toBe(smoothness(sortedRows));
  });

  it('same board returns same cornerBonus across calls', () => {
    expect(cornerBonus(sortedRows)).toBe(cornerBonus(sortedRows));
  });

  it('same board returns same emptyCells across calls', () => {
    expect(emptyCells(sortedRows)).toBe(emptyCells(sortedRows));
  });
});

describe('regression — null and tie-breaking edge cases', () => {
  it('monotonicity skips null cells (does not treat them as log₂(0)=0)', () => {
    const compact: Board = [
      [2, 4, 8, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const sparse: Board = [
      [2, null, 4, 8],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(monotonicity(compact)).toBeCloseTo(monotonicity(sparse));
  });

  it('cornerBonus rewards max in any corner, not just first encountered', () => {
    const centreFirst: Board = [
      [2, null, null, null],
      [null, 8, null, null],
      [null, null, null, null],
      [8, null, null, null],
    ];
    expect(cornerBonus(centreFirst)).toBe(Math.log2(8));
  });
});

describe('null-cell handling (case 8)', () => {
  const sparse: Board = [
    [2, null, 4, null],
    [null, 8, null, 16],
    [32, null, 64, null],
    [null, 128, null, 256],
  ];

  it('monotonicity returns a finite number on a sparse board', () => {
    expect(Number.isFinite(monotonicity(sparse))).toBe(true);
  });

  it('smoothness returns a finite number on a sparse board', () => {
    expect(Number.isFinite(smoothness(sparse))).toBe(true);
  });

  it('cornerBonus returns a finite number on a sparse board', () => {
    expect(Number.isFinite(cornerBonus(sparse))).toBe(true);
  });

  it('emptyCells returns a finite number on a sparse board', () => {
    expect(Number.isFinite(emptyCells(sparse))).toBe(true);
  });
});
