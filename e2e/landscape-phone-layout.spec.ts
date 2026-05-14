// TP §UI — landscape phone (≤500px height) must keep the board fully visible
// and the Ask AI CTA inline below it, with no occlusion. Locks in the responsive
// fix introduced for orientation: landscape + max-height: 500px.
import { test, expect } from './fixtures';

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

test('landscape phone: board and Ask AI both visible, CTA does not overlap board', async ({
  page,
}) => {
  await page.goto('/');

  const board = page.getByTestId('board');
  const askAi = page.getByTestId('ask-ai');

  await expect(board).toBeInViewport({ ratio: 1 });
  await expect(askAi).toBeInViewport({ ratio: 1 });

  const boardBox = await board.boundingBox();
  const ctaBox = await askAi.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(ctaBox).not.toBeNull();

  // CTA must sit fully below the board — never overlap, never above.
  expect(ctaBox!.y).toBeGreaterThanOrEqual(boardBox!.y + boardBox!.height);
});
