// Step sequencer — emits pitch CV + gate pulses at tempo.

import type { Module, ParamSpec, PortSpec } from '../types';

export const SEQ_PARAMS: ParamSpec[] = [
  { id: 'bpm',    label: 'BPM',    kind: 'continuous', min: 30,  max: 300, defaultValue: 120, step: 1 },
  { id: 'steps',  label: 'Steps',  kind: 'discrete',   min: 1,   max: 32,  defaultValue: 16, step: 1 },
  { id: 'div',    label: 'Div',    kind: 'choice',     defaultValue: '16',
    choices: [{ value: '4', label: '1/4' }, { value: '8', label: '1/8' }, { value: '16', label: '1/16' }, { value: '32', label: '1/32' }] },
  { id: 'gateLen',label: 'Gate',   kind: 'continuous', min: 0.05,max: 1.0, defaultValue: 0.5 },
  { id: 'swing',  label: 'Swing',  kind: 'continuous', min: 0,   max: 0.5, defaultValue: 0 },
  { id: 'mode',   label: 'Mode',   kind: 'choice',     defaultValue: 'fwd',
    choices: [{ value: 'fwd', label: 'Fwd' }, { value: 'rev', label: 'Rev' }, { value: 'pp', label: 'Ping' }, { value: 'rnd', label: 'Rnd' }] },
];

export const SEQ_PORTS: PortSpec[] = [
  { id: 'clk',  label: 'Clock', direction: 'in',  kind: 'gate' },
  { id: 'rst',  label: 'Reset', direction: 'in',  kind: 'gate' },
  { id: 'cv',   label: 'CV',    direction: 'out', kind: 'cv' },
  { id: 'gate', label: 'Gate',  direction: 'out', kind: 'gate' },
];

export interface SeqStepData { note: number; gate: number; velocity: number; }

export function makeSequencer(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, any> = {};
  SEQ_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  const steps: SeqStepData[] = Array.from({ length: 16 }, () => ({ note: 60, gate: 1, velocity: 0.8 }));
  return {
    id, kind: 'sequencer', label: 'Seq',
    params: SEQ_PARAMS, ports: SEQ_PORTS,
    values, bypass: false,
    state: { steps, index: 0, phase: 0, dir: 1 },
    ...overrides,
  };
}

export interface SeqRuntime { steps: SeqStepData[]; index: number; phase: number; dir: 1 | -1; }

// Advance by dtSec and return a { cv, gate } output + whether the step changed.
export function seqTick(values: Record<string, any>, st: SeqRuntime, dtSec: number): { cv: number; gate: number; stepChanged: boolean } {
  const bpm = values.bpm as number;
  const div = parseInt(values.div as string, 10) || 16;
  const stepsCount = Math.max(1, Math.floor(values.steps as number));
  const mode = values.mode as string;
  const gateLen = values.gateLen as number;
  const swing = values.swing as number;
  const swingAdjust = (st.index % 2 === 1 ? 1 + swing : 1 - swing);
  const stepsPerSec = (bpm / 60) * (div / 4) / swingAdjust;
  st.phase += dtSec * stepsPerSec;
  let changed = false;
  while (st.phase >= 1) {
    st.phase -= 1;
    changed = true;
    if (mode === 'fwd') st.index = (st.index + 1) % stepsCount;
    else if (mode === 'rev') st.index = (st.index - 1 + stepsCount) % stepsCount;
    else if (mode === 'pp') {
      st.index += st.dir;
      if (st.index >= stepsCount - 1) { st.index = stepsCount - 1; st.dir = -1; }
      if (st.index <= 0) { st.index = 0; st.dir = 1; }
    } else { st.index = Math.floor(Math.random() * stepsCount); }
  }
  const step = st.steps[st.index] || { note: 60, gate: 1, velocity: 0.8 };
  const cv = (step.note - 60) / 12;  // semitones → volts (1V/oct)
  const gate = step.gate && st.phase < gateLen ? step.velocity : 0;
  return { cv, gate, stepChanged: changed };
}
