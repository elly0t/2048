import type { Board, Direction } from '../domain/types';
import type { AIAdvice } from '../ai/types';
import type { GameStatus } from './types';
import { STATUS } from './types';

type GameStoreOptions = {
  rng?: () => number;
};

function emptyBoard(): Board {
  return [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
}

export class GameStore {
  board: Board = emptyBoard();
  status: GameStatus = STATUS.IDLE;
  score = 0;
  bestScore = 0;
  advice: AIAdvice | null = null;
  adviceLoading = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts: GameStoreOptions = {}) {}

  get isActive(): boolean {
    throw new Error('not implemented');
  }

  get largestTile(): number {
    throw new Error('not implemented');
  }

  applyMove(_direction: Direction): void {
    throw new Error('not implemented');
  }

  async requestAdvice(): Promise<void> {
    throw new Error('not implemented');
  }

  reset(): void {
    throw new Error('not implemented');
  }

  subscribe(_listener: () => void): () => void {
    throw new Error('not implemented');
  }
}
