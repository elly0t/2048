import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadGameState, loadBestScore, saveGameState, saveBestScore } from './persistence';
import type { Board } from '../domain/types';
import { STATUS } from '../store/types';
import { STORAGE_KEYS } from '../constants/storageKeys';

const validBoard: Board = [
  [2, 4, null, null],
  [null, null, 8, null],
  [null, null, null, 16],
  [null, null, null, null],
];

const validState = {
  board: validBoard,
  status: STATUS.PLAYING,
  score: 100,
};

describe('loadGameState', () => {
  it('returns the parsed state when raw matches the expected shape', () => {
    expect(loadGameState(JSON.stringify(validState))).toEqual(validState);
  });

  it('returns null when raw is null (key not in localStorage)', () => {
    expect(loadGameState(null)).toBeNull();
  });

  it('returns null when raw is not valid JSON', () => {
    expect(loadGameState('not valid json')).toBeNull();
  });

  it('returns null when board is not 4x4', () => {
    expect(loadGameState(JSON.stringify({ ...validState, board: [[1, 2]] }))).toBeNull();
  });

  it('returns null when status is not a known GameStatus', () => {
    expect(loadGameState(JSON.stringify({ ...validState, status: 'bogus' }))).toBeNull();
  });

  it('returns null when score is negative', () => {
    expect(loadGameState(JSON.stringify({ ...validState, score: -5 }))).toBeNull();
  });

  it('returns null when score is not a finite number', () => {
    expect(loadGameState(JSON.stringify({ ...validState, score: 'NaN' }))).toBeNull();
  });
});

describe('loadBestScore', () => {
  it('returns the parsed number when raw is valid', () => {
    expect(loadBestScore('1234')).toBe(1234);
  });

  it('returns 0 when raw is null', () => {
    expect(loadBestScore(null)).toBe(0);
  });

  it('returns 0 when raw is non-numeric', () => {
    expect(loadBestScore('abc')).toBe(0);
  });

  it('returns 0 when raw is negative', () => {
    expect(loadBestScore('-100')).toBe(0);
  });
});

describe('saveGameState', () => {
  let setItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setItemSpy = vi.fn();
    vi.stubGlobal('localStorage', { setItem: setItemSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the JSON-serialised state under STORAGE_KEYS.GAME_STATE', () => {
    saveGameState(validState);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEYS.GAME_STATE, JSON.stringify(validState));
  });

  it('swallows errors when setItem throws (private mode / quota exceeded)', () => {
    setItemSpy.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveGameState(validState)).not.toThrow();
  });
});

describe('saveBestScore', () => {
  let setItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setItemSpy = vi.fn();
    vi.stubGlobal('localStorage', { setItem: setItemSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the score as a string under STORAGE_KEYS.BEST_SCORE', () => {
    saveBestScore(2048);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEYS.BEST_SCORE, '2048');
  });

  it('swallows errors when setItem throws', () => {
    setItemSpy.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => saveBestScore(100)).not.toThrow();
  });
});
