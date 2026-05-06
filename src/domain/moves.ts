export function compressRow(row: (number | null)[]): (number | null)[] {
  return [...row.filter((cell) => cell !== null), ...row.filter((cell) => cell === null)];
}

export function mergeRow(row: (number | null)[]): {
  row: (number | null)[];
  scoreDelta: number;
} {
  return { row, scoreDelta: 0 };
}
