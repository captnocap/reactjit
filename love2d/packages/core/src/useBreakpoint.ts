import { useState, useEffect } from 'react';
import { useBridge } from './context';
// useBreakpoint/useOrientation/useLayout are framework primitives — they subscribe
// to the viewport bridge event directly with dep-driven lifecycle.

// ── Types ────────────────────────────────────────────────────────────

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

/** Viewport orientation based on aspect ratio. */
export type Orientation = 'portrait' | 'landscape' | 'square';

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

/** Compute breakpoint from width. */
function resolveBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  return 'sm';
}

/** Determine orientation from dimensions. 20% tolerance band → 'square'. */
function resolveOrientation(width: number, height: number): Orientation {
  if (width <= 0 || height <= 0) return 'square';
  const ratio = width / height;
  if (ratio > 1.2) return 'landscape';
  if (ratio < 0.833) return 'portrait'; // 1/1.2
  return 'square';
}

// ── Initial viewport (set by Lua before mount) ──────────────────────

/** Read initial viewport dimensions set by Lua before React mounts.
 *  This avoids the race where useEffect subscribers miss the first
 *  viewport event (pushed before effects register). */
function getInitialViewport(): { width: number; height: number } {
  const vp = (globalThis as any).__rjitViewport;
  if (vp && vp.width > 0) return vp;
  return { width: 0, height: 0 };
}

// ── Hooks ────────────────────────────────────────────────────────────
// These subscribe to the viewport event directly and only trigger a
// React re-render when their derived value actually changes. During
// continuous resize, breakpoint changes at 4 thresholds and orientation
// changes at 2 — not on every pixel.

/** Returns the current breakpoint based on viewport width. */
export function useBreakpoint(): Breakpoint {
  const bridge = useBridge();
  const [bp, setBp] = useState<Breakpoint>(() => {
    const { width } = getInitialViewport();
    return width > 0 ? resolveBreakpoint(width) : 'sm';
  });
  // rjit-ignore-next-line — Framework primitive: useBreakpoint subscribes to viewport events
  useEffect(() => {
    return bridge.subscribe('viewport', (payload: { width: number }) => {
      if (!payload || !payload.width) return;
      const next = resolveBreakpoint(payload.width);
      setBp(prev => prev === next ? prev : next);
    });
  }, [bridge]);
  return bp;
}

/** Returns viewport orientation: 'portrait', 'landscape', or 'square'. */
export function useOrientation(): Orientation {
  const bridge = useBridge();
  const [o, setO] = useState<Orientation>(() => {
    const { width, height } = getInitialViewport();
    return width > 0 ? resolveOrientation(width, height) : 'square';
  });
  // rjit-ignore-next-line — Framework primitive: useOrientation subscribes to viewport events
  useEffect(() => {
    return bridge.subscribe('viewport', (payload: { width: number; height: number }) => {
      if (!payload || !payload.width || !payload.height) return;
      const next = resolveOrientation(payload.width, payload.height);
      setO(prev => prev === next ? prev : next);
    });
  }, [bridge]);
  return o;
}

/** Combined breakpoint + orientation for layout decisions. */
export function useLayout(): { breakpoint: Breakpoint; orientation: Orientation } {
  const bridge = useBridge();
  const [layout, setLayout] = useState(() => {
    const { width, height } = getInitialViewport();
    return {
      breakpoint: width > 0 ? resolveBreakpoint(width) : 'sm' as Breakpoint,
      orientation: width > 0 ? resolveOrientation(width, height) : 'square' as Orientation,
    };
  });
  // rjit-ignore-next-line — Framework primitive: useLayout subscribes to viewport events
  useEffect(() => {
    return bridge.subscribe('viewport', (payload: { width: number; height: number }) => {
      if (!payload || !payload.width || !payload.height) return;
      const nextBp = resolveBreakpoint(payload.width);
      const nextO = resolveOrientation(payload.width, payload.height);
      setLayout(prev => {
        if (prev.breakpoint === nextBp && prev.orientation === nextO) return prev;
        return { breakpoint: nextBp, orientation: nextO };
      });
    });
  }, [bridge]);
  return layout;
}
