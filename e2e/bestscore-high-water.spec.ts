// TP §UI #12 — bestScore updates on a new high and persists across refresh.
import { test, expect, seedBoard } from './fixtures';

const N = null;

test('bestScore: updates on new high and survives refresh', async ({ page }) => {
  await seedBoard(page, {
    board: [
      [2, 2, N, N],
      [N, N, N, N],
      [N, N, N, N],
      [N, N, N, N],
    ],
    score: 0,
    bestScore: 0,
  });
  await page.goto('/');

  await expect(page.getByTestId('best-score')).toHaveText('0');

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('score')).toHaveText('4');
  await expect(page.getByTestId('best-score')).toHaveText('4');

  await page.reload();

  await expect(page.getByTestId('best-score')).toHaveText('4');
});
