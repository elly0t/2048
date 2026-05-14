// TP §UI #9 — Lazy-init invariant: refresh into WON/LOST does NOT re-show the overlay.
// `StatusOverlay.tsx` L11-12: dismissedFor is seeded to current status on mount.
import { test, expect, seedBoard } from './fixtures';

test('Refresh into WON: overlay does not re-prompt; status persists as WON', async ({ page }) => {
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

  await page.reload();

  await expect(page.getByTestId('status-overlay')).not.toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '2048' })).toHaveAttribute(
    'data-status',
    'won',
  );
});
