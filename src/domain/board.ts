import type { Board } from './types';

export function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, rowIndex) => row.every((cell, colIndex) => cell === b[rowIndex]![colIndex]));
}

export function checkWin(board: Board, winTile: number): boolean {
  return board.some((row) => row.some((cell) => cell === winTile));
}

export function initBoard(): Board {
  return [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
}

export function checkLose(board: Board): boolean {
  // Empty cell → slide possible
  if (board.some((row) => row.some((cell) => cell === null))) return false;
  // Horizontal adjacent pair → merge possible
  if (
    board.some((row) =>
      row.some(
        (cell, colIndex) => colIndex + 1 < row.length && cell === row[colIndex + 1],
      ),
    )
  ) {
    return false;
  }
  // Vertical adjacent pair → merge possible
  if (
    board.some(
      (row, rowIndex) =>
        rowIndex + 1 < board.length &&
        row.some((cell, colIndex) => cell === board[rowIndex + 1]![colIndex]),
    )
  ) {
    return false;
  }
  return true;
}
