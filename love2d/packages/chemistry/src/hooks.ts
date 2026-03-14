import { useLuaQuery } from '@reactjit/core';
import type { Element, Molecule, Reaction, EquilibriumState } from './types';

export function useElement(key: number | string): Element | undefined {
  const { data } = useLuaQuery<Element>('chemistry:element', { key }, [key]);
  return data ?? undefined;
}

export function useMolecule(formulaOrName: string): Molecule | null {
  const { data } = useLuaQuery<Molecule>('chemistry:molecule', { formula: formulaOrName }, [formulaOrName]);
  return data;
}

export function useReaction(equation: string): Reaction | null {
  const { data } = useLuaQuery<Reaction>('chemistry:balance', { equation }, [equation]);
  return data;
}

export function useEquilibrium(opts: {
  kEq: number;
  temperature: number;
  pressure?: number;
  deltaH?: number;
  changeTemp?: number;
  changePressure?: number;
}): EquilibriumState | null {
  const { kEq, temperature, pressure, deltaH, changeTemp, changePressure } = opts;
  const { data } = useLuaQuery<EquilibriumState>(
    'chemistry:compute',
    { method: 'equilibrium', kEq, temperature, pressure, deltaH, changeTemp, changePressure },
    [kEq, temperature, pressure, deltaH, changeTemp, changePressure],
  );
  return data;
}

export function usePeriodicTableFilter(filter?: {
  category?: Element['category'];
  phase?: Element['phase'];
  search?: string;
}): { highlighted: number[] } {
  const hasFilter = !!(filter?.category || filter?.phase || filter?.search);
  const { data } = useLuaQuery<Element[]>(
    'chemistry:elements',
    hasFilter ? filter : {},
    [filter?.category, filter?.phase, filter?.search],
  );
  return { highlighted: hasFilter && data ? data.map(e => e.number) : [] };
}
