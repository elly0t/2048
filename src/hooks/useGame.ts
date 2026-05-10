import { useSyncExternalStore } from 'react';
import { GameStore } from '../store/gameStore';
import type { Direction } from '../domain/types';
import { saveGameState, saveBestScore } from './persistence';

// React bridge over GameStore (TD §3.3, §6.2). Lazy singleton — module-load
// init would fire localStorage reads before tests can stub them; getStore()
// defers side effects until first hook call.

export function keyToDirection(_key: string): Direction | null {
  return null;
}

export function initStore(_store: GameStore): void {
  return;
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
  return;
}
