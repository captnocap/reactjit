import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react';

const ChartAnimationDisabledContext = createContext(false);

export function ChartAnimationProvider({ disabled, children }: { disabled?: boolean; children: any }) {
  return createElement(ChartAnimationDisabledContext.Provider, { value: !!disabled }, children);
}

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
  clamp?: boolean;
}

function step(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  mass: number,
  dt: number
): { value: number; velocity: number; settled: boolean } {
  const disp = value - target;
  const accel = (-stiffness * disp - damping * velocity) / mass;
  let v = velocity + accel * dt;
  let x = value + v * dt;
  const settled = Math.abs(v) < 0.01 && Math.abs(x - target) < 0.01;
  if (settled) return { value: target, velocity: 0, settled: true };
  return { value: x, velocity: v, settled: false };
}

export function useSpring(target: number, cfg?: SpringConfig): number {
  const animationsDisabled = useContext(ChartAnimationDisabledContext);
  const k = cfg?.stiffness ?? 170;
  const c = cfg?.damping ?? 26;
  const m = cfg?.mass ?? 1;
  const [value, setValue] = useState(() => animationsDisabled ? target : 0);
  const targetRef = useRef(target);
  const valueRef = useRef(animationsDisabled ? target : 0);
  const velocityRef = useRef(0);
  const rafRef = useRef<any>(null);
  targetRef.current = target;

  useEffect(() => {
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    let last = 0;

    if (animationsDisabled) {
      if (rafRef.current != null) {
        try { caf(rafRef.current); } catch (_) {}
        rafRef.current = null;
      }
      const shouldSync = valueRef.current !== target;
      valueRef.current = target;
      velocityRef.current = 0;
      if (shouldSync) setValue(target);
      return;
    }

    const tick = (now: number) => {
      const t = typeof now === 'number' ? now : Date.now();
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      const s = step(valueRef.current, velocityRef.current, targetRef.current, k, c, m, dt);
      valueRef.current = s.value;
      velocityRef.current = s.velocity;
      setValue(s.value);
      if (!s.settled) rafRef.current = raf(tick);
      else rafRef.current = null;
    };

    if (rafRef.current == null) rafRef.current = raf(tick);
    return () => {
      if (rafRef.current != null) { try { caf(rafRef.current); } catch (_) {} rafRef.current = null; }
    };
  }, [target, k, c, m, animationsDisabled]);

  return animationsDisabled ? target : value;
}
