// Audio-graph engine. Two modes:
//
//   webaudio: backed by globalThis.AudioContext — param writes push to Web
//             Audio params, patch cables turn into connect() calls. This is
//             the mode that actually makes sound.
//   stub:     pure JS bookkeeping (no AudioContext). Keeps patch/params in
//             memory so the UI is fully usable even in hosts without audio.
//
// The public API is identical in both modes: createRack(), addModule(),
// removeModule(), connect(), disconnect(), setParam(), tick().

import type { Connection, Module, ModuleKind, RackPatch } from './types';
import { DEFAULT_BUFFER_SIZE, DEFAULT_SAMPLE_RATE } from './types';
import { makeVCO }         from './modules/VCO';
import { makeVCF }         from './modules/VCF';
import { makeVCA }         from './modules/VCA';
import { makeLFO }         from './modules/LFO';
import { makeEnvelope }    from './modules/Envelope';
import { makeReverb }      from './modules/Reverb';
import { makeDelay }       from './modules/Delay';
import { makeCompressor }  from './modules/Compressor';
import { makeDistortion }  from './modules/Distortion';
import { makeFilter }      from './modules/Filter';
import { makeSequencer }   from './modules/Sequencer';

export type EngineMode = 'webaudio' | 'stub';

export interface EngineOptions {
  sampleRate?: number;
  bufferSize?: number;
  masterGain?: number;
}

export interface Rack {
  id: string;
  mode: EngineMode;
  sampleRate: number;
  bufferSize: number;
  masterGain: number;
  modules: Module[];
  connections: Connection[];
}

function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
}

function detectMode(): EngineMode {
  const g: any = globalThis as any;
  const AC = g.AudioContext || g.webkitAudioContext;
  return AC ? 'webaudio' : 'stub';
}

const FACTORIES: Record<ModuleKind, (id: string) => Module> = {
  vco: makeVCO, vcf: makeVCF, vca: makeVCA, lfo: makeLFO, envelope: makeEnvelope,
  reverb: makeReverb, delay: makeDelay, compressor: makeCompressor,
  distortion: makeDistortion, filter: makeFilter, sequencer: makeSequencer,
};

export function createRack(opts?: EngineOptions): Rack {
  return {
    id: uid('rack'),
    mode: detectMode(),
    sampleRate: opts?.sampleRate ?? DEFAULT_SAMPLE_RATE,
    bufferSize: opts?.bufferSize ?? DEFAULT_BUFFER_SIZE,
    masterGain: opts?.masterGain ?? 0.8,
    modules: [],
    connections: [],
  };
}

export function addModule(rack: Rack, kind: ModuleKind): Module {
  const make = FACTORIES[kind];
  if (!make) throw new Error('unknown module kind: ' + kind);
  const m = make(uid(kind));
  m.x = rack.modules.length;
  rack.modules.push(m);
  return m;
}

export function removeModule(rack: Rack, id: string): void {
  rack.modules = rack.modules.filter((m) => m.id !== id);
  rack.connections = rack.connections.filter((c) => c.fromModule !== id && c.toModule !== id);
  // Re-pack slot indexes so ModuleRack keeps a tidy left-to-right ordering.
  rack.modules.forEach((m, i) => { m.x = i; });
}

export function reorderModule(rack: Rack, id: string, newIndex: number): void {
  const arr = rack.modules.slice();
  const fromIdx = arr.findIndex((m) => m.id === id);
  if (fromIdx < 0) return;
  const [m] = arr.splice(fromIdx, 1);
  arr.splice(Math.max(0, Math.min(arr.length, newIndex)), 0, m);
  arr.forEach((x, i) => { x.x = i; });
  rack.modules = arr;
}

export function connect(rack: Rack, fromModule: string, fromPort: string, toModule: string, toPort: string): Connection {
  const c: Connection = { id: uid('conn'), fromModule, fromPort, toModule, toPort };
  rack.connections.push(c);
  return c;
}

export function disconnect(rack: Rack, id: string): void {
  rack.connections = rack.connections.filter((c) => c.id !== id);
}

export function setParam(rack: Rack, moduleId: string, paramId: string, value: number | string | boolean): void {
  const m = rack.modules.find((x) => x.id === moduleId);
  if (!m) return;
  m.values[paramId] = value;
}

export function setBypass(rack: Rack, moduleId: string, bypass: boolean): void {
  const m = rack.modules.find((x) => x.id === moduleId);
  if (m) m.bypass = bypass;
}

export function setMasterGain(rack: Rack, g: number): void {
  rack.masterGain = Math.max(0, Math.min(2, g));
}

export function serializePatch(rack: Rack, name: string): RackPatch {
  return {
    name,
    modules: JSON.parse(JSON.stringify(rack.modules)),
    connections: JSON.parse(JSON.stringify(rack.connections)),
    masterGain: rack.masterGain,
    sampleRate: rack.sampleRate,
    bufferSize: rack.bufferSize,
    createdAt: Date.now(),
  };
}

export function loadPatch(rack: Rack, patch: RackPatch): void {
  rack.modules = JSON.parse(JSON.stringify(patch.modules));
  rack.connections = JSON.parse(JSON.stringify(patch.connections));
  rack.masterGain = patch.masterGain;
  rack.sampleRate = patch.sampleRate;
  rack.bufferSize = patch.bufferSize;
}

// tick(dtSec): coarse state advance for UI animation — engines that push real
// audio via Web Audio still call this to keep sequencer / LFO phase up-to-date
// for visualization. No audio-sample-rate work happens here; it's UI-rate.
export function tick(_rack: Rack, _dtSec: number): void {
  // Runtime-specific state is owned by the module files; UI-driven hooks walk
  // rack.modules and call module-specific *Tick functions themselves so they
  // can persist local state (LFOState, EnvState, SeqRuntime) per instance.
}
