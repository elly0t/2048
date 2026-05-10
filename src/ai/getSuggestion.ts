import type { Board } from '../domain/types';
import type { AIAdvice } from './types';

export async function getSuggestion(_board: Board): Promise<AIAdvice> {
  throw new Error('not implemented');
}
