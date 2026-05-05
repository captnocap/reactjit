// Feed-forward peak compressor. Threshold in dB, ratio, attack, release.

import type { Module, ParamSpec, PortSpec } from '../types';

export const COMP_PARAMS: ParamSpec[] = [
  { id: 'threshold', label: 'Thresh',  kind: 'continuous', min: -60, max: 0, defaultValue: -18, unit: 'dB' },
  { id: 'ratio',     label: 'Ratio',   kind: 'continuous', min: 1,   max: 20,defaultValue: 4 },
  { id: 'attack',    label: 'Attack',  kind: 'continuous', min: 0.001,max: 0.2, defaultValue: 0.01, unit: 's', taper: 'log' },
  { id: 'release',   label: 'Release', kind: 'continuous', min: 0.01, max: 2,   defaultValue: 0.15, unit: 's', taper: 'log' },
  { id: 'makeup',    label: 'Makeup',  kind: 'continuous', min: 0,    max: 24,  defaultValue: 0,    unit: 'dB' },
];

export const COMP_PORTS: PortSpec[] = [
  { id: 'in',   label: 'In',    direction: 'in',  kind: 'audio' },
  { id: 'sc',   label: 'SC',    direction: 'in',  kind: 'audio' },
  { id: 'out',  label: 'Out',   direction: 'out', kind: 'audio' },
  { id: 'gr',   label: 'GR',    direction: 'out', kind: 'cv' },
];

export function makeCompressor(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  COMP_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'compressor', label: 'Comp', params: COMP_PARAMS, ports: COMP_PORTS, values, bypass: false, ...overrides };
}

export interface CompState { env: number; }

function dbToLin(db: number) { return Math.pow(10, db / 20); }
function linToDb(x: number)  { return 20 * Math.log10(Math.max(1e-9, Math.abs(x))); }

export function compProcess(values: Record<string, any>, st: CompState, x: number, sc: number, sampleRate: number): { y: number; gr: number } {
  const key = Math.abs(sc || x);
  const aCoef = Math.exp(-1 / (sampleRate * (values.attack as number)));
  const rCoef = Math.exp(-1 / (sampleRate * (values.release as number)));
  const coef = key > st.env ? aCoef : rCoef;
  st.env = coef * st.env + (1 - coef) * key;
  const envDb = linToDb(st.env);
  const over = envDb - (values.threshold as number);
  const reduceDb = over > 0 ? over - over / (values.ratio as number) : 0;
  const gain = dbToLin(-reduceDb + (values.makeup as number));
  return { y: x * gain, gr: -reduceDb };
}
