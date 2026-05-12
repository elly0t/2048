import type { Board, Direction } from '../domain/types';
import type { AIAdvice } from '../ai/types';
import type { GameStatus } from './types';
import { STATUS } from './types';
import { applyMove as domainApplyMove } from '../domain/moves';
import { checkLose, checkWin, initBoard, spawnTile } from '../domain/board';
import { getSuggestion } from '../ai/getSuggestion';
import { CONFIG } from '../config';

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
  lastDirection: Direction | null = null;

  private rng: () => number;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor({ rng }: GameStoreOptions = {}) {
    this.rng = rng ?? Math.random;
  }

  // Active = player can still make moves. WON is included per assumption #4
  // (continue-after-win); IDLE and LOST are not interactive.
  get isActive(): boolean {
    return this.status === STATUS.PLAYING || this.status === STATUS.WON;
  }

  // null when the board has no tiles — avoids -Infinity / 0 sentinel ambiguity.
  get largestTile(): number | null {
    const tiles = this.board.flat().filter((cell): cell is number => cell !== null);
    return tiles.length === 0 ? null : Math.max(...tiles);
  }

  applyMove = (direction: Direction): void => {
    if (this.status === STATUS.LOST) return;

    const { board: newBoard, changed, scoreDelta } = domainApplyMove(this.board, direction);
    if (!changed) return;

    this.score += scoreDelta;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }

    // Gate on the WON transition — checkWin stays true past 2048, would skip spawn on every move.
    if (this.status !== STATUS.WON && checkWin(newBoard, CONFIG.WIN_TILE)) {
      this.status = STATUS.WON;
      this.lastDirection = direction;
      this.board = newBoard;
      this.notify();
      return;
    }

    const nextBoard = spawnTile(newBoard, this.rng);
    if (checkLose(nextBoard)) {
      this.status = STATUS.LOST;
    }
    this.lastDirection = direction;
    this.board = nextBoard;
    this.notify();
  };

  requestAdvice = async (): Promise<void> => {
    if (this.adviceLoading) return;
    this.adviceLoading = true;
    this.advice = null;
    this.notify();
    // rAF + setTimeout(0) — bare setTimeout never painted the loading state on Safari (WebKit coalesces short tasks).
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const start = performance.now();
    const advice = await getSuggestion(this.board);
    // Floor the loading state at CONFIG.MIN_ADVICE_LOADING_MS for perceptible feedback.
    const elapsed = performance.now() - start;
    const remaining = CONFIG.MIN_ADVICE_LOADING_MS - elapsed;
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
    this.advice = advice;
    this.adviceLoading = false;
    this.notify();
  };

  reset = (): void => {
    this.board = initBoard(this.rng);
    this.status = STATUS.PLAYING;
    this.score = 0;
    this.advice = null;
    this.adviceLoading = false;
    this.lastDirection = null;
    this.notify();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // Monotonically increments on every state change. React subscribes via
  // useSyncExternalStore against this snapshot — see TD §6.2 React bridge.
  getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
