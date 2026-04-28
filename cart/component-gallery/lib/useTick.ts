import { useEffect, useState } from 'react';

/**
 * Continuous time tick (seconds since mount). Re-renders every animation
 * frame; cancel on unmount. Used by surfaces that drive periodic motion
 * without owning a spring (e.g. infinite marquees, breathing pulses).
 */
export function useTick(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    let handle: any = null;
    const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const loop = (now: number) => {
      const t0 = (typeof now === 'number' ? now : Date.now()) - start;
      setT(t0 / 1000);
      handle = raf(loop);
    };
    handle = raf(loop);
    return () => {
      if (handle != null) {
        try { caf(handle); } catch (_) { /* noop */ }
      }
    };
  }, []);
  return t;
}
