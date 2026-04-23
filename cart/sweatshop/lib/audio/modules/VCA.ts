// Voltage-controlled amplifier. Gain + CV-scale + pan.

import type { Module, ParamSpec, PortSpec } from '../types';

export const VCA_PARAMS: ParamSpec[] = [
  { id: 'gain',    label: 'Gain',    kind: 'continuous', min: 0,  max: 2, defaultValue: 0.8 },
  { id: 'cvScale', label: 'CV Amt',  kind: 'continuous', min: 0,  max: 1, defaultValue: 1 },
  { id: 'pan',     label: 'Pan',     kind: 'continuous', min: -1, max: 1, defaultValue: 0 },
];

export const VCA_PORTS: PortSpec[] = [
  { id: 'in',   label: 'In',    direction: 'in',  kind: 'audio' },
  { id: 'cv',   label: 'CV',    direction: 'in',  kind: 'cv' },
  { id: 'outL', label: 'Out L', direction: 'out', kind: 'audio' },
  { id: 'outR', label: 'Out R', direction: 'out', kind: 'audio' },
];

export function makeVCA(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  VCA_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'vca', label: 'VCA', params: VCA_PARAMS, ports: VCA_PORTS, values, bypass: false, ...overrides };
}

// Returns [L, R] for a single sample input, cv in [-1..1].
export function vcaProcess(values: Record<string, any>, x: number, cv: number): [number, number] {
  const gain = (values.gain as number) * (1 + ((values.cvScale as number) * cv));
  const y = x * gain;
  const pan = values.pan as number;
  const l = y * Math.cos((pan + 1) * Math.PI / 4);
  const r = y * Math.sin((pan + 1) * Math.PI / 4);
  return [l, r];
}
