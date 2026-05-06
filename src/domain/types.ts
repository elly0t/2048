export const DIRECTION = {
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down',
} as const;

export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

export type Cell = number | null;
export type Row = Cell[];
export type Board = Row[];
export type MoveResult = {
  board: Board;
  changed: boolean;
  scoreDelta: number;
};
