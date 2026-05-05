// Voltage-controlled filter. LP / HP / BP with cutoff + resonance + drive.

import type { Module, ParamSpec, PortSpec } from '../types';

export const VCF_PARAMS: ParamSpec[] = [
  { id: 'type',   label: 'Type',   kind: 'choice', defaultValue: 'lp',
    choices: [{ value: 'lp', label: 'Low' }, { value: 'hp', label: 'High' }, { value: 'bp', label: 'Band' }] },
  { id: 'cutoff', label: 'Cutoff', kind: 'continuous', min: 20, max: 20000, defaultValue: 1200, unit: 'Hz', taper: 'log' },
  { id: 'res',    label: 'Res',    kind: 'continuous', min: 0,  max: 1,     defaultValue: 0.2 },
  { id: 'drive',  label: 'Drive',  kind: 'continuous', min: 1,  max: 4,     defaultValue: 1 },
];

export const VCF_PORTS: PortSpec[] = [
  { id: 'in',     label: 'In',    direction: 'in',  kind: 'audio' },
  { id: 'cutCV',  label: 'Cut CV',direction: 'in',  kind: 'cv' },
  { id: 'out',    label: 'Out',   direction: 'out', kind: 'audio' },
];

export function makeVCF(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  VCF_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'vcf', label: 'VCF', params: VCF_PARAMS, ports: VCF_PORTS, values, bypass: false, ...overrides };
}

// 1-pole biquad sketch for the pure-JS stub. Engine calls with persistent state.
export interface VCFState { z1: number; z2: number; }

export function vcfProcess(values: Record<string, any>, st: VCFState, x: number, sampleRate: number): number {
  const type = values.type as string;
  const cutoff = Math.max(20, Math.min(20000, values.cutoff as number));
  const res = Math.max(0, Math.min(1, values.res as number));
  const drive = (values.drive as number) ?? 1;
  const w = 2 * Math.PI * cutoff / sampleRate;
  const a = Math.exp(-w);
  const d = drive * x;
  let y = 0;
  if (type === 'lp')      y = st.z1 = st.z1 * a + (1 - a) * d;
  else if (type === 'hp') y = d - (st.z1 = st.z1 * a + (1 - a) * d);
  else { st.z1 = st.z1 * a + (1 - a) * d; y = d - st.z1; }
  // crude resonance — feedback
  y += (st.z2 * res * 0.95) - (y * res * 0.05);
  st.z2 = y;
  return Math.max(-1, Math.min(1, y));
}
