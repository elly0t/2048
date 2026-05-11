import { DIRECTION, type Board, type Direction } from '../domain/types';

// Stable tile-id tracking — React reuses DOM nodes by id across moves so CSS transitions slide (TD §3.3).

export type TileMotion = {
  id: string;
  value: number;
  row: number;
  col: number;
  fromRow: number;
  fromCol: number;
  merged: boolean;
  spawned: boolean;
};

export type IdBoard = (string | null)[][];

export type MotionResult = {
  motions: TileMotion[];
  idBoard: IdBoard;
};

type LabeledTile = {
  id: string;
  value: number;
  fromRow: number;
  fromCol: number;
  merged: boolean;
};

export function inferMotions(
  oldBoard: Board,
  oldIds: IdBoard,
  newBoard: Board,
  direction: Direction,
  nextId: () => string,
): MotionResult {
  const idBoard: IdBoard = Array.from({ length: 4 }, () =>
    Array<string | null>(4).fill(null),
  );
  const motions: TileMotion[] = [];

  for (const line of scanLines(direction)) {
    const tiles: LabeledTile[] = [];
    for (const [row, col] of line) {
      const value = oldBoard[row]?.[col];
      const id = oldIds[row]?.[col];
      if (typeof value === 'number' && typeof id === 'string') {
        tiles.push({ id, value, fromRow: row, fromCol: col, merged: false });
      }
    }

    const merged = slideAndMerge(tiles);

    merged.forEach((tile, idx) => {
      const cell = line[idx];
      if (!cell) return;
      const [row, col] = cell;
      idBoard[row]![col] = tile.id;
      motions.push({
        id: tile.id,
        value: tile.value,
        row,
        col,
        fromRow: tile.fromRow,
        fromCol: tile.fromCol,
        merged: tile.merged,
        spawned: false,
      });
    });
  }

  // Spawn: cells in newBoard with no mapping after slide+merge.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const value = newBoard[r]?.[c];
      if (typeof value !== 'number') continue;
      if (idBoard[r]![c] !== null) continue;
      const id = nextId();
      idBoard[r]![c] = id;
      motions.push({
        id,
        value,
        row: r,
        col: c,
        fromRow: r,
        fromCol: c,
        merged: false,
        spawned: true,
      });
    }
  }

  return { motions, idBoard };
}

// Walks tiles in scan order; merges adjacent equals, leading id survives.
function slideAndMerge(tiles: LabeledTile[]): LabeledTile[] {
  const result: LabeledTile[] = [];
  for (const tile of tiles) {
    const last = result[result.length - 1];
    if (last && !last.merged && last.value === tile.value) {
      last.value *= 2;
      last.merged = true;
    } else {
      result.push({ ...tile });
    }
  }
  return result;
}

// Per-line scan order. Leading edge (destination side) first so leading id survives merges.
function scanLines(direction: Direction): [number, number][][] {
  const lines: [number, number][][] = [];
  const range = [0, 1, 2, 3];
  const reversed = [3, 2, 1, 0];

  if (direction === DIRECTION.LEFT) {
    for (const r of range) lines.push(range.map((c): [number, number] => [r, c]));
  } else if (direction === DIRECTION.RIGHT) {
    for (const r of range) lines.push(reversed.map((c): [number, number] => [r, c]));
  } else if (direction === DIRECTION.UP) {
    for (const c of range) lines.push(range.map((r): [number, number] => [r, c]));
  } else {
    for (const c of range) lines.push(reversed.map((r): [number, number] => [r, c]));
  }
  return lines;
}
