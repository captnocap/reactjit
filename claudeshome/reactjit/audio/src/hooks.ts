/**
 * React hooks for the @reactjit/audio module system.
 *
 * These hooks communicate with the Lua audio engine via the bridge
 * (useLoveRPC for commands, useLoveEvent for state updates).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent } from '@reactjit/core';
import type {
  RackState,
  ModuleState,
  Connection,
  MIDIDevice,
  MIDIMapping,
  MIDINoteEvent,
  MIDICCEvent,
  UseModuleResult,
  UseRackResult,
  UseMIDIResult,
  ClockPosition,
  ClockTickEvent,
  UseClockResult,
  SampleSlot,
  SamplerVoice,
  UseSamplerResult,
  AudioRecordingDevice,
  RecordingState,
  UseRecorderResult,
  StepData,
  UseSequencerResult,
} from './types';

interface UseRackOptions {
  /**
   * Update only when module/connection topology changes (id/type/wiring),
   * ignoring high-frequency param/state updates.
   */
  topologyOnly?: boolean;
  /**
   * Cap state updates to this FPS. Useful for dashboards that don't need
   * per-frame fidelity.
   */
  maxFps?: number;
}

type ListLike<T> = T[] | Record<string, T> | null | undefined;

function normalizeList<T>(value: ListLike<T>): T[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const keys = Object.keys(value);
  if (keys.length === 0) return [];

  const sortedKeys = keys
    .slice()
    .sort((a, b) => {
      const ai = Number(a);
      const bi = Number(b);
      const aIsInt = Number.isInteger(ai) && String(ai) === a;
      const bIsInt = Number.isInteger(bi) && String(bi) === b;
      if (aIsInt && bIsInt) return ai - bi;
      if (aIsInt) return -1;
      if (bIsInt) return 1;
      return a.localeCompare(b);
    });

  const record = value as Record<string, T>;
  return sortedKeys.map((key) => record[key]);
}

function topologySignature(modules: ModuleState[], connections: Connection[]): string {
  if (modules.length === 0 && connections.length === 0) return '';
  const modSig = modules
    .map((m) => `${m.id}:${m.type}`)
    .sort()
    .join('|');
  const connSig = connections
    .map((c) => `${c.fromId}.${c.fromPort}>${c.toId}.${c.toPort}:${c.type}`)
    .sort()
    .join('|');
  return `${modSig}__${connSig}`;
}

// ============================================================================
// useRack — rack-level operations and state
// ============================================================================

/**
 * Access the full audio rack: modules, connections, and operations.
 *
 * @example
 * const rack = useRack();
 * rack.addModule('oscillator', 'osc1', { waveform: 'saw' });
 * rack.connect('osc1', 'audio_out', 'mixer1', 'input_1');
 */
export function useRack(options?: UseRackOptions): UseRackResult {
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const lastTopologyRef = useRef<string>('__init__');
  const lastUpdateAtRef = useRef<number>(0);

  const topologyOnly = options?.topologyOnly ?? false;
  const minIntervalMs = options?.maxFps ? Math.max(0, Math.floor(1000 / options.maxFps)) : 0;

  const addModuleRpc = useLoveRPC('audio:addModule');
  const removeModuleRpc = useLoveRPC('audio:removeModule');
  const connectRpc = useLoveRPC('audio:connect');
  const disconnectRpc = useLoveRPC('audio:disconnect');

  useLoveEvent('audio:state', (state: RackState) => {
    const modules = normalizeList<ModuleState>((state as any)?.modules);
    const connections = normalizeList<Connection>((state as any)?.connections);
    const now = Date.now();
    if (minIntervalMs > 0 && now - lastUpdateAtRef.current < minIntervalMs) {
      return;
    }

    const topo = topologySignature(modules, connections);

    // Idle engine emits empty state at ~30fps; avoid pointless rerenders.
    if (topo === '' && lastTopologyRef.current === '') {
      return;
    }
    // Topology-only mode: skip if module/connection graph hasn't changed.
    // Full mode: also skip — useRack consumers care about structure, not per-frame
    // param churn (clock phase, envelope values). Use useModule/useParam for those.
    if (topo === lastTopologyRef.current) {
      return;
    }

    lastTopologyRef.current = topo;
    lastUpdateAtRef.current = now;
    setModules(modules);
    setConnections(connections);
  });

  const addModule = useCallback(
    (type: string, id: string, params?: Record<string, any>) =>
      addModuleRpc({ type, id, params }),
    [addModuleRpc]
  );

  const removeModule = useCallback(
    (id: string) => removeModuleRpc({ id }),
    [removeModuleRpc]
  );

  const connect = useCallback(
    (fromId: string, fromPort: string, toId: string, toPort: string) =>
      connectRpc({ fromId, fromPort, toId, toPort }),
    [connectRpc]
  );

  const disconnect = useCallback(
    (fromId: string, fromPort: string, toId: string, toPort: string) =>
      disconnectRpc({ fromId, fromPort, toId, toPort }),
    [disconnectRpc]
  );

  return { modules, connections, addModule, removeModule, connect, disconnect };
}

