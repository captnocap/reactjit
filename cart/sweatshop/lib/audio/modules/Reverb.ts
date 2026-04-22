// Stereo reverb (schroeder-style stub). Real implementation lives in
// Web Audio's ConvolverNode when engine mode='webaudio'.

import type { Module, ParamSpec, PortSpec } from '../types';

export const REVERB_PARAMS: ParamSpec[] = [
  { id: 'size',    label: 'Size',    kind: 'continuous', min: 0.1,  max: 1.0,  defaultValue: 0.5 },
  { id: 'damping', label: 'Damping', kind: 'continuous', min: 0,    max: 1,    defaultValue: 0.4 },
  { id: 'mix',     label: 'Mix',     kind: 'continuous', min: 0,    max: 1,    defaultValue: 0.25 },
  { id: 'preDelay',label: 'Pre',     kind: 'continuous', min: 0,    max: 0.2,  defaultValue: 0.02, unit: 's' },
];

export const REVERB_PORTS: PortSpec[] = [
  { id: 'inL',  label: 'In L',  direction: 'in',  kind: 'audio' },
  { id: 'inR',  label: 'In R',  direction: 'in',  kind: 'audio' },
  { id: 'outL', label: 'Out L', direction: 'out', kind: 'audio' },
  { id: 'outR', label: 'Out R', direction: 'out', kind: 'audio' },
];

export function makeReverb(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  REVERB_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'reverb', label: 'Reverb', params: REVERB_PARAMS, ports: REVERB_PORTS, values, bypass: false, ...overrides };
}

export interface ReverbState { buf: Float32Array | number[]; w: number; }

export function reverbProcess(values: Record<string, any>, st: ReverbState, x: number): number {
  const size = values.size as number;
  const damp = values.damping as number;
  const mix = values.mix as number;
  const len = st.buf.length;
  const tap = (st.w + Math.floor(len * size)) % len;
  const delayed = (st.buf as any)[tap] * (1 - damp);
  (st.buf as any)[st.w] = x + delayed * 0.6;
  st.w = (st.w + 1) % len;
  return x * (1 - mix) + delayed * mix;
}
