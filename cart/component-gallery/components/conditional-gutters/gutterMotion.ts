import { useEffect, useRef, useState } from 'react';
import { easeInOutCubic } from '@reactjit/runtime/easing';

export type GutterEdge = 'left' | 'right' | 'top' | 'bottom';

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function nowMs(value?: number): number {
  return typeof value === 'number' ? value : Date.now();
}

export function useEasedGate(open: boolean, durationMs = 240): number {
  const [value, setValue] = useState(() => (open ? 1 : 0));
  const valueRef = useRef(open ? 1 : 0);
  const frameRef = useRef<any>(null);

  useEffect(() => {
    const target = open ? 1 : 0;
    const from = valueRef.current;
    const distance = target - from;
    const duration = Math.max(1, durationMs);
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;

    if (Math.abs(distance) < 0.001) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    let startedAt = 0;
    const tick = (timestamp?: number) => {
      const t = nowMs(timestamp);
      if (startedAt === 0) startedAt = t;
      const raw = clamp01((t - startedAt) / duration);
      const eased = easeInOutCubic(raw);
      const next = from + distance * eased;
      valueRef.current = next;
      setValue(next);

      if (raw < 1) {
        frameRef.current = raf(tick);
      } else {
        valueRef.current = target;
        setValue(target);
        frameRef.current = null;
      }
    };

    frameRef.current = raf(tick);
    return () => {
      if (frameRef.current != null) {
        try { caf(frameRef.current); } catch (_) {}
        frameRef.current = null;
      }
    };
  }, [open, durationMs]);

  return open ? Math.max(value, 0.001) : value;
}

