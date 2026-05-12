// TP §UI #13 — defends spec item 1 (initial board generation).
import { test, expect } from './fixtures';

test('cold load: ≥2 tiles, all value 2, score=0, no overlay', async ({ page }) => {
  await page.goto('/');

  const tiles = page.locator('[data-testid="tile"]:not([data-ghost])');
  await expect(tiles.first()).toBeVisible();

  const count = await tiles.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(8);

  const values = await tiles.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-value')),
  );
  expect(values.every((v) => v === '2')).toBe(true);

  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('best-score')).toHaveText('0');
  await expect(page.getByTestId('status-overlay')).not.toBeVisible();
});
