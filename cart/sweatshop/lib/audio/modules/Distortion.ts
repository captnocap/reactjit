// Waveshaping distortion — tanh soft clip + bit-crush + mix.

import type { Module, ParamSpec, PortSpec } from '../types';

export const DIST_PARAMS: ParamSpec[] = [
  { id: 'shape', label: 'Shape', kind: 'choice', defaultValue: 'tanh',
    choices: [
      { value: 'tanh',    label: 'Tanh' },
      { value: 'fold',    label: 'Fold' },
      { value: 'crush',   label: 'Crush' },
      { value: 'foldback',label: 'Foldback' },
    ] },
  { id: 'drive',label: 'Drive', kind: 'continuous', min: 1,   max: 20, defaultValue: 2 },
  { id: 'bias', label: 'Bias',  kind: 'continuous', min: -1,  max: 1,  defaultValue: 0 },
  { id: 'bits', label: 'Bits',  kind: 'continuous', min: 2,   max: 16, defaultValue: 12, step: 1 },
  { id: 'mix',  label: 'Mix',   kind: 'continuous', min: 0,   max: 1,  defaultValue: 1 },
];

export const DIST_PORTS: PortSpec[] = [
  { id: 'in',  label: 'In',  direction: 'in',  kind: 'audio' },
  { id: 'out', label: 'Out', direction: 'out', kind: 'audio' },
];

export function makeDistortion(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  DIST_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'distortion', label: 'Dist', params: DIST_PARAMS, ports: DIST_PORTS, values, bypass: false, ...overrides };
}

export function distProcess(values: Record<string, any>, x: number): number {
  const drive = values.drive as number;
  const bias = values.bias as number;
  const shape = values.shape as string;
  const mix = values.mix as number;
  const bits = Math.max(2, Math.floor(values.bits as number));
  const d = drive * x + bias;
  let y = d;
  if (shape === 'tanh')       y = Math.tanh(d);
  else if (shape === 'fold')  y = Math.sin(d);
  else if (shape === 'crush') { const steps = Math.pow(2, bits); y = Math.round(d * steps) / steps; }
  else {
    // foldback
    let v = d;
    while (v > 1 || v < -1) { if (v > 1) v = 2 - v; else v = -2 - v; }
    y = v;
  }
  y = Math.max(-1, Math.min(1, y));
  return x * (1 - mix) + y * mix;
}