// ============================================================================
// useModule — single module params and control
// ============================================================================

/**
 * Access a specific module's params and set them.
 *
 * @example
 * const osc = useModule('osc1');
 * osc.params.waveform  // "saw"
 * osc.setParam('waveform', 'sine');
 */
export function useModule(moduleId: string): UseModuleResult {
  const [state, setState] = useState<ModuleState>({
    id: moduleId,
    type: '',
    params: {},
    ports: {},
  });

  const setParamRpc = useLoveRPC('audio:setParam');

  const stateRef = useRef(state);

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = normalizeList<ModuleState>((rackState as any)?.modules)
      .find((m) => m.id === moduleId);
    if (mod) {
      // Skip re-render if params haven't changed
      const prev = stateRef.current;
      if (prev.id === mod.id && prev.type === mod.type
        && JSON.stringify(prev.params) === JSON.stringify(mod.params)) {
        return;
      }
      stateRef.current = mod;
      setState(mod);
    }
  });

  const setParam = useCallback(
    (name: string, value: any) =>
      setParamRpc({ moduleId, param: name, value }),
    [setParamRpc, moduleId]
  );

  return {
    id: state.id,
    type: state.type,
    params: state.params,
    ports: state.ports,
    activeNotes: state.activeNotes,
    setParam,
  };
}

// ============================================================================
// useParam — single parameter read/write
// ============================================================================

/**
 * Read and write a single parameter on a module.
 *
 * @example
 * const [cutoff, setCutoff] = useParam('filt1', 'cutoff');
 * setCutoff(800);
 */
export function useParam(
  moduleId: string,
  paramName: string
): [any, (value: any) => Promise<any>] {
  const [value, setValue] = useState<any>(null);
  const setParamRpc = useLoveRPC('audio:setParam');

  const valueRef = useRef(value);

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = normalizeList<ModuleState>((rackState as any)?.modules)
      .find((m) => m.id === moduleId);
    if (mod && mod.params[paramName] !== undefined) {
      if (mod.params[paramName] !== valueRef.current) {
        valueRef.current = mod.params[paramName];
        setValue(mod.params[paramName]);
      }
    }
  });

  const setParam = useCallback(
    (newValue: any) => {
      valueRef.current = newValue;
      setValue(newValue); // optimistic update
      return setParamRpc({ moduleId, param: paramName, value: newValue });
    },
    [setParamRpc, moduleId, paramName]
  );

  return [value, setParam];
}

// ============================================================================
// useMIDI — MIDI devices, mappings, and learn mode
// ============================================================================

/**
 * Access MIDI state: devices, CC mappings, and learn mode.
 *
 * @example
 * const midi = useMIDI();
 * midi.learn('filt1', 'cutoff');  // next CC maps to this param
 * midi.devices  // [{ id: '20:0', name: 'Arturia MiniLab', connected: true }]
 */
