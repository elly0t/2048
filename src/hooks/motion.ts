import type { Board, Direction } from '../domain/types';

// Stable tile-id tracking — React reuses DOM nodes by id across moves so CSS transitions slide (TD §3.3).

export type TileMotion = {
  id: string;
  value: number;
  row: number;
  col: number;
  fromRow: number;
  fromCol: number;
  merged: boolean;
  spawned: boolean;
};

export type IdBoard = (string | null)[][];

export type MotionResult = {
  motions: TileMotion[];
  idBoard: IdBoard;
};

// RED stub — implementation lands in M2.
export function inferMotions(
  _oldBoard: Board,
  _oldIds: IdBoard,
  _newBoard: Board,
  _direction: Direction,
  _nextId: () => string,
): MotionResult {
  return { motions: [], idBoard: [[]] };
}
