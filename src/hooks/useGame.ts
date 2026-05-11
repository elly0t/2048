import { useEffect, useSyncExternalStore } from 'react';
import { GameStore } from '../store/gameStore';
import { DIRECTION, type Direction } from '../domain/types';
import { saveGameState, saveBestScore, loadGameState, loadBestScore } from './persistence';
import { STORAGE_KEYS } from '../constants/storageKeys';

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

export function useGameKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
