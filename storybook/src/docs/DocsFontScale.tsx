import React, { createContext, useContext, useState, useCallback } from 'react';

interface FontScaleCtx {
  scale: number;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
}

const FontScaleContext = createContext<FontScaleCtx>({
  scale: 1,
  increase: () => {},
  decrease: () => {},
  reset: () => {},
});

const MIN_SCALE = 0.8;
const MAX_SCALE = 2.5;
const STEP = 0.10;

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  const increase = useCallback(() => setScale(s => Math.min(MAX_SCALE, s + STEP)), []);
  const decrease = useCallback(() => setScale(s => Math.max(MIN_SCALE, s - STEP)), []);
  const reset = useCallback(() => setScale(1), []);

  return (
    <FontScaleContext.Provider value={{ scale, increase, decrease, reset }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useDocsFontScale() {
  return useContext(FontScaleContext);
}

/** Scale a fontSize value by the current docs font scale */
export function useScaledFont(baseSize: number, baseLineHeight?: number) {
  const { scale } = useContext(FontScaleContext);
  return {
    fontSize: Math.round(baseSize * scale),
    lineHeight: baseLineHeight ? Math.round(baseLineHeight * scale) : undefined,
  };
}
