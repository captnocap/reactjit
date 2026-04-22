// Voltage-controlled oscillator. Sine / saw / square / triangle + detune.

import type { Module, ParamSpec, PortSpec } from '../types';

export const VCO_PARAMS: ParamSpec[] = [
  { id: 'wave', label: 'Wave', kind: 'choice', defaultValue: 'saw',
    choices: [
      { value: 'sine',     label: 'Sine' },
      { value: 'saw',      label: 'Saw' },
      { value: 'square',   label: 'Square' },
      { value: 'triangle', label: 'Triangle' },
    ] },
  { id: 'freq',   label: 'Freq',   kind: 'continuous', min: 20,    max: 20000, defaultValue: 220, unit: 'Hz', taper: 'log' },
  { id: 'detune', label: 'Detune', kind: 'continuous', min: -1200, max: 1200,  defaultValue: 0,   unit: 'ct' },
  { id: 'pulse',  label: 'Pulse',  kind: 'continuous', min: 0.05,  max: 0.95,  defaultValue: 0.5 },
  { id: 'gain',   label: 'Gain',   kind: 'continuous', min: 0,     max: 1,     defaultValue: 0.6 },
];

export const VCO_PORTS: PortSpec[] = [
  { id: 'cv',  label: 'Pitch CV', direction: 'in',  kind: 'cv' },
  { id: 'gate',label: 'Gate',     direction: 'in',  kind: 'gate' },
  { id: 'out', label: 'Audio',    direction: 'out', kind: 'audio' },
];

export function makeVCO(id: string, overrides?: Partial<Module>): Module {
  const values: Record<string, number | string | boolean> = {};
  VCO_PARAMS.forEach((p) => { values[p.id] = p.defaultValue; });
  return {
    id, kind: 'vco', label: 'VCO',
    params: VCO_PARAMS, ports: VCO_PORTS,
    values, bypass: false,
    ...overrides,
  };
}

// Sample-tick stub — produces a single-sample value from a phase accumulator.
// Engine calls this with its own phase state; no side effects.
export function vcoSample(values: Record<string, any>, phase: number): number {
  const wave = values.wave;
  const gain = (values.gain ?? 0.6) as number;
  let s = 0;
  if (wave === 'sine')          s = Math.sin(phase * 2 * Math.PI);
  else if (wave === 'saw')      s = (phase % 1) * 2 - 1;
  else if (wave === 'square')   s = (phase % 1) < (values.pulse ?? 0.5) ? 1 : -1;
  else                          s = 1 - 4 * Math.abs(((phase + 0.75) % 1) - 0.5);
  return s * gain;
}
