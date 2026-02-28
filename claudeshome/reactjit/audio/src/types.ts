// ============================================================================
// Module system types
// ============================================================================

export type PortType = 'audio' | 'control' | 'midi';
export type PortDirection = 'in' | 'out';
export type ParamType = 'float' | 'enum' | 'bool';

export interface PortDef {
  type: PortType;
  direction: PortDirection;
}

export interface FloatParamDef {
  type: 'float';
  min: number;
  max: number;
  default: number;
}

export interface EnumParamDef {
  type: 'enum';
  values: string[];
  default: string;
}

export interface BoolParamDef {
  type: 'bool';
  default: boolean;
}

export type ParamDef = FloatParamDef | EnumParamDef | BoolParamDef;

export interface ModuleState {
  id: string;
  type: string;
  params: Record<string, any>;
  ports: Record<string, { type: PortType; direction: PortDirection }>;
  activeNotes?: Record<string, { note: number; envelope: number }>;
  // Custom state from module getState() callbacks
  clock?: ClockPosition;
  sampler?: SamplerState;
  sequencer?: SequencerState;
}

// ============================================================================
// Connection types
// ============================================================================

export interface Connection {
  fromId: string;
  fromPort: string;
  toId: string;
  toPort: string;
  type: PortType;
}

// ============================================================================
// Rack state (full graph snapshot from Lua)
// ============================================================================

export interface RackState {
  modules: ModuleState[];
  connections: Connection[];
  midi: MIDIState;
  recording: RecordingState;
}

// ============================================================================
// MIDI types
// ============================================================================

export interface MIDIDevice {
  id: string;
  name: string;
  connected: boolean;
}

export interface MIDIMapping {
  channel: number;
  cc: number;
  moduleId: string;
  param: string;
}

export interface MIDIState {
  available: boolean;
  devices: MIDIDevice[];
  mappings: MIDIMapping[];
  learning: { moduleId: string; param: string } | null;
}

export interface MIDINoteEvent {
  note: number;
  velocity: number;
  on: boolean;
  channel: number;
  device: string;
}

export interface MIDICCEvent {
  cc: number;
  value: number;
  channel: number;
  device: string;
}

// ============================================================================
// Hook return types
// ============================================================================

export interface UseModuleResult {
  id: string;
  type: string;
  params: Record<string, any>;
  ports: Record<string, { type: PortType; direction: PortDirection }>;
  activeNotes?: Record<string, { note: number; envelope: number }>;
  setParam: (name: string, value: any) => Promise<any>;
}

export interface UseRackResult {
  modules: ModuleState[];
  connections: Connection[];
  addModule: (type: string, id: string, params?: Record<string, any>) => Promise<any>;
  removeModule: (id: string) => Promise<any>;
  connect: (fromId: string, fromPort: string, toId: string, toPort: string) => Promise<any>;
  disconnect: (fromId: string, fromPort: string, toId: string, toPort: string) => Promise<any>;
}

export interface UseMIDIResult {
  available: boolean;
  devices: MIDIDevice[];
  mappings: MIDIMapping[];
  learning: { moduleId: string; param: string } | null;
  learn: (moduleId: string, param: string) => Promise<any>;
  map: (moduleId: string, param: string, channel: number, cc: number) => Promise<any>;
  unmap: (moduleId: string, param: string) => Promise<any>;
}

// ============================================================================
// Sampler types
// ============================================================================

export interface SampleSlot {
  name: string;
  duration: number;
  sampleRate: number;
  mode: 'oneshot' | 'loop';
}

export interface SamplerVoice {
  slot: number;
  position: number;
  duration: number;
}

export interface SamplerState {
  slots: Record<number, SampleSlot | null>;
  voices: SamplerVoice[];
}

export interface UseSamplerResult {
  slots: Record<number, SampleSlot | null>;
  voices: SamplerVoice[];
  loadSample: (slot: number, path: string, mode?: 'oneshot' | 'loop') => Promise<any>;
  clearSample: (slot: number) => Promise<any>;
  trigger: (slot: number, velocity?: number) => Promise<any>;
}

// ============================================================================
// Clock types
// ============================================================================

export interface ClockPosition {
  beat: number;
  bar: number;
  step: number;
  phase: number;
  running: boolean;
}

export interface ClockTickEvent {
  beat: number;
  bar: number;
  step: number;
  bpm: number;
}

export interface UseClockResult extends ClockPosition {
  bpm: number;
  start: () => Promise<any>;
  stop: () => Promise<any>;
  setBpm: (bpm: number) => Promise<any>;
  setDivision: (division: string) => Promise<any>;
  setSwing: (swing: number) => Promise<any>;
}

// ============================================================================
// Sequencer types
// ============================================================================

export interface StepData {
  active: boolean;
  note: number;
  velocity: number;
}

export interface SequencerState {
  pattern: Record<string, Record<string, StepData>>;
  currentStep: number;
  trackTargets: Record<string, string>;
}

export interface UseSequencerResult {
  pattern: Record<string, Record<string, StepData>>;
  currentStep: number;
  trackTargets: Record<string, string>;
  setStep: (track: number, step: number, active: boolean, note?: number, velocity?: number) => Promise<any>;
  setTrackTarget: (track: number, targetModuleId: string) => Promise<any>;
  clearPattern: () => Promise<any>;
}

// ============================================================================
// Recording types
// ============================================================================

export interface AudioRecordingDevice {
  index: number;
  name: string;
}

export interface RecordingState {
  active: boolean;
  moduleId: string | null;
  slot: number | null;
  device: string | null;
  duration: number;
}

export interface UseRecorderResult {
  devices: AudioRecordingDevice[];
  recording: RecordingState;
  listDevices: () => Promise<any>;
  startRecording: (moduleId: string, slot: number, deviceIndex?: number) => Promise<any>;
  stopRecording: () => Promise<any>;
}
