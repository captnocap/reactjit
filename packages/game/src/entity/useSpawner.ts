import { useRef, useCallback, useState } from 'react';
import type { SpawnerConfig, EntityState } from '../types';
import type { EntityPool } from './useEntityPool';

export interface SpawnerState {
  /** Start the wave sequence */
  start: () => void;
  /** Update spawner each frame */
  update: (dt: number) => void;
  /** Current wave index */
  currentWave: number;
  /** Whether all waves are complete */
  complete: boolean;
  /** Whether the spawner is running */
  running: boolean;
  /** Reset to beginning */
  reset: () => void;
}

export function useSpawner(pool: EntityPool, config: SpawnerConfig): SpawnerState {
  const { waves, spawnPoints, onWaveComplete, onAllComplete } = config;

  const [, forceRender] = useState(0);
  const waveIndexRef = useRef(0);
  const spawnedInWaveRef = useRef(0);
  const waveTimerRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const runningRef = useRef(false);
  const completeRef = useRef(false);
  const waveStartedRef = useRef(false);

  const start = useCallback(() => {
    waveIndexRef.current = 0;
    spawnedInWaveRef.current = 0;
    waveTimerRef.current = 0;
    spawnTimerRef.current = 0;
    runningRef.current = true;
    completeRef.current = false;
    waveStartedRef.current = false;
    forceRender(n => n + 1);
  }, []);

  const reset = useCallback(() => {
    waveIndexRef.current = 0;
    spawnedInWaveRef.current = 0;
    waveTimerRef.current = 0;
    spawnTimerRef.current = 0;
    runningRef.current = false;
    completeRef.current = false;
    waveStartedRef.current = false;
    forceRender(n => n + 1);
  }, []);

  const update = useCallback((dt: number) => {
    if (!runningRef.current || completeRef.current) return;

    const wave = waves[waveIndexRef.current];
    if (!wave) {
      completeRef.current = true;
      runningRef.current = false;
      onAllComplete?.();
      forceRender(n => n + 1);
      return;
    }

    // Wait for wave delay before starting
    if (!waveStartedRef.current) {
      waveTimerRef.current += dt;
      if (waveTimerRef.current < (wave.delay ?? 0)) return;
      waveStartedRef.current = true;
      spawnTimerRef.current = wave.interval ?? 0; // Spawn first immediately
    }

    // Spawn entities at interval
    spawnTimerRef.current += dt;
    const interval = wave.interval ?? 0.5;

    while (spawnTimerRef.current >= interval && spawnedInWaveRef.current < wave.count) {
      spawnTimerRef.current -= interval;
      spawnedInWaveRef.current++;

      // Pick a spawn point
      const point = spawnPoints
        ? spawnPoints[Math.floor(Math.random() * spawnPoints.length)]
        : { x: 0, y: 0 };

      const { count: _count, delay: _delay, interval: _interval, ...entityProps } = wave;
      pool.spawn({
        x: point.x,
        y: point.y,
        ...entityProps,
      });
    }

    // Check if wave is complete
    if (spawnedInWaveRef.current >= wave.count) {
      onWaveComplete?.(waveIndexRef.current);
      waveIndexRef.current++;
      spawnedInWaveRef.current = 0;
      waveTimerRef.current = 0;
      spawnTimerRef.current = 0;
      waveStartedRef.current = false;

      if (waveIndexRef.current >= waves.length) {
        completeRef.current = true;
        runningRef.current = false;
        onAllComplete?.();
      }
      forceRender(n => n + 1);
    }
  }, [waves, spawnPoints, pool, onWaveComplete, onAllComplete]);

  return {
    start,
    update,
    currentWave: waveIndexRef.current,
    complete: completeRef.current,
    running: runningRef.current,
    reset,
  };
}
