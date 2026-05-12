// TP §UI #1 — defends spec items 2-4 (Move Left/Right/Up/Down) + CDD "only checks overall state".
import { test, expect, seedBoard } from './fixtures';

type Case = {
  direction: 'left' | 'right' | 'up' | 'down';
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
  initialBoard: (number | null)[][];
  mergedCell: { row: number; col: number; value: number };
};

const N = null;

const cases: Case[] = [
  {
    direction: 'left',
    key: 'ArrowLeft',
    initialBoard: [
      [N, 2, N, 2],
      [N, N, N, N],
      [N, N, N, N],
      [N, N, N, N],
    ],
    mergedCell: { row: 0, col: 0, value: 4 },
  },
  {
    direction: 'right',
    key: 'ArrowRight',
    initialBoard: [
      [2, N, 2, N],
      [N, N, N, N],
      [N, N, N, N],
      [N, N, N, N],
    ],
    mergedCell: { row: 0, col: 3, value: 4 },
  },
  {
    direction: 'up',
    key: 'ArrowUp',
    initialBoard: [
      [N, N, N, N],
      [2, N, N, N],
      [N, N, N, N],
      [2, N, N, N],
    ],
    mergedCell: { row: 0, col: 0, value: 4 },
  },
  {
    direction: 'down',
    key: 'ArrowDown',
    initialBoard: [
      [2, N, N, N],
      [N, N, N, N],
      [2, N, N, N],
      [N, N, N, N],
    ],
    mergedCell: { row: 3, col: 0, value: 4 },
  },
];

for (const c of cases) {
  test(`move ${c.direction}: merge two 2s → one 4 at expected cell, score +4, one spawn`, async ({
    page,
  }) => {
    await seedBoard(page, { board: c.initialBoard, score: 0 });
    await page.goto('/');

    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId('score')).toHaveText('0');

    await page.keyboard.press(c.key);

    await expect(page.getByTestId('score')).toHaveText('4');

    const mergedTile = page.locator(
      `[data-testid="tile"]:not([data-ghost])[data-row="${c.mergedCell.row}"][data-col="${c.mergedCell.col}"][data-value="${c.mergedCell.value}"]`,
    );
    await expect(mergedTile).toBeVisible();

    // Two original tiles → one merged + one spawn = 2 non-ghost tiles total.
    await expect(page.locator('[data-testid="tile"]:not([data-ghost])')).toHaveCount(2);
  });
}
