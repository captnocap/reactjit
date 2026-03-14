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

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  /** Pixels to subtract from viewport width before computing scale factor.
   *  Use when the ScaleProvider content doesn't span the full viewport
   *  (e.g. a fixed sidebar steals space). Default: 0. */
  insetWidth?: number;
  children: React.ReactNode;
}


export function ScaleProvider({ reference, curve = 'linear', cap = 1.8, insetWidth = 0, children }: ScaleProviderProps) {
  const bridge = useBridge();

  // Send scale config to Lua on mount and when curve/reference/cap/inset changes.
  // Lua computes the actual scale factor per frame in layout.lua.
  // rjit-ignore-next-line — Dep-driven: sends scale config RPC when reference/curve/cap changes
  useEffect(() => {
    bridge.rpc('scale:configure', {
      refW: reference.width,
      refH: reference.height,
      curve,
      cap,
      insetW: insetWidth,
    });
  }, [bridge, reference.width, reference.height, curve, cap, insetWidth]);

  // Subscribe to Lua's computed scale factor — only fires when it actually
  // changes, NOT on every resize frame. Zero React re-renders during drag.
  const [scaleState, setScaleState] = useState({ scale: 1, rawScale: 1 });
  // rjit-ignore-next-line — Dep-driven: subscribes to scale change events from Lua
  useEffect(() => {
    return bridge.subscribe('scaleChanged', (payload: { scale: number; rawScale: number }) => {
      if (!payload) return;
      setScaleState({ scale: payload.scale, rawScale: payload.rawScale });
    });
  }, [bridge]);

  // rjit-ignore-next-line — framework API: scale provider memoization
  const value = useMemo<ScaleContextValue>(() => ({
    scale: scaleState.scale,
    rawScale: scaleState.rawScale,
    curve,
  }), [scaleState.scale, scaleState.rawScale, curve]);

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
