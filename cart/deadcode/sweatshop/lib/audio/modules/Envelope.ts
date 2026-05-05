// ADSR envelope generator. Triggered by a gate port.

import type { Module, ParamSpec, PortSpec } from '../types';

export const ENV_PARAMS: ParamSpec[] = [
  { id: 'attack',  label: 'A', kind: 'continuous', min: 0.001, max: 5,   defaultValue: 0.01, unit: 's', taper: 'log' },
  { id: 'decay',   label: 'D', kind: 'continuous', min: 0.001, max: 5,   defaultValue: 0.15, unit: 's', taper: 'log' },
  { id: 'sustain', label: 'S', kind: 'continuous', min: 0,     max: 1,   defaultValue: 0.7 },
  { id: 'release', label: 'R', kind: 'continuous', min: 0.001, max: 10,  defaultValue: 0.3,  unit: 's', taper: 'log' },
  { id: 'amount',  label: 'Amt', kind: 'continuous', min: 0,   max: 1,   defaultValue: 1 },
];

export const ENV_PORTS: PortSpec[] = [
  { id: 'gate', label: 'Gate', direction: 'in',  kind: 'gate' },
  { id: 'cv',   label: 'CV',   direction: 'out', kind: 'cv' },
  { id: 'end',  label: 'End',  direction: 'out', kind: 'gate' },
];

export function makeEnvelope(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  ENV_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'envelope', label: 'ENV', params: ENV_PARAMS, ports: ENV_PORTS, values, bypass: false, ...overrides };
}

export type EnvStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
export interface EnvState { stage: EnvStage; level: number; tInStage: number; }

export function envTick(values: Record<string, any>, st: EnvState, gate: boolean, dtSec: number): number {
  const a = values.attack as number;
  const d = values.decay as number;
  const s = values.sustain as number;
  const r = values.release as number;
  const amt = values.amount as number;

  if (gate && st.stage === 'idle')         { st.stage = 'attack';  st.tInStage = 0; }
  if (!gate && st.stage !== 'idle' && st.stage !== 'release') { st.stage = 'release'; st.tInStage = 0; }

  st.tInStage += dtSec;
  switch (st.stage) {
    case 'attack':
      st.level = Math.min(1, st.tInStage / Math.max(0.001, a));
      if (st.level >= 1) { st.stage = 'decay'; st.tInStage = 0; }
      break;
    case 'decay':
      st.level = 1 + (s - 1) * Math.min(1, st.tInStage / Math.max(0.001, d));
      if (st.tInStage >= d) { st.stage = 'sustain'; st.level = s; }
      break;
    case 'sustain':
      st.level = s;
      break;
    case 'release':
      st.level = Math.max(0, st.level - (s / Math.max(0.001, r)) * dtSec);
      if (st.level <= 0) { st.stage = 'idle'; st.level = 0; }
      break;
  }
  return st.level * amt;
}
