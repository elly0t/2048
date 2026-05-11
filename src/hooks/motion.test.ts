import { describe, it, expect } from 'vitest';
import { inferMotions, type IdBoard } from './motion';
import type { Board } from '../domain/types';

const ALL_NULL_ROW = [null, null, null, null] as const;

const seq = () => {
  let n = 0;
  return () => `g${++n}`;
};

describe('inferMotions', () => {
  it('rule 1 — produces one motion entry per non-null cell in newBoard', () => {
    const oldBoard: Board = [
      [null, null, null, 2],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      [null, null, null, 'a'],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [2, null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const { motions } = inferMotions(oldBoard, oldIds, newBoard, 'left', seq());
    expect(motions).toHaveLength(2);
  });

  it('rule 2 — slide motion: from differs from target; merged & spawned false', () => {
    const oldBoard: Board = [
      [null, null, null, 2],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      [null, null, null, 'a'],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [2, null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const { motions } = inferMotions(oldBoard, oldIds, newBoard, 'left', seq());
    const slide = motions.find((m) => m.id === 'a');
    expect(slide).toEqual({
      id: 'a',
      value: 2,
      row: 0,
      col: 0,
      fromRow: 0,
      fromCol: 3,
      merged: false,
      spawned: false,
    });
  });

  it('rule 3 — merge motion has merged:true; consumed source id is dropped from idBoard', () => {
    const oldBoard: Board = [
      [2, 2, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      ['a', 'b', null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [4, null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const { motions, idBoard } = inferMotions(
      oldBoard,
      oldIds,
      newBoard,
      'left',
      seq(),
    );
    const merge = motions.find((m) => m.row === 0 && m.col === 0);
    expect(merge?.merged).toBe(true);
    expect(merge?.value).toBe(4);

    const survivingIds = idBoard.flat().filter((x): x is string => x !== null);
    expect(survivingIds).toContain('a');
    expect(survivingIds).not.toContain('b');
  });

  it('rule 4 — spawn motion has spawned:true and from === target (no slide)', () => {
    const oldBoard: Board = [
      [null, null, null, 2],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      [null, null, null, 'a'],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [2, null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const { motions } = inferMotions(oldBoard, oldIds, newBoard, 'left', seq());
    const spawn = motions.find((m) => m.spawned);
    expect(spawn?.row).toBe(3);
    expect(spawn?.col).toBe(3);
    expect(spawn?.fromRow).toBe(spawn?.row);
    expect(spawn?.fromCol).toBe(spawn?.col);
    expect(spawn?.merged).toBe(false);
  });

  it('rule 5 — idBoard preserves moved ids, clears old positions, gives spawn a fresh id', () => {
    const oldBoard: Board = [
      [null, null, null, 2],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      [null, null, null, 'a'],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [2, null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const { idBoard } = inferMotions(oldBoard, oldIds, newBoard, 'left', seq());
    expect(idBoard[0]?.[0]).toBe('a');
    expect(idBoard[0]?.[3]).toBeNull();
    expect(idBoard[3]?.[3]).toBe('g1'); // first call to seq() for the spawn
  });

  it('rule 6 — deterministic: same inputs + same id stream yield identical output', () => {
    const oldBoard: Board = [
      [2, 2, 2, 2],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      ['a', 'b', 'c', 'd'],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [4, 4, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const r1 = inferMotions(oldBoard, oldIds, newBoard, 'left', seq());
    const r2 = inferMotions(oldBoard, oldIds, newBoard, 'left', seq());
    expect(r1.motions.length).toBeGreaterThan(0);
    expect(r2).toEqual(r1);
  });

  it('multi-merge in one row: [a,b,c,d] left with all 2s yields two merges; leading ids survive', () => {
    const oldBoard: Board = [
      [2, 2, 2, 2],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      ['a', 'b', 'c', 'd'],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [4, 4, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [null, null, null, 2],
    ];

    const { motions, idBoard } = inferMotions(
      oldBoard,
      oldIds,
      newBoard,
      'left',
      seq(),
    );
    expect(motions).toHaveLength(3); // 2 merges + 1 spawn
    const m0 = motions.find((m) => m.row === 0 && m.col === 0);
    const m1 = motions.find((m) => m.row === 0 && m.col === 1);
    expect(m0?.merged).toBe(true);
    expect(m0?.value).toBe(4);
    expect(m1?.merged).toBe(true);
    expect(m1?.value).toBe(4);
    // Leading tiles survive: 'a' for left-merge of a+b; 'c' for c+d.
    expect(idBoard[0]?.[0]).toBe('a');
    expect(idBoard[0]?.[1]).toBe('c');
  });

  it('handles vertical direction (down) — column merges with bottom-leading id surviving', () => {
    const oldBoard: Board = [
      [2, null, null, null],
      [2, null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const oldIds: IdBoard = [
      ['a', null, null, null],
      ['b', null, null, null],
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
    ];
    const newBoard: Board = [
      [null, null, null, 2], // spawn
      [...ALL_NULL_ROW],
      [...ALL_NULL_ROW],
      [4, null, null, null], // merged toward bottom
    ];

    const { motions, idBoard } = inferMotions(
      oldBoard,
      oldIds,
      newBoard,
      'down',
      seq(),
    );
    expect(motions).toHaveLength(2);
    const merge = motions.find((m) => m.row === 3 && m.col === 0);
    expect(merge?.merged).toBe(true);
    expect(merge?.value).toBe(4);
    // For 'down', the tile closer to the bottom is leading — b survives.
    expect(idBoard[3]?.[0]).toBe('b');
  });
});
