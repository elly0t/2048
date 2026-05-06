export function compressRow(row: (number | null)[]): (number | null)[] {
  return [...row.filter((cell) => cell !== null), ...row.filter((cell) => cell === null)];
}

export function mergeRow(row: (number | null)[]): {
  row: (number | null)[];
  scoreDelta: number;
} {
  const result: (number | null)[] = [...row];
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
