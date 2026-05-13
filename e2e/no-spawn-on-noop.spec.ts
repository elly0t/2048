// TP §UI #10 — No spawn / no score change on a move that doesn't change the board.
import { test, expect, seedBoard } from './fixtures';

test('no-op move (wall-stacked row, ArrowLeft): tile count and score unchanged', async ({
  page,
}) => {
  await seedBoard(page, {
    board: [
      [2, 4, 8, 16],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 50,
  });
  await page.goto('/');

  const tiles = page.locator('[data-testid="tile"]:not([data-ghost])');
  await expect(tiles).toHaveCount(4);
  await expect(page.getByTestId('score')).toHaveText('50');

  await page.keyboard.press('ArrowLeft');

  await expect(tiles).toHaveCount(4);
  await expect(page.getByTestId('score')).toHaveText('50');
});
