import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import type { GameLoopConfig, GameLoopState } from '../types';

export interface GameLoopContextValue {
  dt: number;
  tick: number;
  paused: boolean;
  timeScale: number;
}

export const GameLoopContext = createContext<GameLoopContextValue>({
  dt: 0, tick: 0, paused: false, timeScale: 1,
});

export function useGameLoopContext(): GameLoopContextValue {
  return useContext(GameLoopContext);
}

const updateCallbacks = new Set<(dt: number) => void>();

export function useGameLoop(config: GameLoopConfig = {}): GameLoopState {
  const { fixedStep = 1 / 60, maxSteps = 4, timeScale: initialTimeScale = 1 } = config;

  const [state, setState] = useState({
    dt: 0, tick: 0, fps: 60, paused: false, timeScale: initialTimeScale,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(0);
  const fpsFramesRef = useRef<number[]>([]);
  const tickRef = useRef(0);

  const pause = useCallback(() => {
    setState(s => { const n = { ...s, paused: true }; stateRef.current = n; return n; });
  }, []);

  const resume = useCallback(() => {
    setState(s => { const n = { ...s, paused: false }; stateRef.current = n; return n; });
    lastTimeRef.current = performance.now();
  }, []);

  const setTimeScale = useCallback((scale: number) => {
    setState(s => { const n = { ...s, timeScale: scale }; stateRef.current = n; return n; });
  }, []);

  useEffect(() => {
    lastTimeRef.current = performance.now();

    const intervalId = setInterval(() => {
      const s = stateRef.current;
      if (s.paused) return;

      const now = performance.now();
      const rawDt = Math.min((now - lastTimeRef.current) / 1000, 0.25);
      lastTimeRef.current = now;

      const scaledDt = rawDt * s.timeScale;
      accumulatorRef.current += scaledDt;

      let steps = 0;
      while (accumulatorRef.current >= fixedStep && steps < maxSteps) {
        for (const cb of updateCallbacks) cb(fixedStep);
        accumulatorRef.current -= fixedStep;
        steps++;
      }
      if (steps >= maxSteps) accumulatorRef.current = 0;

      tickRef.current++;

      // Rolling FPS
      fpsFramesRef.current.push(now);
      const cutoff = now - 1000;
      while (fpsFramesRef.current.length > 0 && fpsFramesRef.current[0] < cutoff) {
        fpsFramesRef.current.shift();
      }

      setState(prev => ({
        ...prev,
        dt: scaledDt,
        tick: tickRef.current,
        fps: fpsFramesRef.current.length,
      }));
    }, fixedStep * 1000);

    return () => clearInterval(intervalId);
  }, [fixedStep, maxSteps]);

  return {
    ...state,
    pause,
    resume,
    setTimeScale,
  };
}

/** Register a callback to run every fixed-step update */
useGameLoop.onUpdate = function onUpdate(callback: (dt: number) => void) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    updateCallbacks.add(callback);
    return () => { updateCallbacks.delete(callback); };
  }, [callback]);
};