export function useMIDI(): UseMIDIResult {
  const [available, setAvailable] = useState(false);
  const [devices, setDevices] = useState<MIDIDevice[]>([]);
  const [mappings, setMappings] = useState<MIDIMapping[]>([]);
  const [learning, setLearning] = useState<{ moduleId: string; param: string } | null>(null);

  const learnRpc = useLoveRPC('audio:midiLearn');
  const mapRpc = useLoveRPC('audio:midiMap');
  const unmapRpc = useLoveRPC('audio:midiUnmap');

  useLoveEvent('audio:state', (rackState: RackState) => {
    const midi = (rackState as any)?.midi;
    if (midi) {
      setAvailable(Boolean(midi.available));
      setDevices(normalizeList<MIDIDevice>(midi.devices));
      setMappings(normalizeList<MIDIMapping>(midi.mappings));
      setLearning(midi.learning ?? null);
    }
  });

  const learn = useCallback(
    (moduleId: string, param: string) => learnRpc({ moduleId, param }),
    [learnRpc]
  );

  const map = useCallback(
    (moduleId: string, param: string, channel: number, cc: number) =>
      mapRpc({ moduleId, param, channel, cc }),
    [mapRpc]
  );

  const unmap = useCallback(
    (moduleId: string, param: string) => unmapRpc({ moduleId, param }),
    [unmapRpc]
  );

  return { available, devices, mappings, learning, learn, map, unmap };
}

// ============================================================================
// useMIDINote — subscribe to MIDI note events
// ============================================================================

/**
 * Subscribe to MIDI note on/off events.
 *
 * @example
 * useMIDINote((event) => {
 *   console.log(event.on ? 'Note ON' : 'Note OFF', event.note, event.velocity);
 * });
 */
