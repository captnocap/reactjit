// =============================================================================
// ANIMATION HELPERS — simple tweened values for ReactJIT (no CSS transitions)
// =============================================================================
// Usage: const opacity = useTween(show ? 1 : 0, 200);
//        <Box style={{ opacity: opacity }}>...</Box>
// =============================================================================

const React: any = require('react');
const { useState, useEffect, useRef } = React;

export function useTween(target: number, durationMs: number = 200): number {
  const [value, setValue] = useState(target);
  const startRef = useRef(target);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<any>(null);

  useEffect(() => {
    startRef.current = value;
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startRef.current + (target - startRef.current) * eased;
      setValue(next);
      if (t < 1) {
        timerRef.current = setTimeout(tick, 16);
      }
    };

    timerRef.current = setTimeout(tick, 16);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export function usePulse(min: number = 0.4, max: number = 1, durationMs: number = 1500): number {
  const [value, setValue] = useState(min);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const tick = () => {
      const t = (Date.now() % durationMs) / durationMs;
      const sine = Math.sin(t * Math.PI * 2);
      const normalized = (sine + 1) / 2;
      setValue(min + (max - min) * normalized);
    };
    timerRef.current = setInterval(tick, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [min, max, durationMs]);

  return value;
}

export function useStagger<T>(items: T[], staggerMs: number = 50): number[] {
  const [opacities, setOpacities] = useState<number[]>(() => items.map(() => 0));

  useEffect(() => {
    const timeouts: any[] = [];
    items.forEach((_, i) => {
      timeouts.push(setTimeout(() => {
        setOpacities(prev => {
          const next = [...prev];
          next[i] = 1;
          return next;
        });
      }, i * staggerMs));
    });
    return () => timeouts.forEach(clearTimeout);
  }, [items.length, staggerMs]);

  return opacities;
}
