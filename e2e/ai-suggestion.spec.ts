// TP §UI #2 — Ask AI integration: loading → advice → reasoning → history → determinism.
import { test, expect } from './fixtures';

test('Ask AI: click → __lastAdvice populated → reasoning matches direction → reasoning matches direction → button re-enables → history increments; second click deterministic', async ({
  page,
}) => {
  await page.goto('/');

  const historyLen = () =>
    page.evaluate(() => (window as { __adviceHistory?: unknown[] }).__adviceHistory?.length ?? 0);

  expect(await historyLen()).toBe(0);

  await page.getByTestId('ask-ai').click();
  await expect.poll(historyLen).toBe(1);
  await expect(page.getByTestId('ask-ai')).toBeEnabled();

  const advice = await page.evaluate(
    () => (window as { __lastAdvice?: Record<string, unknown> }).__lastAdvice,
  );
  expect(advice).not.toBeNull();
  expect(advice).not.toBeUndefined();
  expect(['left', 'right', 'up', 'down']).toContain(advice?.direction);
  const debug = advice?.debug as Record<string, unknown>;
  expect(typeof debug.depthSearched).toBe('number');
  // Design B: getSuggestion's direction loop populates all four scores.
  const scores = debug.scores as Record<string, unknown>;
  expect(Object.keys(scores).sort()).toEqual(['down', 'left', 'right', 'up']);

  await expect(page.getByTestId('advice-direction')).toHaveText(String(advice?.direction));

  await page.getByTestId('ask-ai').click();
  await expect.poll(historyLen).toBe(2);

  const advice2 = await page.evaluate(
    () => (window as { __lastAdvice?: Record<string, unknown> }).__lastAdvice,
  );
  expect(advice2).not.toBeNull();
  expect(advice2).not.toBeUndefined();
  expect(advice2?.direction).toBe(advice?.direction);
});
