import type { Board } from '../domain/types';
import type { GameStatus } from '../store/types';

export type PersistedState = {
  board: Board;
  status: GameStatus;
  score: number;
};

export function loadGameState(_raw: string | null): PersistedState | null {
  throw new Error('not implemented');
}

export function loadBestScore(_raw: string | null): number {
  throw new Error('not implemented');
}

export function saveGameState(_state: PersistedState): void {
  throw new Error('not implemented');
}

export function saveBestScore(_score: number): void {
  throw new Error('not implemented');
}
