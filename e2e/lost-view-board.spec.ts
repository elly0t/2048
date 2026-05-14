// TP §UI #7 — LOST overlay's View Board dismisses; status stays LOST; arrow keys are no-op.
import { test, expect, seedBoard } from './fixtures';

test('LOST View Board: dismiss overlay → h1 data-status stays "lost" → arrow keys no-op', async ({
  page,
}) => {
  await seedBoard(page, {
    board: [
      [16, 4, 8, 2],
      [2, 16, 4, 8],
      [8, 2, 16, 4],
      [8, 2, 16, null],
    ],
    score: 0,
  });
  await page.goto('/');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('status-overlay')).toBeVisible();

  await page.getByTestId('status-continue').click();
  await expect(page.getByTestId('status-overlay')).not.toBeVisible();

  await expect(page.getByRole('heading', { level: 1, name: '2048' })).toHaveAttribute(
    'data-status',
    'lost',
  );

  const tileCountBefore = await page.locator('[data-testid="tile"]:not([data-ghost])').count();
  const scoreBefore = await page.getByTestId('score').textContent();

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');

  await expect(page.locator('[data-testid="tile"]:not([data-ghost])')).toHaveCount(tileCountBefore);
  await expect(page.getByTestId('score')).toHaveText(scoreBefore ?? '');
});
