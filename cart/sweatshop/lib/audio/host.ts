// Typed wrapper over the real audio host FFI — same surface used by
// cart/pocket_operator.tsx. Call these instead of treating audio as JS state.
//
// The host exposes __audio_* as globalThis functions. When they're missing
// (no audio backend at runtime) every call no-ops and ready()=false.

const host: any = globalThis as any;

export const MODULE = {
  mixer:  3,
  delay:  4,
  pocket: 10,
} as const;

export const PO_PARAM = {
  voice: 0,
  tone:  1,
  decay: 2,
  color: 3,
  drive: 4,
  gain:  5,
} as const;

export const DELAY_PARAM = {
  time:     0,
  feedback: 1,
  mix:      2,
} as const;

export const MIXER_PARAM_CHANNEL = (channel: number) => channel; // channel N = param N on mixer

export type ModuleKind = typeof MODULE[keyof typeof MODULE];

function callNum(name: string, ...args: number[]): number {
  const fn = host[name];
  return typeof fn === 'function' ? Number(fn(...args) ?? 0) : 0;
}
function callVoid(name: string, ...args: number[]): void {
  const fn = host[name];
  if (typeof fn === 'function') fn(...args);
}
function has(name: string): boolean { return typeof host[name] === 'function'; }

export function audioBackendPresent(): boolean {
  return has('__audio_init') || has('__audio_is_initialized');
}

export function audioInit(): boolean {
  if (!audioBackendPresent()) return false;
  const ok = callNum('__audio_init') > 0 || callNum('__audio_is_initialized') > 0;
  return ok;
}

export function audioDeinit(): void { callVoid('__audio_deinit'); }
export function audioResume(): void { callVoid('__audio_resume'); }

export function addModule(moduleId: number, kind: ModuleKind): void {
  callNum('__audio_add_module', moduleId, kind);
}
export function removeModule(moduleId: number): void {
  callNum('__audio_remove_module', moduleId);
}
export function connectPort(srcId: number, srcPort: number, dstId: number, dstPort: number): void {
  callNum('__audio_connect', srcId, srcPort, dstId, dstPort);
}
export function setParam(moduleId: number, paramId: number, value: number): void {
  callNum('__audio_set_param', moduleId, paramId, value);
}
export function setMasterGain(value: number): void {
  callNum('__audio_set_master_gain', value);
}
export function noteOn(moduleId: number, midiNote: number, velocity?: number): void {
  if (typeof velocity === 'number') callNum('__audio_note_on', moduleId, midiNote, velocity);
  else callNum('__audio_note_on', moduleId, midiNote);
}
export function noteOff(moduleId: number, midiNote: number): void {
  callNum('__audio_note_off', moduleId, midiNote);
}

export interface AudioTelemetry { peak: number; callbackUs: number; }
export function getTelemetry(): AudioTelemetry {
  return { peak: callNum('__audio_get_peak_level'), callbackUs: callNum('__audio_get_callback_us') };
}

// Human-readable labels for the module kinds the backend actually knows about.
// Anything not in this map is UI-scheduler / not-yet-in-backend.
export const MODULE_LABEL: Record<number, string> = {
  [MODULE.mixer]:  'Mixer',
  [MODULE.delay]:  'Delay',
  [MODULE.pocket]: 'Pocket Voice',
};
