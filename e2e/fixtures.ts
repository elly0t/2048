import { test as base, expect, type Page } from '@playwright/test';

// Shared E2E fixtures — see TD §12.4.

type Fixtures = {
  seededRandom: void;
};

export const test = base.extend<Fixtures>({
  seededRandom: [
    async ({ page }, use, testInfo) => {
      const seed = hashString(testInfo.title);
      await page.addInitScript((s: number) => {
        let state = s | 0;
        Math.random = () => {
          state = (state + 0x6d2b79f5) | 0;
          let t = Math.imul(state ^ (state >>> 15), 1 | state);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }, seed);
      await use();
    },
    { auto: true },
  ],
});

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

export { expect };

function hashString(s: string): number {
  // FNV-1a 32-bit — stable seed derivation from test title.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// `useSwipe` consumes touchstart + touchend only — no move events needed.
export async function touchGesture(
  page: Page,
  selector: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.dispatchEvent(selector, 'touchstart', {
    touches: [{ clientX: from.x, clientY: from.y, identifier: 0 }],
    changedTouches: [{ clientX: from.x, clientY: from.y, identifier: 0 }],
    targetTouches: [{ clientX: from.x, clientY: from.y, identifier: 0 }],
  });
  await page.dispatchEvent(selector, 'touchend', {
    touches: [],
    changedTouches: [{ clientX: to.x, clientY: to.y, identifier: 0 }],
    targetTouches: [],
  });
}