export function useMIDINote(handler: (event: MIDINoteEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useLoveEvent('midi:note', (payload: MIDINoteEvent) => {
    handlerRef.current(payload);
  });
}

// ============================================================================
// useMIDICC — subscribe to MIDI CC events
// ============================================================================

/**
 * Subscribe to MIDI CC events.
 *
 * @example
 * useMIDICC((event) => {
 *   console.log('CC', event.cc, '=', event.value);
 * });
 */
export function useMIDICC(handler: (event: MIDICCEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useLoveEvent('midi:cc', (payload: MIDICCEvent) => {
    handlerRef.current(payload);
  });
}

// ============================================================================
// useAudioInit — initialize the audio engine
// ============================================================================

/**
 * Initialize the audio engine. Call once at app startup.
 * Returns a boolean indicating if the engine is ready.
 *
 * @example
 * const audioReady = useAudioInit();
 */
export function useAudioInit(): boolean {
  const [ready, setReady] = useState(false);
  const initRpc = useLoveRPC('audio:init');

  useEffect(() => {
    let cancelled = false;
    initRpc({}).then(() => {
      if (!cancelled) setReady(true);
    }).catch(() => {
      // Audio not available — still set ready so UI renders
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [initRpc]);

  return ready;
}

// ============================================================================
// useClock — BPM clock position and transport controls
// ============================================================================

/**
 * Access a clock module's position and transport controls.
 *
 * @example
 * const clock = useClock('clock1');
 * clock.start();
 * clock.setBpm(140);
 * // clock.beat, clock.bar, clock.step, clock.phase
 */
export function useClock(moduleId: string): UseClockResult {
  const [position, setPosition] = useState<ClockPosition>({
    beat: 0, bar: 0, step: 0, phase: 0, running: false,
  });
  const [bpm, setBpmState] = useState(120);

  const setParamRpc = useLoveRPC('audio:setParam');

  const posRef = useRef(position);
  const bpmRef = useRef(bpm);

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = normalizeList<ModuleState>((rackState as any)?.modules)
      .find((m) => m.id === moduleId);
    if (mod) {
      if (mod.clock) {
        const prev = posRef.current;
        // Only re-render for discrete changes (beat/bar/step/running).
        // Phase is a continuous float that changes every audio tick — comparing
        // it here would trigger 30fps re-renders even when nothing visible changed.
        if (prev.beat !== mod.clock.beat || prev.bar !== mod.clock.bar
          || prev.step !== mod.clock.step || prev.running !== mod.clock.running) {
          posRef.current = mod.clock;
          setPosition(mod.clock);
        }
      }
      if (mod.params.bpm !== undefined && mod.params.bpm !== bpmRef.current) {
        bpmRef.current = mod.params.bpm;
        setBpmState(mod.params.bpm);
      }
    }
  });

  const start = useCallback(
    () => setParamRpc({ moduleId, param: 'running', value: true }),
    [setParamRpc, moduleId]
  );

  const stop = useCallback(
    () => setParamRpc({ moduleId, param: 'running', value: false }),
    [setParamRpc, moduleId]
  );

  const setBpm = useCallback(
    (value: number) => {
      setBpmState(value);
      return setParamRpc({ moduleId, param: 'bpm', value });
    },
    [setParamRpc, moduleId]
  );

  const setDivision = useCallback(
    (value: string) => setParamRpc({ moduleId, param: 'division', value }),
    [setParamRpc, moduleId]
  );

  const setSwing = useCallback(
    (value: number) => setParamRpc({ moduleId, param: 'swing', value }),
    [setParamRpc, moduleId]
  );

  return {
    ...position,
    bpm,
    start,
    stop,
    setBpm,
    setDivision,
    setSwing,
  };
}

// ============================================================================
// useClockEvent — subscribe to clock tick events
// ============================================================================

/**
 * Subscribe to clock tick events from the audio engine.
 *
 * @example
 * useClockEvent((tick) => {
 *   console.log('Beat:', tick.beat, 'Bar:', tick.bar, 'Step:', tick.step);
 * });
 */
export function useClockEvent(handler: (event: ClockTickEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useLoveEvent('clock:tick', (payload: ClockTickEvent) => {
    handlerRef.current(payload);
  });
}

// ============================================================================
// useSampler — sample slot management
// ============================================================================

/**
 * Manage a sampler module's slots: load files, clear, trigger.
 *
 * @example
 * const sampler = useSampler('sampler1');
 * sampler.loadSample(1, 'samples/kick.wav');
 * sampler.trigger(1, 127);
 */
export function useSampler(moduleId: string): UseSamplerResult {
  const [slots, setSlots] = useState<Record<number, SampleSlot | null>>({});
  const [voices, setVoices] = useState<SamplerVoice[]>([]);

  const loadSampleRpc = useLoveRPC('audio:loadSample');
  const clearSampleRpc = useLoveRPC('audio:clearSample');
  const noteOnRpc = useLoveRPC('audio:noteOn');

  const slotsRef = useRef<string>('');
  const voicesRef = useRef<string>('');

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = normalizeList<ModuleState>((rackState as any)?.modules)
      .find((m) => m.id === moduleId);
    if (mod?.sampler) {
      const slotSig = JSON.stringify(mod.sampler.slots || {});
      if (slotSig !== slotsRef.current) {
        slotsRef.current = slotSig;
        setSlots(mod.sampler.slots || {});
      }
      const voiceSig = JSON.stringify(mod.sampler.voices || []);
      if (voiceSig !== voicesRef.current) {
        voicesRef.current = voiceSig;
        setVoices(normalizeList<SamplerVoice>(mod.sampler.voices as ListLike<SamplerVoice>));
      }
    }
  });

  const loadSample = useCallback(
    (slot: number, path: string, mode?: 'oneshot' | 'loop') =>
      loadSampleRpc({ moduleId, slot, path, mode }),
    [loadSampleRpc, moduleId]
  );

  const clearSample = useCallback(
    (slot: number) => clearSampleRpc({ moduleId, slot }),
    [clearSampleRpc, moduleId]
  );

  const trigger = useCallback(
    (slot: number, velocity: number = 127) => {
      // Slot 1 = MIDI note 36, slot 2 = 37, etc. (GM drum map)
      const note = 35 + slot;
      return noteOnRpc({ moduleId, note, velocity });
    },
    [noteOnRpc, moduleId]
  );

  return { slots, voices, loadSample, clearSample, trigger };
}

// ============================================================================
// useRecorder — audio recording device management
// ============================================================================

/**
 * Record audio from a microphone or input device into a sampler slot.
 *
 * @example
 * const recorder = useRecorder();
 * recorder.startRecording('sampler1', 1);  // record into slot 1
 * // ... recording ...
 * recorder.stopRecording();  // sample is now in the slot
 */
export function useRecorder(): UseRecorderResult {
  const [devices, setDevices] = useState<AudioRecordingDevice[]>([]);
  const [recording, setRecording] = useState<RecordingState>({
    active: false, moduleId: null, slot: null, device: null, duration: 0,
  });

  const listDevicesRpc = useLoveRPC('audio:listRecordingDevices');
  const startRpc = useLoveRPC('audio:startRecording');
  const stopRpc = useLoveRPC('audio:stopRecording');

  useLoveEvent('audio:state', (rackState: RackState) => {
    if (rackState.recording) {
      setRecording(rackState.recording);
    }
  });

  const listDevices = useCallback(
    async () => {
      const result = await listDevicesRpc({});
      if (result && typeof result === 'object' && 'devices' in result) {
        setDevices(normalizeList<AudioRecordingDevice>((result as any).devices));
      }
      return result;
    },
    [listDevicesRpc]
  );

  const startRecording = useCallback(
    (moduleId: string, slot: number, deviceIndex?: number) =>
      startRpc({ moduleId, slot, device: deviceIndex }),
    [startRpc]
  );

  const stopRecording = useCallback(
    () => stopRpc({}),
    [stopRpc]
  );

  return { devices, recording, listDevices, startRecording, stopRecording };
}

// ============================================================================
// useSequencer — step sequencer pattern editing
// ============================================================================

/**
 * Control a sequencer module's pattern and track assignments.
 *
 * @example
 * const seq = useSequencer('seq1');
 * seq.setTrackTarget(0, 'sampler1');  // track 0 triggers sampler1
 * seq.setStep(0, 0, true, 36, 100);  // track 0, step 0: kick at velocity 100
 * seq.setStep(0, 4, true, 36, 100);  // track 0, step 4: kick
 */
export function useSequencer(moduleId: string): UseSequencerResult {
  const [pattern, setPattern] = useState<Record<string, Record<string, StepData>>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [trackTargets, setTrackTargets] = useState<Record<string, string>>({});

  const setStepRpc = useLoveRPC('audio:setStep');
  const setTargetRpc = useLoveRPC('audio:setTrackTarget');
  const clearPatternRpc = useLoveRPC('audio:clearPattern');

  const stepRef = useRef(currentStep);
  const patternRef = useRef<string>('');

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = normalizeList<ModuleState>((rackState as any)?.modules)
      .find((m) => m.id === moduleId);
    if (mod?.sequencer) {
      const newStep = mod.sequencer.currentStep || 0;
      if (newStep !== stepRef.current) {
        stepRef.current = newStep;
        setCurrentStep(newStep);
      }
      const patSig = JSON.stringify(mod.sequencer.pattern || {});
      if (patSig !== patternRef.current) {
        patternRef.current = patSig;
        setPattern(mod.sequencer.pattern || {});
        setTrackTargets(mod.sequencer.trackTargets || {});
      }
    }
  });

  const setStep = useCallback(
    (track: number, step: number, active: boolean, note?: number, velocity?: number) =>
      setStepRpc({ moduleId, track, step, active, note, velocity }),
    [setStepRpc, moduleId]
  );

  const setTrackTarget = useCallback(
    (track: number, target: string) =>
      setTargetRpc({ moduleId, track, target }),
    [setTargetRpc, moduleId]
  );

  const clearPattern = useCallback(
    () => clearPatternRpc({ moduleId }),
    [clearPatternRpc, moduleId]
  );

  return { pattern, currentStep, trackTargets, setStep, setTrackTarget, clearPattern };
}
