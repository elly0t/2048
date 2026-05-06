export function compressRow(row: (number | null)[]): (number | null)[] {
  return [...row.filter((cell) => cell !== null), ...row.filter((cell) => cell === null)];
}
