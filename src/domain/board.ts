import type { Board, Cell } from './types';
import { CONFIG } from '../config';

export function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, rowIndex) => row.every((cell, colIndex) => cell === b[rowIndex]![colIndex]));
}

export function checkWin(board: Board, winTile: number): boolean {
  return board.some((row) => row.some((cell) => cell === winTile));
}

export function checkLose(board: Board): boolean {
  // Empty cell → slide possible
  if (board.some((row) => row.some((cell) => cell === null))) return false;
  // Horizontal adjacent pair → merge possible
  if (
    board.some((row) =>
      row.some((cell, colIndex) => colIndex + 1 < row.length && cell === row[colIndex + 1]),
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

function randomIntBetween(min: number, max: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function emptyCellPositions(board: Board): [number, number][] {
  const positions: [number, number][] = [];
  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) positions.push([rowIndex, colIndex]);
    });
  });
  return positions;
}

export function cloneWithCell(
  board: Board,
  rowIndex: number,
  colIndex: number,
  value: Cell,
): Board {
  const newBoard = board.map((row) => row.slice());
  newBoard[rowIndex]![colIndex] = value;
  return newBoard;
}

function pickRandomN<T>(items: T[], n: number, rng: () => number = Math.random): T[] {
  const shuffled = [...items];
  const limit = Math.min(n, shuffled.length);
  // Partial Fisher-Yates: only the first `limit` slots need to be settled.
  for (let cursor = 0; cursor < limit; cursor++) {
    const swapIndex = cursor + Math.floor(rng() * (shuffled.length - cursor));
    [shuffled[cursor], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[cursor]!];
  }
  return shuffled.slice(0, limit);
}

export function initBoard(rng: () => number = Math.random): Board {
  const board: Board = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
  const numInitTiles = randomIntBetween(
    CONFIG.INIT_TILE_COUNT.min,
    CONFIG.INIT_TILE_COUNT.max,
    rng,
  );
  const spawnPositions = pickRandomN(emptyCellPositions(board), numInitTiles, rng);
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      spawnPositions.some(([spawnRow, spawnCol]) => spawnRow === rowIndex && spawnCol === colIndex)
        ? 2
        : cell,
    ),
  );
}

export function spawnTile(board: Board, rng: () => number = Math.random): Board {
  const empties = emptyCellPositions(board);
  if (empties.length === 0) {
    throw new Error('spawnTile called on a full board');
  }
  const tileValue = rng() < CONFIG.SPAWN_WEIGHTS[2] ? 2 : 4;
  const [rowIndex, colIndex] = pickRandomN(empties, 1, rng)[0]!;
  return cloneWithCell(board, rowIndex, colIndex, tileValue);
}
