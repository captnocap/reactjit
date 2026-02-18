import { useState, useRef, useCallback } from 'react';
import type { TimerConfig, TimerState } from '../types';

export interface TimerStateWithUpdate extends TimerState {
  /** Call each frame with dt to tick the timer */
  update: (dt: number) => void;
}

export function useTimer(duration: number, config: TimerConfig = {}): TimerStateWithUpdate {
  const { loop = false } = config;

  const [, forceRender] = useState(0);
  const elapsedRef = useRef(0);
  const runningRef = useRef(false);
  const readyRef = useRef(true);

  const update = useCallback((dt: number) => {
    if (!runningRef.current) return;

    elapsedRef.current += dt;
    if (elapsedRef.current >= duration) {
      if (loop) {
        elapsedRef.current -= duration;
      } else {
        elapsedRef.current = duration;
        runningRef.current = false;
        readyRef.current = true;
      }
      forceRender(n => n + 1);
    }
  }, [duration, loop]);

  const start = useCallback(() => {
    elapsedRef.current = 0;
    runningRef.current = true;
    readyRef.current = false;
    forceRender(n => n + 1);
  }, []);

  const reset = useCallback(() => {
    elapsedRef.current = 0;
    runningRef.current = false;
    readyRef.current = true;
    forceRender(n => n + 1);
  }, []);

  return {
    ready: readyRef.current,
    elapsed: elapsedRef.current,
    remaining: Math.max(0, duration - elapsedRef.current),
    progress: duration > 0 ? Math.min(1, elapsedRef.current / duration) : 1,
    start,
    reset,
    update,
  };
}
