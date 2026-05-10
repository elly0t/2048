import type { Board } from '../domain/types';
import type { GameStatus } from '../store/types';
import { STATUS } from '../store/types';
import { STORAGE_KEYS } from '../constants/storageKeys';

// Persistence shape for localStorage round-trips (TD §8).
export type PersistedState = {
  board: Board;
  status: GameStatus;
  score: number;
};

export function loadGameState(raw: string | null): PersistedState | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isValidState(parsed) ? parsed : null;
}

export function loadBestScore(raw: string | null): number {
  if (raw === null) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function saveGameState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  } catch {
    // localStorage may throw in private mode or on quota — drop silently.
  }
}

export function saveBestScore(score: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BEST_SCORE, String(score));
  } catch {
    // localStorage may throw in private mode or on quota — drop silently.
  }
}

function isValidState(value: unknown): value is PersistedState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedState>;
  if (!isValidBoard(candidate.board)) return false;
  if (!(Object.values(STATUS) as string[]).includes(candidate.status as string)) return false;
  if (
    typeof candidate.score !== 'number' ||
    !Number.isFinite(candidate.score) ||
    candidate.score < 0
  ) {
    return false;
  }
  return true;
}

function isValidBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== 4) return false;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 4 &&
      row.every(
        (cell) => cell === null || (typeof cell === 'number' && Number.isFinite(cell)),
      ),
  );
}
