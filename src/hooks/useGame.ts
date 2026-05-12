import { useEffect, useRef, useState, useSyncExternalStore, type TouchEvent } from 'react';
import { GameStore } from '../store/gameStore';
import { DIRECTION, type Board, type Direction } from '../domain/types';
import { saveGameState, saveBestScore, loadGameState, loadBestScore } from './persistence';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { inferMotions, type IdBoard, type TileMotion } from './motion';

// React bridge over GameStore (TD §3.3, §6.2). Lazy singleton — module-load
// init would fire localStorage reads before tests can stub them; getStore()
// defers side effects until first hook call.

export function isAdviceKey(key: string): boolean {
  return key === ' ';
}

export function swipeToDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold = 30,
): Direction | null {
  const dx = endX - startX;
  const dy = endY - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < threshold && absY < threshold) return null;
  if (absX > absY) return dx > 0 ? DIRECTION.RIGHT : DIRECTION.LEFT;
  return dy > 0 ? DIRECTION.DOWN : DIRECTION.UP;
}

export function keyToDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowLeft':
      return DIRECTION.LEFT;
    case 'ArrowRight':
      return DIRECTION.RIGHT;
    case 'ArrowUp':
      return DIRECTION.UP;
    case 'ArrowDown':
      return DIRECTION.DOWN;
    default:
      return null;
  }
}

export function initStore(store: GameStore): void {
  const loadedState = loadGameState(localStorage.getItem(STORAGE_KEYS.GAME_STATE));
  if (loadedState) {
    store.board = loadedState.board;
    store.status = loadedState.status;
    store.score = loadedState.score;
  } else {
    store.reset();
  }
  store.bestScore = loadBestScore(localStorage.getItem(STORAGE_KEYS.BEST_SCORE));
}

let store: GameStore | null = null;

export function getStore(): GameStore {
  if (!store) {
    store = new GameStore();
    initStore(store);
    store.subscribe(() => {
      saveGameState({
        board: store!.board,
        score: store!.score,
        status: store!.status,
      });
      saveBestScore(store!.bestScore);
    });
  }
  return store;
}

export class MotionTracker {
  idBoard: IdBoard;
  motions: TileMotion[] = [];
  // Never resets — id reuse across session would break React reconciliation on stale ghost tiles.
  private n = 0;
  private nextId = (): string => `t${++this.n}`;

  constructor(initialBoard: Board) {
    this.idBoard = this.initIdBoard(initialBoard);
  }

  private initIdBoard(board: Board): IdBoard {
    const ids: IdBoard = Array.from({ length: 4 }, () => Array<string | null>(4).fill(null));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (typeof board[r]?.[c] === 'number') ids[r]![c] = this.nextId();
      }
    }
    return ids;
  }

  track(oldBoard: Board, newBoard: Board, direction: Direction): TileMotion[] {
    const result = inferMotions(oldBoard, this.idBoard, newBoard, direction, this.nextId);
    this.idBoard = result.idBoard;
    this.motions = result.motions;
    return result.motions;
  }

  reset(newBoard: Board): void {
    this.idBoard = this.initIdBoard(newBoard);
    this.motions = [];
  }
}

export function useGame() {
  const s = getStore();
  useSyncExternalStore(s.subscribe, s.getSnapshot);
  const trackerRef = useRef<MotionTracker | null>(null);
  if (!trackerRef.current) trackerRef.current = new MotionTracker(s.board);
  const tracker = trackerRef.current;
  const prevBoardRef = useRef(s.board);
  const [motions, setMotions] = useState<TileMotion[]>([]);

  // Board-change driven (not move-wrapper driven) so keyboard/touch handlers that call getStore().applyMove directly still trigger motion inference.
  useEffect(() => {
    const prev = prevBoardRef.current;
    if (prev === s.board) return;
    prevBoardRef.current = s.board;
    if (s.lastDirection === null) {
      tracker.reset(s.board);
      setMotions([]);
    } else {
      setMotions(tracker.track(prev, s.board, s.lastDirection));
    }
  }, [s.board, s.lastDirection, tracker]);

  return {
    board: s.board,
    score: s.score,
    bestScore: s.bestScore,
    status: s.status,
    isActive: s.isActive,
    largestTile: s.largestTile,
    advice: s.advice,
    adviceLoading: s.adviceLoading,
    motions,
    move: s.applyMove,
    reset: s.reset,
    requestAdvice: s.requestAdvice,
  };
}

type TouchHandlers = {
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
  onTouchCancel: () => void;
};

// Touch gesture handlers (TD §3.3). Spread onto the swipe surface.
export function useGameTouch(): TouchHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      start.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (e) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const direction = swipeToDirection(origin.x, origin.y, touch.clientX, touch.clientY);
      if (direction) getStore().applyMove(direction);
    },
    onTouchCancel: () => {
      start.current = null;
    },
  };
}

export function useGameKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Browser auto-repeat fires keydown rapidly while held — one press = one move.
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isAdviceKey(e.key)) {
        e.preventDefault();
        void getStore().requestAdvice();
        return;
      }
      const direction = keyToDirection(e.key);
      if (!direction) return;
      e.preventDefault();
      getStore().applyMove(direction);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
