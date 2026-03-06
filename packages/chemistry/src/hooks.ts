import { useState, useMemo } from 'react';
import { getElement } from './elements';
import { buildMolecule } from './molecules';
import { balanceEquation, getEnthalpy } from './reactions';
import type { Element, Molecule, Reaction, EquilibriumState } from './types';

export function useElement(key: number | string): Element | undefined {
  return useMemo(() => getElement(key), [key]);
}

export function useMolecule(formulaOrName: string): Molecule {
  return useMemo(() => buildMolecule(formulaOrName), [formulaOrName]);
}

export function useReaction(equation: string): Reaction {
  return useMemo(() => {
    const reaction = balanceEquation(equation);
    const enthalpy = getEnthalpy(reaction.balanced);
    if (enthalpy !== undefined) reaction.enthalpy = enthalpy;
    return reaction;
  }, [equation]);
}

export function useEquilibrium(opts: {
  kEq: number;
  temperature: number;
  pressure?: number;
  deltaH?: number;
  changeTemp?: number;
  changePressure?: number;
}): EquilibriumState {
  return useMemo(() => {
    const { kEq, temperature, pressure = 1, deltaH, changeTemp, changePressure } = opts;

    let shift: EquilibriumState['shift'] = 'none';
    let direction: EquilibriumState['direction'] = 'equilibrium';

    // Le Chatelier's principle
    if (changeTemp && deltaH) {
      if (changeTemp > 0) {
        // Increase temp: shift toward endothermic direction
        shift = deltaH > 0 ? 'right' : 'left';
      } else {
        shift = deltaH > 0 ? 'left' : 'right';
      }
    }

    if (changePressure) {
      // Increase pressure: shift toward fewer moles of gas
      if (changePressure > 0) shift = 'left'; // simplified
      else shift = 'right';
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
  }, [opts.kEq, opts.temperature, opts.pressure, opts.deltaH, opts.changeTemp, opts.changePressure]);
}

export function usePeriodicTableFilter(filter?: {
  category?: Element['category'];
  phase?: Element['phase'];
  search?: string;
}): { highlighted: number[] } {
  return useMemo(() => {
    if (!filter) return { highlighted: [] };
    const { category, phase, search } = filter;
    const { ELEMENTS } = require('./elements');
    const highlighted: number[] = [];

    for (const el of ELEMENTS as Element[]) {
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
