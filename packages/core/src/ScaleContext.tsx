/**
 * Viewport-proportional scaling for ReactJIT.
 *
 * Wrap a subtree in <ScaleProvider reference={{ width: 800, height: 600 }}>
 * and all primitives inside automatically scale their numeric style values
 * based on the current window dimensions vs. the reference dimensions.
 *
 * At the reference size, scale=1 and everything renders as authored.
 * At 2x the reference, scale=2 and all pixel values double.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from './hooks';
import { scaleStyle } from './scaleStyle';
import type { Style } from './types';

export interface ScaleContextValue {
  scale: number;
}

export const ScaleContext = createContext<ScaleContextValue>({ scale: 1 });

export interface ScaleProviderProps {
  /** The window dimensions at which scale=1 (content renders as authored). */
  reference: { width: number; height: number };
  children: React.ReactNode;
}

export function ScaleProvider({ reference, children }: ScaleProviderProps) {
  const { width, height } = useWindowDimensions();

  const value = useMemo<ScaleContextValue>(() => {
    if (width <= 0 || height <= 0) return { scale: 1 };
    const s = Math.min(width / reference.width, height / reference.height);
    // Never scale below 1 — at reference size or smaller, render as authored
    return { scale: Math.max(1, s) };
  }, [width, height, reference.width, reference.height]);

  return (
    <ScaleContext.Provider value={value}>
      {children}
    </ScaleContext.Provider>
  );
}

/**
 * Read the current scale factor. Returns 1 when no ScaleProvider is present.
 */
export function useScale(): number {
  return useContext(ScaleContext).scale;
}

/**
 * Scale a style object by the current viewport scale factor.
 * Returns the original object when scale=1 (no allocation).
 */
export function useScaledStyle(style: Style | undefined): Style | undefined {
  const { scale } = useContext(ScaleContext);
  if (!style || scale === 1) return style;
  return scaleStyle(style, scale);
}

/**
 * Opt out of viewport scaling for a subtree.
 * Everything inside <NoScale> renders at its authored pixel size,
 * regardless of the surrounding ScaleProvider.
 */
export function NoScale({ children }: { children: React.ReactNode }) {
  return (
    <ScaleContext.Provider value={{ scale: 1 }}>
      {children}
    </ScaleContext.Provider>
  );
}
