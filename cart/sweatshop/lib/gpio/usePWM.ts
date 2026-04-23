const React: any = require('react');
const { useState, useCallback, useEffect, useRef } = React;

import { gpioSet } from './exec';
import type { PWMPinState } from './types';

/**
 * Software PWM via gpioset + setInterval.
 * Each toggle spawns a short-lived gpioset process (timeout 0.1).
 * This is suitable for LED dimming and slow indicators, not motor control.
 */
export function usePWM(
  chip: string,
  line: number,
): PWMPinState & {
  setDuty: (d: number) => void;
  setFrequency: (f: number) => void;
  setEnabled: (e: boolean) => void;
} {
  const [duty, setDutyState] = useState(0);
  const [frequency, setFrequencyState] = useState(1000);
  const [enabled, setEnabledState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<any>(null);
  const phaseRef = useRef(0);

  const tick = useCallback(() => {
    if (!enabled) return;
    const periodMs = 1000 / (frequency || 1);
    const stepMs = 50; // 20 Hz update rate max
    phaseRef.current += stepMs;
    if (phaseRef.current >= periodMs) phaseRef.current = 0;

    const target = phaseRef.current < duty * periodMs ? 1 : 0;
    const out = gpioSet(chip, line, target === 1);
    if (out.includes('Permission denied') || out.includes('Error')) {
      setError(`PWM gpioset failed on ${chip} line ${line}`);
    }
  }, [chip, line, duty, frequency, enabled]);

  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(tick, 50);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Leave pin low on stop
        gpioSet(chip, line, false);
      };
    }
  }, [enabled, tick, chip, line]);

  const setDuty = useCallback((d: number) => {
    setDutyState(Math.max(0, Math.min(1, d)));
  }, []);

  const setFrequency = useCallback((f: number) => {
    setFrequencyState(Math.max(1, Math.min(10000, f)));
  }, []);

  const setEnabled = useCallback((e: boolean) => {
    setEnabledState(e);
    if (!e) {
      phaseRef.current = 0;
      gpioSet(chip, line, false);
    }
  }, [chip, line]);

  return { duty, frequency, enabled, error, setDuty, setFrequency, setEnabled };
}
