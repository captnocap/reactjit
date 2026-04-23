// Low-frequency oscillator. Produces a [-1..1] CV at the configured shape/rate.

import type { Module, ParamSpec, PortSpec } from '../types';

export const LFO_PARAMS: ParamSpec[] = [
  { id: 'shape', label: 'Shape', kind: 'choice', defaultValue: 'sine',
    choices: [
      { value: 'sine',   label: 'Sine' },
      { value: 'tri',    label: 'Tri' },
      { value: 'saw',    label: 'Saw' },
      { value: 'square', label: 'Sq' },
      { value: 'sh',     label: 'S&H' },
    ] },
  { id: 'rate',  label: 'Rate',  kind: 'continuous', min: 0.01, max: 40, defaultValue: 2, unit: 'Hz', taper: 'log' },
  { id: 'depth', label: 'Depth', kind: 'continuous', min: 0,    max: 1,  defaultValue: 0.5 },
  { id: 'sync',  label: 'Sync',  kind: 'toggle',     defaultValue: false },
];

export const LFO_PORTS: PortSpec[] = [
  { id: 'sync', label: 'Sync',  direction: 'in',  kind: 'gate' },
  { id: 'cv',   label: 'CV',    direction: 'out', kind: 'cv' },
];

export function makeLFO(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  LFO_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'lfo', label: 'LFO', params: LFO_PARAMS, ports: LFO_PORTS, values, bypass: false, ...overrides };
}

export interface LFOState { phase: number; held: number; }

export function lfoTick(values: Record<string, any>, st: LFOState, dtSec: number): number {
  const rate = values.rate as number;
  const depth = values.depth as number;
  st.phase = (st.phase + rate * dtSec) % 1;
  const p = st.phase;
  let v = 0;
  switch (values.shape) {
    case 'sine':   v = Math.sin(p * 2 * Math.PI); break;
    case 'tri':    v = 1 - 4 * Math.abs(((p + 0.75) % 1) - 0.5); break;
    case 'saw':    v = p * 2 - 1; break;
    case 'square': v = p < 0.5 ? 1 : -1; break;
    case 'sh':
      if (p < 0.02) st.held = Math.random() * 2 - 1;
      v = st.held;
      break;
  }
  return v * depth;
}
