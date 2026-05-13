// TP §UI #3 — Restart preserves bestScore, resets board + score.
import { test, expect, seedBoard } from './fixtures';

test('restart: board resets to fresh tiles all value 2, score=0, bestScore preserved', async ({
  page,
}) => {
  await seedBoard(page, {
    board: [
      [2, 4, 8, 16],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 100,
    bestScore: 200,
  });
  await page.goto('/');

  await expect(page.getByTestId('score')).toHaveText('100');
  await expect(page.getByTestId('best-score')).toHaveText('200');

  await page.getByTestId('restart').click();

  const tiles = page.locator('[data-testid="tile"]:not([data-ghost])');
  const count = await tiles.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(8);

  const values = await tiles.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-value')),
  );
  expect(values.every((v) => v === '2')).toBe(true);

  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('best-score')).toHaveText('200');
});
