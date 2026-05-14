// TP §UI #6 — forces LOST via one move; defends "spawnTile errors when board full".
import { test, expect, seedBoard } from './fixtures';

test('LOST state: forced lock via ArrowRight on 15-tile board → overlay + both buttons + no errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Spawn cell (3,0) has neighbors 8 above and 8 right — any 2/4 spawn locks LOST.
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
  await expect(page.getByTestId('status-title')).toHaveText('Game over');
  await expect(page.getByTestId('status-continue')).toBeVisible();
  await expect(page.getByTestId('status-restart')).toBeVisible();

  expect(errors).toEqual([]);
});
