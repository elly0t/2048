// TP §UI #14 — input must be gated while end-state overlay is open.
// Defends "tiles move behind modal" bug class — native <dialog> inert blocks
// pointer/focus but not window-level keydown.
import { test, expect, seedBoard } from './fixtures';

test('WON overlay open: arrow keys do not move tiles behind it', async ({ page }) => {
  await seedBoard(page, {
    board: [
      [1024, 1024, null, null],
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  });
  await page.goto('/');

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('status-overlay')).toBeVisible();

  const scoreBefore = await page.getByTestId('score').textContent();
  const tileCountBefore = await page.locator('[data-testid="tile"]:not([data-ghost])').count();

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');

  await expect(page.getByTestId('score')).toHaveText(scoreBefore ?? '');
  await expect(page.locator('[data-testid="tile"]:not([data-ghost])')).toHaveCount(tileCountBefore);
  await expect(page.getByTestId('status-overlay')).toBeVisible();
});
