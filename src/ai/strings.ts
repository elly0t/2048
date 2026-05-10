import type { Component } from './types';

// User-facing strings for the AI module. Centralised so logic and tests share
// one source of truth; swap this file for an i18n-aware version later.

export const TEMPLATES: Record<Component, string> = {
  monotonicity: 'keeps tiles ordered along rows',
  smoothness: 'keeps similar tiles close, more merges available',
  emptyCells: 'frees up board space',
  cornerBonus: 'keeps largest tile anchored in corner',
};

export const GENERIC_TEMPLATE = 'best overall position';
export const NO_MOVES_AVAILABLE = 'No moves available.';
export const LOG_PREFIX = '[AI]';
