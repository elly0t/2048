import type { Direction } from '../domain/types';

export type AIAdvice = {
  direction: Direction | null; // null on lose state — see TD §5.4
  reasoning: string;
  debug: {
    // null score = direction was a no-op (applyMove didn't change the board)
    scores: Record<Direction, number | null>;
    computedInMs: number;
    nodesEvaluated: number;
    depthSearched: number;
  };
};
