// TP §UI #8 — Refresh restores board, score, bestScore from localStorage.
import { test, expect } from './fixtures';

test('refresh restores board + score + bestScore', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('ArrowLeft');

  const captureTiles = () =>
    page.locator('[data-testid="tile"]:not([data-ghost])').evaluateAll((els) =>
      els.map((el) => ({
        row: el.getAttribute('data-row'),
        col: el.getAttribute('data-col'),
        value: el.getAttribute('data-value'),
      })),
    );
  const toMap = (xs: { row: string | null; col: string | null; value: string | null }[]) =>
    Object.fromEntries(xs.map((t) => [`${t.row},${t.col}`, t.value]));

  const tilesBefore = await captureTiles();
  const scoreBefore = await page.getByTestId('score').textContent();
  const bestBefore = await page.getByTestId('best-score').textContent();

  await page.reload();

  const tilesAfter = await captureTiles();
  expect(toMap(tilesAfter)).toEqual(toMap(tilesBefore));
  await expect(page.getByTestId('score')).toHaveText(scoreBefore ?? '');
  await expect(page.getByTestId('best-score')).toHaveText(bestBefore ?? '');
});
