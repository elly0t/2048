import type { Row, Board, MoveResult } from './types';

export function compressRow(row: Row): Row {
  return [...row.filter((cell) => cell !== null), ...row.filter((cell) => cell === null)];
}

export function mergeRow(row: Row): { row: Row; scoreDelta: number } {
  const result: Row = [...row];
  let scoreDelta = 0;
  for (let i = 0; i < result.length - 1; i++) {
    const a = result[i];
    if (typeof a === 'number' && a === result[i + 1]) {
      const merged = a * 2;
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
    const merged = mergeRow(compressed);
    scoreDelta += merged.scoreDelta;
    const final = compressRow(merged.row);
    if (!changed && !final.every((val, i) => val === originalRow[i])) {
      changed = true;
    }
    return final;
  });
  return { board: newBoard, changed, scoreDelta };
}

export function reflect(board: Board): Board {
  return board.map((originalRow) => {
    return [...originalRow].reverse();
  })
}

export function transpose(board: Board): Board {
  return board.map((originalRow, rowIndex) =>
    originalRow.map((_, colIndex) => board[colIndex]![rowIndex]!),
  );
}

export function moveRight(board: Board): MoveResult {
  return { board, changed: false, scoreDelta: 0 };
}

export function moveUp(board: Board): MoveResult {
  return { board, changed: false, scoreDelta: 0 };
}

export function moveDown(board: Board): MoveResult {
  return { board, changed: false, scoreDelta: 0 };
}
