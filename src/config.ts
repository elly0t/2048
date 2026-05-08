export const CONFIG = {
  WIN_TILE: 2048,
  INIT_TILE_COUNT: { min: 2, max: 8 },
  SPAWN_WEIGHTS: { 2: 0.9, 4: 0.1 },
  EXPECTIMAX_DEPTH: 3,
  AI_MODE: 'local',
} as const;
