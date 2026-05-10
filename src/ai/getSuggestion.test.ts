import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSuggestion } from './getSuggestion';
import type { Board } from '../domain/types';
import { CONFIG } from '../config';

// ---- fixtures ----

const standardBoard: Board = [
  [2, 4, null, null],
  [null, 8, null, 2],
  [4, null, null, null],
  [null, null, 16, null],
];

const loseBoard: Board = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
];

const winBoard: Board = [
  [4, null, null, 2],
  [2048, null, null, null],
  [4, 2, null, null],
  [4, null, null, null],
];

// Only Down is a valid move: row 0 is full and immovable horizontally,
// rows 1-3 are empty so Up does nothing, Down drops row 0 to row 3.
const onlyDownValidBoard: Board = [
  [2, 4, 8, 16],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
];

// Mirror-symmetric across the vertical axis — Left and Right produce
// equivalent post-move boards, so tie-break must be deterministic.
const symmetricBoard: Board = [
  [2, null, null, 2],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
];

describe('getSuggestion — basic contract (cases 1, 2)', () => {
  it('returns a valid direction for a standard board', async () => {
    const advice = await getSuggestion(standardBoard);
    expect(['left', 'right', 'up', 'down']).toContain(advice.direction);
  });

  it('reasoning starts with "Move "', async () => {
    const advice = await getSuggestion(standardBoard);
    expect(advice.reasoning).toMatch(/^Move /);
  });
});

describe('getSuggestion — terminal boards (cases 3, 4)', () => {
  it('lose board: direction is null', async () => {
    const advice = await getSuggestion(loseBoard);
    expect(advice.direction).toBeNull();
  });

  it('win board: still returns valid direction (continue-after-win)', async () => {
    const advice = await getSuggestion(winBoard);
    expect(['left', 'right', 'up', 'down']).toContain(advice.direction);
  });
});

describe('getSuggestion — direction selection (cases 5, 6)', () => {
  it('does not select a no-op direction', async () => {
    const advice = await getSuggestion(onlyDownValidBoard);
    expect(advice.direction).toBe('down');
  });

  it('returns the same direction across calls on a symmetric board', async () => {
    const a = await getSuggestion(symmetricBoard);
    const b = await getSuggestion(symmetricBoard);
    expect(a.direction).toBe(b.direction);
  });
});

// Cases 7-9 are smoke-tested in RED; tighten with hand-checked boards in GREEN
// (specific dominant-component boards + a sub-5%-deltas board for the generic template).
describe('getSuggestion — reasoning templates (cases 7, 8, 9)', () => {
  it('reasoning matches one of the known templates', async () => {
    const advice = await getSuggestion(standardBoard);
    const knownTemplates =
      /^Move (left|right|up|down) — (keeps tiles ordered along rows|keeps similar tiles close, more merges available|frees up board space|keeps largest tile anchored in corner|best overall position)$/;
    expect(advice.reasoning).toMatch(knownTemplates);
  });

  it('reasoning is deterministic across calls', async () => {
    const a = await getSuggestion(standardBoard);
    const b = await getSuggestion(standardBoard);
    expect(a.reasoning).toBe(b.reasoning);
  });
});

describe('getSuggestion — debug payload (cases 10, 11)', () => {
  it('debug has all four fields with correct types', async () => {
    const advice = await getSuggestion(standardBoard);
    expect(typeof advice.debug.computedInMs).toBe('number');
    expect(typeof advice.debug.nodesEvaluated).toBe('number');
    expect(typeof advice.debug.depthSearched).toBe('number');
    expect(typeof advice.debug.scores).toBe('object');
  });

  it('debug.scores includes all 4 directions even when some are no-ops', async () => {
    const advice = await getSuggestion(onlyDownValidBoard);
    expect(Object.keys(advice.debug.scores).sort()).toEqual([
      'down',
      'left',
      'right',
      'up',
    ]);
  });

  it('debug.depthSearched matches CONFIG.EXPECTIMAX_DEPTH', async () => {
    const advice = await getSuggestion(standardBoard);
    expect(advice.debug.depthSearched).toBe(CONFIG.EXPECTIMAX_DEPTH);
  });
});

describe('getSuggestion — determinism (case 12)', () => {
  it('same board produces identical advice across calls', async () => {
    const a = await getSuggestion(standardBoard);
    const b = await getSuggestion(standardBoard);
    expect(a.direction).toBe(b.direction);
    expect(a.reasoning).toBe(b.reasoning);
    expect(a.debug.scores).toEqual(b.debug.scores);
  });
});

describe('getSuggestion — side effects (case 13)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let savedWindow: unknown;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    savedWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {};
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    (globalThis as { window?: unknown }).window = savedWindow;
  });

  it('logs via console.log("[AI]", advice)', async () => {
    const advice = await getSuggestion(standardBoard);
    expect(consoleSpy).toHaveBeenCalledWith('[AI]', advice);
  });

  it('sets window.__lastAdvice to the advice', async () => {
    const advice = await getSuggestion(standardBoard);
    const win = (globalThis as { window: { __lastAdvice?: unknown } }).window;
    expect(win.__lastAdvice).toBe(advice);
  });

  it('appends the advice to window.__adviceHistory', async () => {
    const advice = await getSuggestion(standardBoard);
    const win = (globalThis as { window: { __adviceHistory?: unknown[] } }).window;
    expect(win.__adviceHistory).toContain(advice);
  });
});

describe('getSuggestion — AI_MODE routing (case 14)', () => {
  // CONFIG.AI_MODE = 'local' is the default. Smoke-check that local
  // mode succeeds without network. Remote-routing test will mock fetch
  // when AI_MODE='remote' is exercised end-to-end.
  it('local mode returns advice without network', async () => {
    const advice = await getSuggestion(standardBoard);
    expect(advice).toBeDefined();
  });
});
