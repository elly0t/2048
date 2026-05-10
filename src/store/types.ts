export const STATUS = {
  IDLE: 'idle',
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
} as const;

export type GameStatus = (typeof STATUS)[keyof typeof STATUS];
