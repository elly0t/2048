// TP §UI #11 — touch swipe wiring via `useSwipe` on iPhone-emulated WebKit.
import { devices } from '@playwright/test';
import { test, expect, seedBoard, touchGesture } from './fixtures';

const N = null;

test.use({ ...devices['iPhone 13'] });

test('touch swipe left: same collapse as ArrowLeft #1 (WebKit only)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit', 'touch swipe runs WebKit-only');

  await seedBoard(page, {
    board: [
      [N, 2, N, 2],
      [N, N, N, N],
      [N, N, N, N],
      [N, N, N, N],
    ],
    score: 0,
  });
  await page.goto('/');

  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('0');

  // Left swipe across the board: 150px horizontal delta (>30px threshold).
  await touchGesture(page, '[data-testid="board"]', { x: 250, y: 200 }, { x: 100, y: 200 });

  await expect(page.getByTestId('score')).toHaveText('4');
  await expect(
    page.locator(
      '[data-testid="tile"]:not([data-ghost])[data-row="0"][data-col="0"][data-value="4"]',
    ),
  ).toBeVisible();
});
