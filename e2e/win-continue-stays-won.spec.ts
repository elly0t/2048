// TP §UI #5 — Defends CDD2 "win status silently cleared on continue".
// Status must STAY won after dismissing the overlay; assumption #4 continue-after-win.
import { test, expect, seedBoard } from './fixtures';

test('WIN Continue: dismiss overlay → status stays WON (h1 data-status) → Ask AI still returns advice', async ({
  page,
}) => {
  await seedBoard(page, {
    board: [
      [1024, 1024, null, null],
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  });
  await page.goto('/');

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('status-overlay')).toBeVisible();

  await page.getByTestId('status-continue').click();
  await expect(page.getByTestId('status-overlay')).not.toBeVisible();

  // CDD2: status must still be WON internally — h1 data-status reflects it.
  await expect(page.getByRole('heading', { level: 1, name: '2048' })).toHaveAttribute(
    'data-status',
    'won',
  );

  // Assumption #4: Ask AI still works on a post-WIN board.
  await page.getByTestId('ask-ai').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as { __lastAdvice?: { direction?: string } }).__lastAdvice?.direction,
      ),
    )
    .toBeTruthy();
});
