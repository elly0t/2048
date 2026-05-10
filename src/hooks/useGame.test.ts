import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keyToDirection, initStore } from './useGame';
import { GameStore } from '../store/gameStore';
import { STATUS } from '../store/types';
import { STORAGE_KEYS } from '../constants/storageKeys';

describe('keyToDirection', () => {
  it('maps ArrowLeft to "left"', () => {
    expect(keyToDirection('ArrowLeft')).toBe('left');
  });

  it('maps ArrowRight to "right"', () => {
    expect(keyToDirection('ArrowRight')).toBe('right');
  });

  it('maps ArrowUp to "up"', () => {
    expect(keyToDirection('ArrowUp')).toBe('up');
  });

  it('maps ArrowDown to "down"', () => {
    expect(keyToDirection('ArrowDown')).toBe('down');
  });

  it('returns null for unrelated keys', () => {
    expect(keyToDirection('a')).toBeNull();
    expect(keyToDirection('Enter')).toBeNull();
    expect(keyToDirection(' ')).toBeNull();
  });
});

describe('initStore', () => {
  let getItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getItemSpy = vi.fn();
    vi.stubGlobal('localStorage', { getItem: getItemSpy, setItem: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hydrates from a valid saved state', () => {
    const savedBoard = [
      [2, null, null, null],
      [null, 4, null, null],
      [null, null, 8, null],
      [null, null, null, 16],
    ];
    getItemSpy.mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.GAME_STATE) {
        return JSON.stringify({ board: savedBoard, status: STATUS.PLAYING, score: 42 });
      }
      if (key === STORAGE_KEYS.BEST_SCORE) return '128';
      return null;
    });

    const store = new GameStore();
    initStore(store);

    expect(store.board).toEqual(savedBoard);
    expect(store.score).toBe(42);
    expect(store.status).toBe(STATUS.PLAYING);
    expect(store.bestScore).toBe(128);
  });

  it('falls back to reset() when saved state JSON is invalid', () => {
    getItemSpy.mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.GAME_STATE) return '{not valid json';
      if (key === STORAGE_KEYS.BEST_SCORE) return null;
      return null;
    });

    const store = new GameStore();
    const resetSpy = vi.spyOn(store, 'reset');
    initStore(store);

    expect(resetSpy).toHaveBeenCalledOnce();
    expect(store.status).toBe(STATUS.PLAYING);
  });

  it('falls back to reset() when game-state key is missing', () => {
    getItemSpy.mockReturnValue(null);

    const store = new GameStore();
    const resetSpy = vi.spyOn(store, 'reset');
    initStore(store);

    expect(resetSpy).toHaveBeenCalledOnce();
    expect(store.status).toBe(STATUS.PLAYING);
  });

  it('end-to-end: missing localStorage produces a fresh playable board with random 2s', () => {
    getItemSpy.mockReturnValue(null);

    const store = new GameStore();
    initStore(store);

    expect(store.status).toBe(STATUS.PLAYING);
    const tiles = store.board.flat().filter((c): c is number => c !== null);
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    expect(tiles.length).toBeLessThanOrEqual(8);
    expect(tiles.every((t) => t === 2)).toBe(true);
  });

  it('sets bestScore to 0 when missing or invalid', () => {
    getItemSpy.mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.BEST_SCORE) return 'not-a-number';
      return null;
    });

    const store = new GameStore();
    store.bestScore = 999; // sentinel — forces initStore to overwrite
    initStore(store);

    expect(store.bestScore).toBe(0);
  });
});
