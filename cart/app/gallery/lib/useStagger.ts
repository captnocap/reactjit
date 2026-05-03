import { useMemo } from 'react';
import { useSpring } from './useSpring';

export function useStagger(count: number, cfg?: { stiffness?: number; damping?: number }): number[] {
  const progress = useSpring(1, cfg);
  return useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const start = i / count;
      const raw = (progress - start) * count;
      out.push(Math.max(0, Math.min(1, raw)));
    }
    return out;
  }, [progress, count]);
}
