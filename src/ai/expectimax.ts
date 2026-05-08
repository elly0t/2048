import type { Board } from '../domain/types';

// Weights for the heuristic aggregator H(board) = α·M + β·S + γ·E + δ·C.
// Values from nneonneo's 2048 AI analysis (cited in TD §5.3).
export const WEIGHTS = {
  monotonicity: 1.0,
  smoothness: 0.1,
  emptyCells: 2.7,
  cornerBonus: 1.0,
} as const;

export function expectimax(_board: Board, _depth?: number): number {
  throw new Error('not implemented');
}
