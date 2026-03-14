// @reactjit/audio — Modular audio framework for ReactJIT
//
// Lua-side: lua/audio/ (engine, graph, modules, MIDI)
// React-side: hooks for rack management, module control, MIDI,
//             sampler, clock, sequencer, recording

export type {
  PortType,
  PortDirection,
  ParamType,
  PortDef,
  FloatParamDef,
  EnumParamDef,
  BoolParamDef,
  ParamDef,
  ModuleState,
  Connection,
  RackState,
  MIDIDevice,
  MIDIMapping,
  MIDIState,
  MIDINoteEvent,
  MIDICCEvent,
  UseModuleResult,
  UseRackResult,
  UseMIDIResult,
  // Sampler
  SampleSlot,
  SamplerVoice,
  SamplerState,
  UseSamplerResult,
  // Clock
  ClockPosition,
  ClockTickEvent,
  UseClockResult,
  // Sequencer
  StepData,
  SequencerState,
  UseSequencerResult,
  // Recording
  AudioRecordingDevice,
  RecordingState,
  UseRecorderResult,
} from './types';

export {
  useRack,
  useModule,
  useParam,
  useMIDI,
  useMIDINote,
  useMIDICC,
  useAudioInit,
  // New hooks
  useClock,
  useClockEvent,
  useSampler,
  useRecorder,
  useSequencer,
} from './hooks';
