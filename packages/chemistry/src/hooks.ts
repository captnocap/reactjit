import { useState, useMemo, useEffect } from 'react';
import { useLoveRPC } from '@reactjit/core';
import { getElement, ELEMENTS } from './elements';
import type { Element, Molecule, Reaction, EquilibriumState } from './types';

export function useElement(key: number | string): Element | undefined {
  return useMemo(() => getElement(key), [key]);
}

export function useMolecule(formulaOrName: string): Molecule | null {
  const rpc = useLoveRPC<Molecule>('chemistry:molecule');
  const [result, setResult] = useState<Molecule | null>(null);
  useEffect(() => {
    if (!formulaOrName) return;
    rpc({ formula: formulaOrName }).then(setResult).catch(() => {});
  }, [formulaOrName]);
  return result;
}

export function useReaction(equation: string): Reaction | null {
  const rpc = useLoveRPC<Reaction>('chemistry:balance');
  const [result, setResult] = useState<Reaction | null>(null);
  useEffect(() => {
    if (!equation) return;
    rpc({ equation }).then(setResult).catch(() => {});
  }, [equation]);
  return result;
}

export function useEquilibrium(opts: {
  kEq: number;
  temperature: number;
  pressure?: number;
  deltaH?: number;
  changeTemp?: number;
  changePressure?: number;
}): EquilibriumState {
  const { kEq, temperature, pressure = 1, deltaH, changeTemp, changePressure } = opts;
  return useMemo(() => {
    let shift: EquilibriumState['shift'] = 'none';
    let direction: EquilibriumState['direction'] = 'equilibrium';

    if (changeTemp && deltaH) {
      shift = changeTemp > 0
        ? (deltaH > 0 ? 'right' : 'left')
        : (deltaH > 0 ? 'left' : 'right');
    }

    if (changePressure) {
      shift = changePressure > 0 ? 'left' : 'right';
    }

    if (kEq > 1) direction = 'forward';
    else if (kEq < 1) direction = 'reverse';

    return {
      kEq,
      direction,
      shift,
      temperature: temperature + (changeTemp ?? 0),
      pressure: pressure + (changePressure ?? 0),
    };
  }, [kEq, temperature, pressure, deltaH, changeTemp, changePressure]);
}

export function usePeriodicTableFilter(filter?: {
  category?: Element['category'];
  phase?: Element['phase'];
  search?: string;
}): { highlighted: number[] } {
  return useMemo(() => {
    if (!filter) return { highlighted: [] };
    const { category, phase, search } = filter;
    const highlighted: number[] = [];
    for (const el of ELEMENTS) {
      if (category && el.category !== category) continue;
      if (phase && el.phase !== phase) continue;
      if (search) {
        const q = search.toLowerCase();
        if (!el.name.toLowerCase().includes(q) && !el.symbol.toLowerCase().includes(q)) continue;
      }
      highlighted.push(el.number);
    }
    return { highlighted };
  }, [filter?.category, filter?.phase, filter?.search]);
}
