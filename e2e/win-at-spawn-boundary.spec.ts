// TP §UI #4 — Defends CDD1 "win/lose checked one turn late".
// WIN status must flip on the merging move, not the next one.
import { test, expect, seedBoard } from './fixtures';

test('WIN at spawn boundary: merge to 2048 → status flips WON same tick → overlay shown', async ({
  page,
}) => {
  await seedBoard(page, {
    board: [
      [1024, 1024, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  });
  await page.goto('/');

  await page.keyboard.press('ArrowLeft');

  await expect(page.getByTestId('status-overlay')).toBeVisible();
  await expect(page.getByTestId('status-title')).toHaveText('You won');

  const wonTile = page.locator(
    '[data-testid="tile"]:not([data-ghost])[data-row="0"][data-col="0"][data-value="2048"]',
  );
  await expect(wonTile).toBeVisible();
});
