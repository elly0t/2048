// User-facing strings centralised for future i18n. Swap this module for a
// locale-aware lookup (or generate per-locale variants of this file) without
// touching components — they read `COPY.<feature>.<key>` and never inline.
//
// Shape nests by feature/component to keep keys short at call sites.

export const COPY = {
  app: {
    title: '2048',
  },
  header: {
    scoreLabel: 'Score',
    bestLabel: 'Best',
    newGame: 'New Game',
    newGameAria: 'New game', // a11y label for mobile icon-only restart button
  },
  ai: {
    askAi: 'Ask AI',
    shortcutHint: '(Space)',
    computing: 'Computing…',
  },
  status: {
    won: 'You won',
    lost: 'Game over',
    continueButton: 'Continue',
    restartButton: 'Restart',
  },
  meta: {
    arrowKeysHint: 'arrow keys to move',
    spaceHint: 'space for AI advice',
  },
} as const;
