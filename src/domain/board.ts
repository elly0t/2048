import type { Board } from './types';
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

function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function emptyCellPositions(board: Board): [number, number][] {
  const positions: [number, number][] = [];
  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) positions.push([rowIndex, colIndex]);
    });
  });
  return positions;
}

function pickRandomN<T>(items: T[], n: number): T[] {
  return [...items].sort(() => Math.random() - 0.5).slice(0, n);
}

export function initBoard(): Board {
  const board: Board = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
  const numInitTiles = randomIntBetween(
    CONFIG.INIT_TILE_COUNT.min,
    CONFIG.INIT_TILE_COUNT.max,
  );
  const spawnPositions = pickRandomN(emptyCellPositions(board), numInitTiles);
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
  const [rowIndex, colIndex] = pickRandomN(empties, 1)[0]!;
  return board.map((row, r) =>
    row.map((cell, c) => (r === rowIndex && c === colIndex ? tileValue : cell)),
  );
}
