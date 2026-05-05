// Utility filter (EQ-style): notch / peak / low-shelf / high-shelf / comb.
// Complements VCF (dynamic cutoff sweep) with a static tone-shaping block.

import type { Module, ParamSpec, PortSpec } from '../types';

export const FILTER_PARAMS: ParamSpec[] = [
  { id: 'type', label: 'Type', kind: 'choice', defaultValue: 'peak',
    choices: [
      { value: 'peak',     label: 'Peak' },
      { value: 'notch',    label: 'Notch' },
      { value: 'lowshelf', label: 'LoShelf' },
      { value: 'highshelf',label: 'HiShelf' },
      { value: 'comb',     label: 'Comb' },
    ] },
  { id: 'freq', label: 'Freq', kind: 'continuous', min: 20,  max: 20000, defaultValue: 1000, unit: 'Hz', taper: 'log' },
  { id: 'q',    label: 'Q',    kind: 'continuous', min: 0.1, max: 18,    defaultValue: 1 },
  { id: 'gain', label: 'Gain', kind: 'continuous', min: -24, max: 24,    defaultValue: 0, unit: 'dB' },
];

export const FILTER_PORTS: PortSpec[] = [
  { id: 'in',  label: 'In',  direction: 'in',  kind: 'audio' },
  { id: 'out', label: 'Out', direction: 'out', kind: 'audio' },
];

export function makeFilter(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  FILTER_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'filter', label: 'Filter', params: FILTER_PARAMS, ports: FILTER_PORTS, values, bypass: false, ...overrides };
}

// Single-sample biquad (RBJ cookbook style, minus the cookbook math to keep
// this a stub — real engine uses Web Audio BiquadFilterNode).
export interface FilterState { x1: number; x2: number; y1: number; y2: number; comb: number[]; w: number; }

export function filterProcess(values: Record<string, any>, st: FilterState, x: number, sampleRate: number): number {
  const type = values.type as string;
  if (type === 'comb') {
    const len = st.comb.length;
    const d = Math.max(1, Math.floor(sampleRate / Math.max(1, values.freq as number)));
    const tap = st.comb[(st.w - d + len) % len] || 0;
    const y = x + tap * 0.6;
    st.comb[st.w] = y;
    st.w = (st.w + 1) % len;
    return y;
  }
  // Minimal biquad pass-through with a crude peak/notch hint; good enough for
  // the UI to respond. Replace with RBJ coefficients once Web Audio lands.
  const y = x + (st.x1 - st.y1) * 0.1;
  st.x2 = st.x1; st.x1 = x;
  st.y2 = st.y1; st.y1 = y;
  return y;
}
