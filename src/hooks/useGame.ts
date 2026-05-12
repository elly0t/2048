import { useEffect, useRef, useSyncExternalStore, type TouchEvent } from 'react';
import { GameStore } from '../store/gameStore';
import { DIRECTION, type Board, type Direction } from '../domain/types';
import { saveGameState, saveBestScore, loadGameState, loadBestScore } from './persistence';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { IdBoard, TileMotion } from './motion';

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
  idBoard: IdBoard = Array.from({ length: 4 }, () => Array<string | null>(4).fill(null));
  motions: TileMotion[] = [];

  constructor(_initialBoard: Board) {}
  track(_oldBoard: Board, _newBoard: Board, _direction: Direction): TileMotion[] { return []; }
  reset(_newBoard: Board): void {}
}

export function useGame() {
  const s = getStore();
  useSyncExternalStore(s.subscribe.bind(s), s.getSnapshot);
  return {
    board: s.board,
    score: s.score,
    bestScore: s.bestScore,
    status: s.status,
    isActive: s.isActive,
    largestTile: s.largestTile,
    advice: s.advice,
    adviceLoading: s.adviceLoading,
    move: s.applyMove.bind(s),
    reset: s.reset.bind(s),
    requestAdvice: s.requestAdvice.bind(s),
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
