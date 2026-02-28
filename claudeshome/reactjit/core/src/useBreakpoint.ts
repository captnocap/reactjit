import { useMemo } from 'react';
import { useWindowDimensions } from './hooks';

// ── Types ────────────────────────────────────────────────────────────

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export type SemanticSpan =
  | 'full'
  | 'half'
  | 'third'
  | 'quarter'
  | 'two-thirds'
  | 'three-quarters';

/** A column span: numeric 1-12 or a semantic word. */
export type SpanValue = number | SemanticSpan;

// ── Constants ────────────────────────────────────────────────────────

/** Min-width thresholds (px) for each breakpoint. */
export const BREAKPOINTS: Record<Breakpoint, number> = {
  sm: 0,
  md: 640,
  lg: 1024,
  xl: 1440,
};

/** Semantic words → numeric 12-column spans. */
const SEMANTIC_MAP: Record<SemanticSpan, number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
  'two-thirds': 8,
  'three-quarters': 9,
};

/** Default responsive spans when `responsive` flag is used with no overrides. */
export const RESPONSIVE_DEFAULTS: Record<Breakpoint, number> = {
  sm: 12,
  md: 6,
  lg: 4,
  xl: 3,
};

// ── Utilities ────────────────────────────────────────────────────────

/** Convert a SpanValue (number or semantic word) to a numeric 1-12 span. */
export function resolveSpan(value: SpanValue): number {
  if (typeof value === 'number') return Math.max(1, Math.min(12, Math.round(value)));
  return SEMANTIC_MAP[value] ?? 12;
}

/** Convert a numeric span to a flexBasis percentage string. */
export function spanToFlexBasis(span: number): string {
  return `${(span / 12) * 100}%`;
}

// ── Hook ─────────────────────────────────────────────────────────────

/** Returns the current breakpoint based on viewport width. */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    return 'sm';
  }, [width]);
}
