import { useState, useEffect } from 'react';
import { useLoveRPC } from '@reactjit/core';
import type { Element, Molecule, Reaction, EquilibriumState } from './types';

export function useElement(key: number | string): Element | undefined {
  const rpc = useLoveRPC<Element>('chemistry:element');
  const [result, setResult] = useState<Element | undefined>(undefined);
  useEffect(() => {
    if (key === undefined || key === null || key === '') return;
    rpc({ key }).then(setResult).catch(() => {});
  }, [key]);
  return result;
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
}): EquilibriumState | null {
  const compute = useLoveRPC<EquilibriumState>('chemistry:compute');
  const [result, setResult] = useState<EquilibriumState | null>(null);
  const { kEq, temperature, pressure, deltaH, changeTemp, changePressure } = opts;
  useEffect(() => {
    compute({ method: 'equilibrium', kEq, temperature, pressure, deltaH, changeTemp, changePressure })
      .then(setResult).catch(() => {});
  }, [kEq, temperature, pressure, deltaH, changeTemp, changePressure]);
  return result;
}

export function usePeriodicTableFilter(filter?: {
  category?: Element['category'];
  phase?: Element['phase'];
  search?: string;
}): { highlighted: number[] } {
  const rpc = useLoveRPC<Element[]>('chemistry:elements');
  const [highlighted, setHighlighted] = useState<number[]>([]);
  useEffect(() => {
    if (!filter) { setHighlighted([]); return; }
    rpc(filter).then(els => setHighlighted(els.map(e => e.number))).catch(() => {});
  }, [filter?.category, filter?.phase, filter?.search]);
  return { highlighted };
}
