import type { Row, Board, MoveResult, Direction } from './types';
import { DIRECTION } from './types';

export function compressRow(row: Row): Row {
  return [...row.filter((cell) => cell !== null), ...row.filter((cell) => cell === null)];
}

export function mergeRow(row: Row): { row: Row; scoreDelta: number } {
  const result: Row = [...row];
  let scoreDelta = 0;
  for (let i = 0; i < result.length - 1; i++) {
    const cell = result[i];
    if (typeof cell === 'number' && cell === result[i + 1]) {
      const merged = cell * 2;
      result[i] = merged;
      result[i + 1] = null;
      scoreDelta += merged;
      i++; // skip merged neighbor — prevents re-merge (rule 3)
    }
  }
  return { row: result, scoreDelta };
}

export function moveLeft(board: Board): MoveResult {
  let changed = false;
  let scoreDelta = 0;
  const newBoard: Board = board.map((originalRow) => {
    const compressed = compressRow(originalRow);
    const mergeResult = mergeRow(compressed);
    scoreDelta += mergeResult.scoreDelta;
    const final = compressRow(mergeResult.row);
    if (!changed && !final.every((cell, i) => cell === originalRow[i])) {
      changed = true;
    }
    return final;
  });
  return { board: newBoard, changed, scoreDelta };
}

export function reflect(board: Board): Board {
  return board.map((row) => {
    return [...row].reverse();
  });
}

export function transpose(board: Board): Board {
  return board.map((row, rowIndex) => row.map((_, colIndex) => board[colIndex]![rowIndex]!));
}

export function moveRight(board: Board): MoveResult {
  const reflectedBoard = reflect(board);
  const { board: movedBoard, changed, scoreDelta } = moveLeft(reflectedBoard);
  const transformedBackBoard = reflect(movedBoard);
  return { board: transformedBackBoard, changed, scoreDelta };
}

export function moveUp(board: Board): MoveResult {
  const transposedBoard = transpose(board);
  const { board: movedBoard, changed, scoreDelta } = moveLeft(transposedBoard);
  const transformedBackBoard = transpose(movedBoard);
  return { board: transformedBackBoard, changed, scoreDelta };
}

export function moveDown(board: Board): MoveResult {
  const reflectedTransposedBoard = reflect(transpose(board));
  const { board: movedBoard, changed, scoreDelta } = moveLeft(reflectedTransposedBoard);
  const transformedBackBoard = transpose(reflect(movedBoard));
  return { board: transformedBackBoard, changed, scoreDelta };
}

export function applyMove(board: Board, direction: Direction): MoveResult {
  switch (direction) {
    case DIRECTION.LEFT:
      return moveLeft(board);
    case DIRECTION.RIGHT:
      return moveRight(board);
    case DIRECTION.UP:
      return moveUp(board);
    case DIRECTION.DOWN:
      return moveDown(board);
  }
}
