import type { Board, Direction } from '../domain/types';
import { ALL_DIRECTIONS } from '../domain/types';
import { applyMove } from '../domain/moves';
import { CONFIG, AI_MODES } from '../config';
import { scoreComponents } from './heuristics';
import { chanceValue, WEIGHTS, type SearchStats } from './expectimax';
import type { AIAdvice, Component, ComponentScores } from './types';
import { TEMPLATES, GENERIC_TEMPLATE, NO_MOVES_AVAILABLE, LOG_PREFIX } from './strings';

const COMPONENTS: readonly Component[] = [
  'monotonicity',
  'smoothness',
  'emptyCells',
  'cornerBonus',
];

function capitalize(direction: Direction): string {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

// Largest weighted component delta picks the template; below threshold → generic (TD §5.4).
export function pickReasoning(
  bestDirection: Direction,
  bestComponents: ComponentScores,
  secondBestComponents: ComponentScores | null,
  bestScore: number,
): string {
  const directionLabel = capitalize(bestDirection);

  if (secondBestComponents === null) {
    return `Move ${directionLabel} — ${GENERIC_TEMPLATE}`;
  }

  let dominant: Component | null = null;
  let dominantAbs = 0;
  COMPONENTS.forEach((component) => {
    const weighted =
      WEIGHTS[component] * (bestComponents[component] - secondBestComponents[component]);
    if (Math.abs(weighted) > dominantAbs) {
      dominantAbs = Math.abs(weighted);
      dominant = component;
    }
  });

  if (dominant === null || dominantAbs < CONFIG.GENERIC_TEMPLATE_THRESHOLD * Math.abs(bestScore)) {
    return `Move ${directionLabel} — ${GENERIC_TEMPLATE}`;
  }

  return `Move ${directionLabel} — ${TEMPLATES[dominant]}`;
}

// Top-2 in one pass; strict `>` makes ALL_DIRECTIONS order the tie-breaker.
export function selectTopTwo(
  scores: Record<Direction, number | null>,
): { best: Direction | null; secondBest: Direction | null } {
  let best: Direction | null = null;
  let bestScore = -Infinity;
  let secondBest: Direction | null = null;
  let secondBestScore = -Infinity;
  ALL_DIRECTIONS.forEach((direction) => {
    const score = scores[direction];
    if (score === null) return;
    if (score > bestScore) {
      secondBest = best;
      secondBestScore = bestScore;
      best = direction;
      bestScore = score;
    } else if (score > secondBestScore) {
      secondBest = direction;
      secondBestScore = score;
    }
  });
  return { best, secondBest };
}

// Logs advice; mirrors to window for live debugging when in a browser (TD §11).
function emitSideEffects(advice: AIAdvice): void {
  console.log(LOG_PREFIX, advice);
  const win = (globalThis as { window?: { __lastAdvice?: AIAdvice; __adviceHistory?: AIAdvice[] } })
    .window;
  if (win) {
    win.__lastAdvice = advice;
    win.__adviceHistory ??= [];
    win.__adviceHistory.push(advice);
  }
}

// Local mode: score each direction via expectimax; components feed the rationale template.
function localSuggestion(board: Board): AIAdvice {
  const start = performance.now();
  const stats: SearchStats = { nodesEvaluated: 0 };
  const depth = CONFIG.EXPECTIMAX_DEPTH;

  const scores: Record<Direction, number | null> = {
    left: null,
    right: null,
    up: null,
    down: null,
  };
  const components: Partial<Record<Direction, ComponentScores>> = {};

  ALL_DIRECTIONS.forEach((direction) => {
    const result = applyMove(board, direction);
    if (result.changed) {
      scores[direction] = chanceValue(result.board, depth - 1, stats);
      components[direction] = scoreComponents(result.board);
    }
  });

  const { best: bestDirection, secondBest: secondBestDirection } = selectTopTwo(scores);

  let reasoning: string;
  if (bestDirection === null) {
    reasoning = NO_MOVES_AVAILABLE;
  } else {
    const bestComponents = components[bestDirection]!;
    const secondBestComponents =
      secondBestDirection !== null ? components[secondBestDirection]! : null;
    const bestScore = scores[bestDirection]!;
    reasoning = pickReasoning(bestDirection, bestComponents, secondBestComponents, bestScore);
  }

  return {
    direction: bestDirection,
    reasoning,
    debug: {
      scores,
      computedInMs: performance.now() - start,
      nodesEvaluated: stats.nodesEvaluated,
      depthSearched: depth,
    },
  };
}

// Remote mode: delegate to the nneonneo Docker server (TD §5.4).
async function remoteSuggestion(board: Board): Promise<AIAdvice> {
  const response = await fetch('/api/suggest', {
    method: 'POST',
    body: JSON.stringify({ board }),
  });
  return response.json() as Promise<AIAdvice>;
}

// Dispatcher: routes by AI_MODE; emitSideEffects runs on both paths.
export async function getSuggestion(board: Board): Promise<AIAdvice> {
  const advice =
    CONFIG.AI_MODE === AI_MODES.REMOTE ? await remoteSuggestion(board) : localSuggestion(board);
  emitSideEffects(advice);
  return advice;
}
