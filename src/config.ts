export const AI_MODES = {
  LOCAL: 'local',
  REMOTE: 'remote',
} as const;

export type AIMode = (typeof AI_MODES)[keyof typeof AI_MODES];

export const CONFIG = {
  WIN_TILE: 2048,
  INIT_TILE_COUNT: { min: 2, max: 8 },
  SPAWN_WEIGHTS: { 2: 0.9, 4: 0.1 },
  EXPECTIMAX_DEPTH: 3,
  AI_MODE: AI_MODES.LOCAL as AIMode,
  // Reasoning falls back to "best overall position" when the dominant weighted
  // component delta is below this fraction of the chosen direction's score (TD §5.4).
  GENERIC_TEMPLATE_THRESHOLD: 0.05,
  // Visible-loading floor — depth-3 expectimax returns in ~74ms, below the flicker-vs-feedback threshold.
  MIN_ADVICE_LOADING_MS: 150,
} as const;
