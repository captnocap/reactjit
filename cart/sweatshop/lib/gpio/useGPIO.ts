const React: any = require('react');
const { useState, useCallback, useEffect, useRef } = React;

import { gpioGet, gpioSet } from './exec';
import type { GPIOPinState, GPIODirection } from './types';

export function useGPIO(
  chip: string,
  line: number,
  initialMode: GPIODirection = 'input',
): GPIOPinState & {
  mode: GPIODirection;
  setMode: (m: GPIODirection) => void;
  setValue: (v: boolean) => void;
  toggle: () => void;
  refresh: () => void;
} {
  const [value, setValueState] = useState(false);
  const [mode, setMode] = useState<GPIODirection>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  const refresh = useCallback(() => {
    if (mode !== 'input') return;
    const out = gpioGet(chip, line);
    if (out.includes('command not found') || out.includes('No such file') || out.includes('Error')) {
      // Silent on probe errors
      return;
    }
    const trimmed = out.trim();
    if (trimmed === '1') setValueState(true);
    else if (trimmed === '0') setValueState(false);
  }, [chip, line, mode]);

  const setValue = useCallback((v: boolean) => {
    if (mode !== 'output') {
      setError(`Cannot set value on pin ${line}: currently in ${mode} mode`);
      return;
    }
    const out = gpioSet(chip, line, v);
    if (out.includes('Error') || out.includes('Permission denied')) {
      setError(`gpioSet failed: ${out.trim() || 'unknown error'}`);
      return;
    }
    setValueState(v);
    setError(null);
  }, [chip, line, mode]);

  const toggle = useCallback(() => {
    setValue(!value);
  }, [value, setValue]);

  // Poll input pins
  useEffect(() => {
    if (mode === 'input') {
      refresh();
      pollRef.current = setInterval(refresh, 500);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [mode, refresh]);

  return { value, error, mode, setMode, setValue, toggle, refresh };
}
