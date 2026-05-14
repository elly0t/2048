// TP §UI #15 — landscape phone (≤500px height): board fully visible and Ask AI
// CTA inline below, no occlusion. Defends orientation:landscape + max-height:500px rule.
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

  // CTA top edge ≥ board bottom edge — no overlap.
  expect(ctaBox!.y).toBeGreaterThanOrEqual(boardBox!.y + boardBox!.height);
});
