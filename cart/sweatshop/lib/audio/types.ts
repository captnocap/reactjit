// Shared audio-rack types. The engine is designed to compile to either
// Web Audio (when the host exposes AudioContext) or a pure-JS stub that
// tracks state without producing sound — modules and params describe the
// shape of a patch either way.

export type ModuleKind =
  | 'vco' | 'vcf' | 'vca' | 'lfo' | 'envelope'
  | 'reverb' | 'delay' | 'compressor' | 'distortion' | 'filter'
  | 'sequencer';

export type ParamKind = 'continuous' | 'discrete' | 'toggle' | 'choice';

export interface ParamSpec {
  id: string;
  label: string;
  kind: ParamKind;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | string | boolean;
  unit?: string;              // 'Hz', 'dB', 's', '%', etc.
  choices?: { value: string; label: string }[];
  taper?: 'linear' | 'log';   // hint for knob/fader curve
}

export interface PortSpec {
  id: string;
  label: string;
  direction: 'in' | 'out';
  kind: 'audio' | 'cv' | 'gate' | 'midi';
}

export interface Module<S = any> {
  id: string;               // instance id (unique within rack)
  kind: ModuleKind;
  label: string;
  params: ParamSpec[];
  ports: PortSpec[];
  values: Record<string, number | string | boolean>;
  bypass: boolean;
  state?: S;                // per-kind internal state (engine-managed)
  x?: number;               // rack position (slot index when reordered)
}

export interface Connection {
  id: string;
  fromModule: string;
  fromPort: string;
  toModule: string;
  toPort: string;
}

export interface RackPatch {
  name: string;
  modules: Module[];
  connections: Connection[];
  masterGain: number;       // 0..1
  sampleRate: number;       // 44100 / 48000
  bufferSize: number;       // 128..4096
  createdAt: number;
}

export const DEFAULT_SAMPLE_RATE = 44100;
export const DEFAULT_BUFFER_SIZE = 512;

export function paramValue<T = number>(m: Module, id: string, fallback?: T): T {
  const v = m.values[id];
  if (v === undefined) {
    const spec = m.params.find((p) => p.id === id);
    return (spec ? spec.defaultValue : (fallback as any)) as T;
  }
  return v as T;
}
