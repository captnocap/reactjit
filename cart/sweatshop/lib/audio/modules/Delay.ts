// Digital delay with feedback, tone filter, and sync-to-tempo option.

import type { Module, ParamSpec, PortSpec } from '../types';

export const DELAY_PARAMS: ParamSpec[] = [
  { id: 'time',     label: 'Time',     kind: 'continuous', min: 0.001, max: 2.0, defaultValue: 0.25, unit: 's' },
  { id: 'feedback', label: 'Feedback', kind: 'continuous', min: 0,     max: 0.95,defaultValue: 0.35 },
  { id: 'tone',     label: 'Tone',    kind: 'continuous', min: 0,      max: 1,   defaultValue: 0.6 },
  { id: 'mix',      label: 'Mix',     kind: 'continuous', min: 0,      max: 1,   defaultValue: 0.3 },
  { id: 'sync',     label: 'Sync',    kind: 'toggle',     defaultValue: false },
];

export const DELAY_PORTS: PortSpec[] = [
  { id: 'in',  label: 'In',  direction: 'in',  kind: 'audio' },
  { id: 'out', label: 'Out', direction: 'out', kind: 'audio' },
];

export function makeDelay(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  DELAY_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return { id, kind: 'delay', label: 'Delay', params: DELAY_PARAMS, ports: DELAY_PORTS, values, bypass: false, ...overrides };
}

export interface DelayState { buf: number[]; w: number; lp: number; }

export function delayProcess(values: Record<string, any>, st: DelayState, x: number, sampleRate: number): number {
  const time = values.time as number;
  const fb = values.feedback as number;
  const tone = values.tone as number;
  const mix = values.mix as number;
  const len = st.buf.length;
  const d = Math.max(1, Math.floor(time * sampleRate));
  const rIdx = (st.w - d + len) % len;
  const tap = st.buf[rIdx] || 0;
  // simple 1-pole LP on the feedback path for tone darkening
  st.lp = st.lp * (1 - tone) + tap * tone;
  st.buf[st.w] = x + st.lp * fb;
  st.w = (st.w + 1) % len;
  return x * (1 - mix) + tap * mix;
}
