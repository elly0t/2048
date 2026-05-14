// TP §UI #16 — in-dialog Restart from WON/LOST resets the game and closes the overlay.
import { test, expect, seedBoard } from './fixtures';

test('WON dialog: status-restart resets board + score, hides overlay, preserves bestScore', async ({
  page,
}) => {
  await seedBoard(page, {
    board: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [1024, 1024, null, null],
    ],
    score: 1024,
    bestScore: 5000,
  });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft');

  await expect(page.getByTestId('status-overlay')).toBeVisible();
  await expect(page.getByTestId('status-title')).toHaveText('You won');
  await page.getByTestId('status-restart').click();

  await expect(page.getByTestId('status-overlay')).not.toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('best-score')).toHaveText('5000');

  const tiles = page.locator('[data-testid="tile"]:not([data-ghost])');
  const count = await tiles.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(8);
  const values = await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('data-value')));
  expect(values.every((v) => v === '2')).toBe(true);
});

test('LOST dialog: status-restart resets board + score, hides overlay, preserves bestScore', async ({
  page,
}) => {
  // Spawn cell (3,0) has neighbours 8 above and 128 right after slide — any 2/4 spawn locks LOST.
  await seedBoard(page, {
    board: [
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [null, 128, 256, 512],
    ],
    score: 4000,
    bestScore: 7000,
  });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft');

  await expect(page.getByTestId('status-overlay')).toBeVisible();
  await expect(page.getByTestId('status-title')).toHaveText('Game over');
  await page.getByTestId('status-restart').click();

  await expect(page.getByTestId('status-overlay')).not.toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('best-score')).toHaveText('7000');

  const tiles = page.locator('[data-testid="tile"]:not([data-ghost])');
  const count = await tiles.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(8);
  const values = await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('data-value')));
  expect(values.every((v) => v === '2')).toBe(true);
});
