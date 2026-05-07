import type { Board } from './types';

export function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, rowIndex) => row.every((cell, colIndex) => cell === b[rowIndex]![colIndex]));
}

export function checkWin(board: Board, winTile: number): boolean {
  return board.some((row) => row.some((cell) => cell === winTile));
}
