/**
 * Viewport-proportional scaling for ReactJIT.
 *
 * ScaleProvider configures Lua's layout engine to scale numeric style
 * values based on viewport size vs. a reference size. All actual scaling
 * happens in Lua (layout.lua) — zero React re-renders on resize.
 *
 * useScale() still returns the current factor for the few components
 * (CodeBlock, Slider, Math) that need it for non-style prop scaling.
 * useScaledStyle() is a passthrough — Lua handles style scaling.
 */

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useWindowDimensions } from './hooks';
import { useBridge } from './context';
import type { Style } from './types';

/**
 * Scaling curve strategies (applied in Lua):
 * - 'linear':  Unbounded proportional scaling (original behavior). 4K ≈ 3.6×.
 * - 'sqrt':    Square-root curve — diminishing returns. 4K ≈ 1.9×.
 * - 'capped':  Linear up to a hard cap (default 1.8×), then flat.
 */
export type ScaleCurve = 'linear' | 'sqrt' | 'capped';

export interface ScaleContextValue {
  scale: number;
  /** The active curve, for debug/display purposes. */
  curve: ScaleCurve;
  /** The raw linear scale before curve is applied, for debug/display. */
  rawScale: number;
}

export const ScaleContext = createContext<ScaleContextValue>({ scale: 1, curve: 'linear', rawScale: 1 });

export interface ScaleProviderProps {
  /** The window dimensions at which scale=1 (content renders as authored). */
  reference: { width: number; height: number };
  /** Scaling curve strategy. Default: 'linear' (original behavior). */
  curve?: ScaleCurve;
  /** Hard cap value for 'capped' curve. Default: 1.8. */
  cap?: number;
  children: React.ReactNode;
}

/** Apply the chosen curve to a raw linear scale factor (TS side for useScale). */
function applyCurve(raw: number, curve: ScaleCurve, cap: number): number {
  if (raw <= 1) return 1;
  switch (curve) {
    case 'sqrt':
      return Math.sqrt(raw);
    case 'capped':
      return Math.min(raw, cap);
    case 'linear':
    default:
      return raw;
  }
}

export function ScaleProvider({ reference, curve = 'linear', cap = 1.8, children }: ScaleProviderProps) {
  const bridge = useBridge();
  const { width, height } = useWindowDimensions();

  // Send scale config to Lua on mount and when curve/reference/cap changes.
  // Lua computes the actual scale factor per frame in layout.lua.
  useEffect(() => {
    bridge.rpc('scale:configure', {
      refW: reference.width,
      refH: reference.height,
      curve,
      cap,
    });
  }, [bridge, reference.width, reference.height, curve, cap]);

  // Compute scale locally for useScale() consumers (CodeBlock, Slider, Math).
  // This does NOT trigger re-renders in primitives — only components that
  // explicitly call useScale() will re-render on resize.
  const value = useMemo<ScaleContextValue>(() => {
    if (width <= 0 || height <= 0) return { scale: 1, curve, rawScale: 1 };
    const raw = Math.min(width / reference.width, height / reference.height);
    const s = applyCurve(raw, curve, cap);
    return { scale: Math.max(1, s), curve, rawScale: Math.max(1, raw) };
  }, [width, height, reference.width, reference.height, curve, cap]);

  return (
    <ScaleContext.Provider value={value}>
      {children}
    </ScaleContext.Provider>
  );
}

/**
 * Read the current scale factor. Returns 1 when no ScaleProvider is present.
 * Used by CodeBlock, Slider, Math for non-style prop scaling.
 */
export function useScale(): number {
  return useContext(ScaleContext).scale;
}

/**
 * Read the full scale context (scale, curve, rawScale) for debug displays.
 */
export function useScaleInfo(): ScaleContextValue {
  return useContext(ScaleContext);
}

/**
 * Passthrough — style scaling is handled by Lua's layout engine.
 * Kept for API compatibility so primitives don't need changes beyond
 * removing the import.
 * @deprecated Lua handles style scaling. This is a no-op passthrough.
 */
export function useScaledStyle(style: Style | undefined): Style | undefined {
  return style;
}

/**
 * Opt out of viewport scaling for a subtree.
 * Everything inside <NoScale> renders at its authored pixel size,
 * regardless of the surrounding ScaleProvider.
 */
export function NoScale({ children }: { children: React.ReactNode }) {
  return (
    <ScaleContext.Provider value={{ scale: 1, curve: 'linear', rawScale: 1 }}>
      {children}
    </ScaleContext.Provider>
  );
}
