import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSuggestion, selectTopTwo, pickReasoning } from './getSuggestion';
import { TEMPLATES, GENERIC_TEMPLATE } from './strings';
import type { Board, Direction } from '../domain/types';
import type { ComponentScores } from './types';
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

describe('getSuggestion — reasoning template integration (cases 7, 8, 9)', () => {
  it('reasoning matches one of the known templates', async () => {
    const advice = await getSuggestion(standardBoard);
    const validBodies = [...Object.values(TEMPLATES), GENERIC_TEMPLATE]
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const knownTemplates = new RegExp(`^Move (Left|Right|Up|Down) — (${validBodies})$`);
    expect(advice.reasoning).toMatch(knownTemplates);
  });

  it('reasoning is deterministic across calls', async () => {
    const a = await getSuggestion(standardBoard);
    const b = await getSuggestion(standardBoard);
    expect(a.reasoning).toBe(b.reasoning);
  });
});

describe('pickReasoning — dominant-component templating (cases 7, 8, 9)', () => {
  // Synthetic component snapshots; bestScore = 100 puts the threshold at 5.
  const baseline: ComponentScores = {
    monotonicity: 0,
    smoothness: 0,
    emptyCells: 0,
    cornerBonus: 0,
  };

  it('monotonicity dominant → mono template', () => {
    // weighted delta: 1.0 × (10 − 0) = 10 > 5 (threshold)
    const best: ComponentScores = { ...baseline, monotonicity: 10 };
    expect(pickReasoning('left', best, baseline, 100)).toBe(
      `Move Left — ${TEMPLATES.monotonicity}`,
    );
  });

  it('smoothness dominant → smooth template', () => {
    // weighted delta: 0.1 × (100 − 0) = 10 > 5
    const best: ComponentScores = { ...baseline, smoothness: 100 };
    expect(pickReasoning('right', best, baseline, 100)).toBe(
      `Move Right — ${TEMPLATES.smoothness}`,
    );
  });

  it('empty cells dominant → empty template', () => {
    // weighted delta: 2.7 × (10 − 0) = 27 > 5
    const best: ComponentScores = { ...baseline, emptyCells: 10 };
    expect(pickReasoning('up', best, baseline, 100)).toBe(`Move Up — ${TEMPLATES.emptyCells}`);
  });

  it('cornerBonus dominant → corner template', () => {
    // weighted delta: 1.0 × (10 − 0) = 10 > 5
    const best: ComponentScores = { ...baseline, cornerBonus: 10 };
    expect(pickReasoning('down', best, baseline, 100)).toBe(
      `Move Down — ${TEMPLATES.cornerBonus}`,
    );
  });

  it('all weighted deltas below 5% threshold → generic template', () => {
    // Largest weighted delta: 2.7 × 1 = 2.7 < 5 (5% of bestScore=100)
    const best: ComponentScores = {
      monotonicity: 1,
      smoothness: 1,
      emptyCells: 1,
      cornerBonus: 1,
    };
    expect(pickReasoning('left', best, baseline, 100)).toBe(`Move Left — ${GENERIC_TEMPLATE}`);
  });

  it('null secondBest (only one valid direction) → generic template', () => {
    expect(pickReasoning('up', baseline, null, 100)).toBe(`Move Up — ${GENERIC_TEMPLATE}`);
  });

  // Case 9: implicit. pickReasoning takes only 2 component snapshots; selectTopTwo
  // chooses which is "second-best". Both halves are tested separately, so a delta
  // computed against third or worst is structurally impossible.
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

describe('selectTopTwo — best + second-best selection', () => {
  it('returns the highest two from an all-valid score map', () => {
    const scores: Record<Direction, number | null> = { left: 50, right: 100, up: 75, down: 60 };
    const result = selectTopTwo(scores);
    expect(result.best).toBe('right');
    expect(result.secondBest).toBe('up');
  });

  it('skips null (no-op) scores', () => {
    const scores: Record<Direction, number | null> = { left: 50, right: null, up: 75, down: null };
    const result = selectTopTwo(scores);
    expect(result.best).toBe('up');
    expect(result.secondBest).toBe('left');
  });

  it('returns secondBest = null when only one direction is valid', () => {
    const scores: Record<Direction, number | null> = { left: null, right: null, up: null, down: 42 };
    const result = selectTopTwo(scores);
    expect(result.best).toBe('down');
    expect(result.secondBest).toBeNull();
  });

  it('returns both null when every direction is a no-op', () => {
    const scores: Record<Direction, number | null> = { left: null, right: null, up: null, down: null };
    const result = selectTopTwo(scores);
    expect(result.best).toBeNull();
    expect(result.secondBest).toBeNull();
  });

  it('ties at the top resolve by ALL_DIRECTIONS order (left before right)', () => {
    const scores: Record<Direction, number | null> = { left: 100, right: 100, up: null, down: null };
    const result = selectTopTwo(scores);
    expect(result.best).toBe('left');
    expect(result.secondBest).toBe('right');
  });

  it('demotes the previous best to second-best when a higher score arrives later', () => {
    // Order: left(50) → right(100) bumps left → up(75) replaces left as second
    const scores: Record<Direction, number | null> = { left: 50, right: 100, up: 75, down: 30 };
    const result = selectTopTwo(scores);
    expect(result.best).toBe('right');
    expect(result.secondBest).toBe('up');
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
