import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keyToDirection, initStore, isAdviceKey, swipeToDirection, MotionTracker } from './useGame';
import type { Board } from '../domain/types';
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

describe('isAdviceKey', () => {
  it('returns true for the Space key', () => {
    expect(isAdviceKey(' ')).toBe(true);
  });

  it('returns false for arrow keys, letters, Enter, and Escape', () => {
    expect(isAdviceKey('ArrowLeft')).toBe(false);
    expect(isAdviceKey('ArrowRight')).toBe(false);
    expect(isAdviceKey('Enter')).toBe(false);
    expect(isAdviceKey('Escape')).toBe(false);
    expect(isAdviceKey('a')).toBe(false);
    expect(isAdviceKey('')).toBe(false);
  });
});

describe('swipeToDirection', () => {
  it('maps a clear right swipe (dx >> dy) to "right"', () => {
    expect(swipeToDirection(0, 0, 100, 0)).toBe('right');
  });

  it('maps a clear left swipe to "left"', () => {
    expect(swipeToDirection(100, 50, 0, 50)).toBe('left');
  });

  it('maps a clear down swipe (dy >> dx) to "down"', () => {
    expect(swipeToDirection(50, 0, 50, 100)).toBe('down');
  });

  it('maps a clear up swipe to "up"', () => {
    expect(swipeToDirection(50, 100, 50, 0)).toBe('up');
  });

  it('returns null when both axes are below the threshold (tap / accidental drift)', () => {
    expect(swipeToDirection(0, 0, 10, 10)).toBeNull();
    expect(swipeToDirection(50, 50, 55, 48)).toBeNull();
  });

  it('greater absolute axis wins on diagonal swipes (horizontal-dominant → horizontal)', () => {
    expect(swipeToDirection(0, 0, 80, 40)).toBe('right');
    expect(swipeToDirection(100, 0, 0, 40)).toBe('left');
  });

  it('greater absolute axis wins on diagonal swipes (vertical-dominant → vertical)', () => {
    expect(swipeToDirection(0, 0, 40, 80)).toBe('down');
    expect(swipeToDirection(0, 100, 40, 0)).toBe('up');
  });

  it('uses a custom threshold when provided', () => {
    // dx=20, below default 30 → null; below custom 50 → null; above custom 10 → right
    expect(swipeToDirection(0, 0, 20, 0)).toBeNull();
    expect(swipeToDirection(0, 0, 20, 0, 50)).toBeNull();
    expect(swipeToDirection(0, 0, 20, 0, 10)).toBe('right');
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

const NULL_ROW = [null, null, null, null] as const;

describe('MotionTracker', () => {
  it('init — idBoard has non-null ids for occupied cells, null for empty', () => {
    const board: Board = [
      [2, null, null, null],
      [null, 4, null, null],
      [...NULL_ROW],
      [...NULL_ROW],
    ];
    const tracker = new MotionTracker(board);
    expect(tracker.idBoard[0]?.[0]).toBeTruthy();
    expect(tracker.idBoard[0]?.[1]).toBeNull();
    expect(tracker.idBoard[1]?.[1]).toBeTruthy();
    expect(tracker.idBoard[1]?.[0]).toBeNull();
  });

  it('track — sliding tile keeps its id at the new position', () => {
    const board: Board = [[null, null, null, 2], [...NULL_ROW], [...NULL_ROW], [...NULL_ROW]];
    const tracker = new MotionTracker(board);
    const oldId = tracker.idBoard[0]?.[3];
    expect(oldId).toBeTruthy(); // guard: init must assign an id before track is meaningful
    const newBoard: Board = [
      [2, null, null, null],
      [...NULL_ROW],
      [...NULL_ROW],
      [null, null, null, 2],
    ];
    tracker.track(board, newBoard, 'left');
    expect(tracker.idBoard[0]?.[0]).toBe(oldId);
    expect(tracker.idBoard[0]?.[3]).toBeNull();
  });

  it('track — returns non-empty motions array including a slide entry', () => {
    const board: Board = [[null, null, null, 2], [...NULL_ROW], [...NULL_ROW], [...NULL_ROW]];
    const tracker = new MotionTracker(board);
    const newBoard: Board = [
      [2, null, null, null],
      [...NULL_ROW],
      [...NULL_ROW],
      [null, null, null, 2],
    ];
    const motions = tracker.track(board, newBoard, 'left');
    expect(motions.length).toBeGreaterThan(0);
    const slide = motions.find((m) => !m.spawned && !m.ghost);
    expect(slide?.fromCol).toBe(3);
    expect(slide?.col).toBe(0);
  });

  it('reset — clears motions and reinitializes idBoard from new board', () => {
    const board: Board = [[null, null, null, 2], [...NULL_ROW], [...NULL_ROW], [...NULL_ROW]];
    const tracker = new MotionTracker(board);
    const newBoard: Board = [
      [2, null, null, null],
      [...NULL_ROW],
      [...NULL_ROW],
      [null, null, null, 2],
    ];
    tracker.track(board, newBoard, 'left');
    expect(tracker.motions.length).toBeGreaterThan(0);

    const freshBoard: Board = [
      [2, null, null, null],
      [null, null, null, 2],
      [...NULL_ROW],
      [...NULL_ROW],
    ];
    tracker.reset(freshBoard);
    expect(tracker.motions).toHaveLength(0);
    expect(tracker.idBoard[0]?.[0]).toBeTruthy();
    expect(tracker.idBoard[1]?.[3]).toBeTruthy();
    expect(tracker.idBoard[0]?.[1]).toBeNull();
  });
});
