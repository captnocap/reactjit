import { useEffect, useMemo, useRef, useState } from 'react';
const host: any = globalThis as any;
const WINDOW_MS = 5000;

type Sample = { at: number; fps: number };

function nowMs(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  } catch {}
  return Date.now();
}

function computeStats(samples: Sample[]) {
  if (samples.length === 0) return { current: 0, average: 0, min: 0, max: 0 };
  let total = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const sample of samples) {
    total += sample.fps;
    if (sample.fps < min) min = sample.fps;
    if (sample.fps > max) max = sample.fps;
  }
  return {
    current: samples[samples.length - 1].fps,
    average: total / samples.length,
    min,
    max,
  };
}

export function useFpsTracker(enabled: boolean) {
  const [tick, setTick] = useState(0);
  const samplesRef = useRef<Sample[]>([]);
  const lastTimeRef = useRef<number>(nowMs());
  const frameRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      if (frameRef.current != null) {
        const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
        if (cancel) cancel(frameRef.current);
        else clearTimeout(frameRef.current);
        frameRef.current = null;
      }
      samplesRef.current = [];
      lastTimeRef.current = nowMs();
      setTick((v: number) => v + 1);
      return;
    }

    let disposed = false;
    const step = () => {
      if (disposed) return;
      const t = nowMs();
      const dt = Math.max(1, t - lastTimeRef.current);
      lastTimeRef.current = t;
      const fps = 1000 / dt;
      const next = samplesRef.current.concat({ at: t, fps }).filter((sample) => t - sample.at <= WINDOW_MS);
      samplesRef.current = next;
      setTick((v: number) => v + 1);
      const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
      frameRef.current = raf ? raf(step) : setTimeout(step, 16);
    };

    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(step) : setTimeout(step, 16);
    return () => {
      disposed = true;
      if (frameRef.current != null) {
        const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
        if (cancel) cancel(frameRef.current);
        else clearTimeout(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [enabled]);

  const stats = useMemo(() => {
    const latest = samplesRef.current[samplesRef.current.length - 1] || null;
    const computed = computeStats(samplesRef.current);
    return {
      tick,
      enabled,
      time: nowMs() / 1000,
      current: computed.current,
      average: computed.average,
      min: computed.min,
      max: computed.max,
      sampleCount: samplesRef.current.length,
      latestAt: latest ? latest.at : 0,
    };
  }, [enabled, tick]);

  return stats;
}
