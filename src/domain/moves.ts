import type { Row } from './types';

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
