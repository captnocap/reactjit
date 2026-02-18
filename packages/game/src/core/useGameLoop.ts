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

  // Only paused/timeScale are React state — changing these needs a re-render.
  // dt/tick/fps are refs: they change every frame and must NOT trigger renders.
  const [pausedState, setPausedState] = useState(false);
  const [timeScaleState, setTimeScaleState] = useState(initialTimeScale);

  const dtRef = useRef(0);
  const tickRef = useRef(0);
  const fpsRef = useRef(60);

  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(0);
  const fpsFramesRef = useRef<number[]>([]);

  // Stable ref for paused so interval callback sees current value without recreating
  const pausedRef = useRef(pausedState);
  pausedRef.current = pausedState;
  const timeScaleRef = useRef(timeScaleState);
  timeScaleRef.current = timeScaleState;

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPausedState(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPausedState(false);
    lastTimeRef.current = performance.now();
  }, []);

  const setTimeScale = useCallback((scale: number) => {
    timeScaleRef.current = scale;
    setTimeScaleState(scale);
  }, []);

  useEffect(() => {
    lastTimeRef.current = performance.now();

    const intervalId = setInterval(() => {
      if (pausedRef.current) return;

      const now = performance.now();
      const rawDt = Math.min((now - lastTimeRef.current) / 1000, 0.25);
      lastTimeRef.current = now;

      const scaledDt = rawDt * timeScaleRef.current;
      accumulatorRef.current += scaledDt;

      let steps = 0;
      while (accumulatorRef.current >= fixedStep && steps < maxSteps) {
        for (const cb of updateCallbacks) cb(fixedStep);
        accumulatorRef.current -= fixedStep;
        steps++;
      }
      if (steps >= maxSteps) accumulatorRef.current = 0;

      tickRef.current++;
      dtRef.current = scaledDt;

      // Rolling FPS
      fpsFramesRef.current.push(now);
      const cutoff = now - 1000;
      while (fpsFramesRef.current.length > 0 && fpsFramesRef.current[0] < cutoff) {
        fpsFramesRef.current.shift();
      }
      fpsRef.current = fpsFramesRef.current.length;

      // No setState here — dt/tick/fps do not need to trigger re-renders
    }, fixedStep * 1000);

    return () => clearInterval(intervalId);
  }, [fixedStep, maxSteps]);

  return {
    dt: dtRef.current,
    tick: tickRef.current,
    fps: fpsRef.current,
    paused: pausedState,
    timeScale: timeScaleState,
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
