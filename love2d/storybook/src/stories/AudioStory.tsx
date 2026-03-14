/**
 * Audio — Modular audio synthesis via Lua DSP engine.
 *
 * 12 hooks, 11 module types, graph-based routing, MIDI, sampling, sequencing.
 * All DSP runs in LuaJIT at 44100 Hz. React declares the patch, Lua renders audio.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, Slider, useLuaInterval, useMount, classifiers as S} from '../../../packages/core/src';
import {
  useAudioInit,
  useRack,
  useModule,
  useParam,
  useClock,
  useSequencer,
  useSampler,
  useMIDI,
  useRecorder,
} from '../../../packages/audio/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  Knob,
  Fader,
  Meter,
  LEDIndicator,
  PadButton,
  StepSequencer,
  TransportBar,
  PianoKeyboard,
  XYPad,
  PitchWheel,
} from '../../../packages/controls/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
  orange: '#f59e0b',
  cyan: '#06b6d4',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  useAudioInit, useRack, useModule, useParam,
  useClock, useClockEvent, useSequencer,
  useSampler, useRecorder,
  useMIDI, useMIDINote, useMIDICC,
} from '@reactjit/audio'`;

const RACK_CODE = `const ready = useAudioInit()
const rack = useRack()

// Add modules to the rack
rack.addModule('oscillator', 'osc1', {
  waveform: 'saw', frequency: 440
})
rack.addModule('filter', 'filt1', {
  mode: 'lowpass', cutoff: 2000
})
rack.addModule('mixer', 'mix1')

// Wire the signal chain
rack.connect('osc1', 'audio_out', 'filt1', 'audio_in')
rack.connect('filt1', 'audio_out', 'mix1', 'input_1')

// Disconnect / remove
rack.disconnect('osc1', 'audio_out', 'filt1', 'audio_in')
rack.removeModule('osc1')`;

const MODULE_CODE = `const osc = useModule('osc1')
osc.params.waveform  // "saw"
osc.params.frequency // 440
osc.setParam('waveform', 'sine')
osc.setParam('frequency', 880)

// Single param shorthand
const [cutoff, setCutoff] = useParam('filt1', 'cutoff')
setCutoff(800)`;

const CLOCK_CODE = `const clock = useClock('clock1')
clock.start()
clock.stop()
clock.setBpm(140)
clock.setDivision('1/16')
clock.setSwing(0.3)
// clock.beat, clock.bar, clock.step, clock.running

// Subscribe to tick events
useClockEvent((tick) => {
  console.log(tick.beat, tick.bar, tick.step, tick.bpm)
})`;

const SEQ_CODE = `const seq = useSequencer('seq1')

// Set a step: track, step, active, note, velocity
seq.setStep(0, 0, true, 36, 100)  // kick on beat 1
seq.setStep(1, 4, true, 38, 80)   // snare on beat 2

// Route tracks to target modules
seq.setTrackTarget(0, 'sampler1')
seq.setTrackTarget(1, 'env1')

seq.clearPattern()
// seq.pattern, seq.currentStep, seq.trackTargets`;

const SAMPLER_CODE = `const sampler = useSampler('sampler1')

sampler.loadSample(1, 'samples/kick.wav')
sampler.loadSample(2, 'samples/snare.ogg', 'loop')
sampler.trigger(1)       // play slot 1 (velocity 127)
sampler.trigger(2, 80)   // play slot 2 (velocity 80)
sampler.clearSample(1)
// sampler.slots, sampler.voices`;

const RECORDER_CODE = `const recorder = useRecorder()

// List recording devices
await recorder.listDevices()
// recorder.devices = [{ index: 0, name: 'HDA Intel PCH' }]

// Record from mic into sampler slot
recorder.startRecording('sampler1', 1)
// ... recording ...
recorder.stopRecording()
// recorder.recording.active, .duration`;

const MIDI_CODE = `const midi = useMIDI()
// midi.available, midi.devices, midi.mappings

// MIDI learn: next CC maps to this param
midi.learn('filt1', 'cutoff')

// Manual CC mapping
midi.map('filt1', 'cutoff', 0, 74)  // ch 0, CC 74
midi.unmap('filt1', 'cutoff')

// Subscribe to MIDI events
useMIDINote((e) => {
  // e.on, e.note, e.velocity, e.channel, e.device
})
useMIDICC((e) => {
  // e.cc, e.value, e.channel, e.device
})`;

const CONTROLS_INSTALL_CODE = `import {
  Knob, Fader, Meter, LEDIndicator,
  PadButton, StepSequencer, TransportBar,
  PianoKeyboard, XYPad, PitchWheel,
} from '@reactjit/controls'`;

const KNOB_FADER_CODE = `<Knob value={cutoff} onChange={setCutoff}
  color="#ec4899" label="Cutoff" size={48} />

<Fader value={volume} onChange={setVolume}
  color="#6366f1" label="Vol" height={120} />

<Meter value={level} peak={peakLevel} segments={12} />
<PitchWheel value={bend} onChange={setBend} springReturn />
<LEDIndicator on={playing} color="#22c55e" size={8} />`;

const PAD_XY_CODE = `<PadButton label="KICK" color="#89b4fa" size={48}
  onPress={triggerKick} onRelease={releaseKick} />

<XYPad x={filterX} y={filterY} size={132}
  onChange={(x, y) => { setCutoff(x); setReso(y) }}
  color="#6366f1" label="Filter" />`;

const SEQ_TRANSPORT_CODE = `<TransportBar playing={isPlaying} recording={isRec}
  onPlay={play} onStop={stop} onRecord={record}
  bpm={128} position="1.3.2" />

<StepSequencer steps={16} tracks={4}
  pattern={pattern} currentStep={step}
  trackLabels={['KICK','SNARE','HAT','PERC']}
  trackColors={['#89b4fa','#a6e3a1','#f59e0b','#ec4899']}
  onStepToggle={(t, s, active) => toggle(t, s, active)} />`;

const PIANO_CODE = `<PianoKeyboard
  whites={[{ id: 'C4', label: 'C', note: 60 }, ...]}
  blacks={[{ id: 'Cs4', label: 'C#', note: 61 }, ...]}
  activeKeys={activeKeys}
  onKeyDown={(id) => noteOn(id)}
  onKeyUp={(id) => noteOff(id)}
  whiteKeyWidth={36} whiteKeyHeight={90}
  palette={{ whiteActive: '#6366f1' }} />`;

const POLYSYNTH_CODE = `// All-in-one keyboard synth (no manual patching)
rack.addModule('polysynth', 'synth1', {
  waveform: 'saw',
  attack: 0.01, decay: 0.15,
  sustain: 0.6, release: 0.4,
  volume: 0.5,
})
rack.connect('synth1', 'audio_out', 'mix1', 'input_1')`;

const PATCH_CODE = `// Classic subtractive synth patch
rack.addModule('oscillator', 'osc1', { waveform: 'saw' })
rack.addModule('filter', 'filt1', { cutoff: 2000, resonance: 4 })
rack.addModule('envelope', 'env1', { attack: 0.01, decay: 0.2 })
rack.addModule('amplifier', 'amp1')
rack.addModule('lfo', 'lfo1', { rate: 2, amount: 0.5 })
rack.addModule('delay', 'delay1', { time: 0.3, feedback: 0.4 })
rack.addModule('mixer', 'mix1')

// Osc -> Filter -> Amp -> Delay -> Mixer
rack.connect('osc1', 'audio_out', 'filt1', 'audio_in')
rack.connect('filt1', 'audio_out', 'amp1', 'audio_in')
rack.connect('env1', 'control_out', 'amp1', 'gain_in')
rack.connect('amp1', 'audio_out', 'delay1', 'audio_in')
rack.connect('delay1', 'audio_out', 'mix1', 'input_1')
// LFO -> Filter cutoff modulation
rack.connect('lfo1', 'control_out', 'filt1', 'cutoff_in')`;

// ── Hoisted data arrays ─────────────────────────────────

const MODULE_TYPES = [
  { label: 'oscillator', desc: 'VCO — sine/saw/square/triangle, FM modulation, MIDI', color: C.blue },
  { label: 'filter', desc: 'VCF — biquad lowpass/highpass/bandpass, cutoff + resonance', color: C.pink },
  { label: 'envelope', desc: 'ADSR generator — attack/decay/sustain/release, MIDI-triggered', color: C.teal },
  { label: 'amplifier', desc: 'VCA — gain + control-rate modulation from envelope/LFO', color: C.green },
  { label: 'mixer', desc: '8-channel summing mixer with per-channel + master gain', color: C.yellow },
  { label: 'delay', desc: 'Delay line — up to 2s, feedback, dry/wet mix', color: C.peach },
  { label: 'lfo', desc: 'Low frequency oscillator — sine/tri/saw/square/random, bipolar/unipolar', color: C.mauve },
  { label: 'clock', desc: 'BPM clock — tempo, division, swing, bar/beat/step position', color: C.orange },
  { label: 'sequencer', desc: 'Step sequencer — up to 64 steps, 8 tracks, pattern editing', color: C.cyan },
  { label: 'sampler', desc: '16-slot sample player — wav/ogg/mp3, pitch shift, velocity, loop', color: C.green },
  { label: 'polysynth', desc: 'All-in-one polyphonic synth — ADSR + waveform + keyboard map', color: C.blue },
];

const HOOK_LIST = [
  { label: 'useAudioInit()', desc: 'Initialize the audio engine, returns ready boolean', color: C.blue },
  { label: 'useRack()', desc: 'Rack-level ops: addModule, removeModule, connect, disconnect', color: C.teal },
  { label: 'useModule(id)', desc: 'Single module params + setParam()', color: C.green },
  { label: 'useParam(id, name)', desc: 'Read/write a single parameter: [value, setValue]', color: C.yellow },
  { label: 'useClock(id)', desc: 'Transport: start/stop, BPM, division, swing, position', color: C.orange },
  { label: 'useClockEvent(fn)', desc: 'Subscribe to clock tick events (beat/bar/step)', color: C.peach },
  { label: 'useSequencer(id)', desc: 'Pattern editing: setStep, setTrackTarget, clearPattern', color: C.mauve },
  { label: 'useSampler(id)', desc: 'Sample slots: loadSample, trigger, clearSample', color: C.pink },
  { label: 'useRecorder()', desc: 'Record from mic into sampler slots', color: C.red },
  { label: 'useMIDI()', desc: 'MIDI devices, CC mappings, learn mode', color: C.cyan },
  { label: 'useMIDINote(fn)', desc: 'Subscribe to MIDI note on/off events', color: C.blue },
  { label: 'useMIDICC(fn)', desc: 'Subscribe to MIDI CC events', color: C.teal },
];

const PORT_TYPES = [
  { label: 'audio', desc: 'Sample-rate float buffer (512 samples at 44100 Hz)', color: C.blue },
  { label: 'control', desc: 'Single value per buffer (for envelopes, LFOs, clocks)', color: C.yellow },
  { label: 'midi', desc: 'Note/CC event stream (from MIDI devices or sequencer)', color: C.pink },
];

const TOPOLOGY_ONLY_RACK_OPTIONS = { topologyOnly: true };

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
  );
}

// ── Band wrapper (zigzag helper) ─────────────────────────

const bandStyle = {
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const halfStyle = { flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

// ── Live Demo: Rack Info ────────────────────────────────

function RackInfoDemo() {
  const ready = useAudioInit();
  if (!ready) return <S.StoryCap>{'Initializing audio engine...'}</S.StoryCap>;
  return <RackInfoDemoReady />;
}

function RackInfoDemoReady() {
  const c = useThemeColors();
  const rack = useRack(TOPOLOGY_ONLY_RACK_OPTIONS);

  useMount(() => {
    // Gain 0 on everything — this demo shows topology, not audio
    rack.addModule('oscillator', 'demo_osc', { waveform: 'saw', frequency: 440, gain: 0 });
    rack.addModule('filter', 'demo_filt', { mode: 'lowpass', cutoff: 2000, resonance: 2 });
    rack.addModule('amplifier', 'demo_amp', { gain: 0 });
    rack.addModule('mixer', 'demo_mix', { master: 0 });
    rack.connect('demo_osc', 'audio_out', 'demo_filt', 'audio_in');
    rack.connect('demo_filt', 'audio_out', 'demo_amp', 'audio_in');
    rack.connect('demo_amp', 'audio_out', 'demo_mix', 'input_1');
  });

  const types: Record<string, number> = {};
  for (const mod of rack.modules) {
    types[mod.type] = (types[mod.type] || 0) + 1;
  }

  return (
    <S.StackG6W100>
      <S.StoryCap>
        {'Engine ready — live rack state:'}
      </S.StoryCap>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.blue }}>Modules:</Text>
        <S.RowWrap style={{ gap: 4 }}>
          {Object.entries(types).map(([type, count]) => (
            <Box key={type} style={{
              flexDirection: 'row', gap: 4,
              backgroundColor: c.surface1, borderRadius: 4,
              paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
            }}>
              <S.StoryCap>{type}</S.StoryCap>
              <S.StoryBreadcrumbActive>{String(count)}</S.StoryBreadcrumbActive>
            </Box>
          ))}
        </S.RowWrap>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.green }}>Connections:</Text>
        {rack.connections.map((conn, i) => (
          <S.RowCenterG4 key={i}>
            <Text style={{ fontSize: 8, color: C.blue }}>{conn.fromId}</Text>
            <S.StoryTiny>{`.${conn.fromPort}`}</S.StoryTiny>
            <Text style={{ fontSize: 8, color: C.orange }}>{'>'}</Text>
            <Text style={{ fontSize: 8, color: C.green }}>{conn.toId}</Text>
            <S.StoryTiny>{`.${conn.toPort}`}</S.StoryTiny>
          </S.RowCenterG4>
        ))}
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Module Params ────────────────────────────

function ModuleParamDemo() {
  const c = useThemeColors();
  const ready = useAudioInit();
  const mod = useModule('demo_osc');
  const [cutoff, setCutoff] = useParam('demo_filt', 'cutoff');

  const waveforms = ['sine', 'saw', 'square', 'triangle'];

  if (!ready) {
    return <S.StoryCap>{'Waiting for engine...'}</S.StoryCap>;
  }

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Live param control via useModule + useParam'}</S.StoryCap>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.blue }}>{'Oscillator waveform:'}</Text>
        <S.RowG4>
          {waveforms.map((w) => (
            <Pressable key={w} onPress={() => mod.setParam('waveform', w)}>
              <Box style={{
                backgroundColor: mod.params.waveform === w ? C.accent : c.surface1,
                borderRadius: 4,
                paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              }}>
                <Text style={{
                  fontSize: 9,
                  color: mod.params.waveform === w ? '#fff' : c.muted,
                }}>
                  {w.slice(0, 3).toUpperCase()}
                </Text>
              </Box>
            </Pressable>
          ))}
        </S.RowG4>
      </Box>

      <Box style={{ gap: 2 }}>
        <S.RowSpaceBetween style={{ width: '100%' }}>
          <Text style={{ fontSize: 10, color: C.pink }}>{'Filter cutoff:'}</Text>
          <Text style={{ fontSize: 10, color: C.pink }}>{`${Math.round(cutoff || 2000)} Hz`}</Text>
        </S.RowSpaceBetween>
        <Slider
          value={cutoff || 2000}
          minimumValue={20}
          maximumValue={15000}
          onValueChange={(v: number) => setCutoff(Math.round(v))}
          activeTrackColor={C.pink}
          thumbColor={C.pink}
        />
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.green }}>{'Current state:'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <S.StoryTiny>
            {`osc: ${mod.params.waveform || 'saw'} @ ${mod.params.frequency || 440}Hz`}
          </S.StoryTiny>
          <S.StoryTiny>
            {`filter: ${cutoff || 2000}Hz cutoff`}
          </S.StoryTiny>
        </Box>
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Clock Transport ──────────────────────────

function ClockDemo() {
  const ready = useAudioInit();
  if (!ready) return <S.StoryCap>{'Waiting for engine...'}</S.StoryCap>;
  return <ClockDemoReady />;
}

function ClockDemoReady() {
  const c = useThemeColors();
  const rack = useRack(TOPOLOGY_ONLY_RACK_OPTIONS);

  useMount(() => {
    rack.addModule('clock', 'demo_clock', { bpm: 120, division: '1/16', running: false });
  });

  const clock = useClock('demo_clock');

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Live transport via useClock'}</S.StoryCap>

      <S.RowCenterG8>
        <Pressable onPress={() => clock.running ? clock.stop() : clock.start()}>
          <Box style={{
            backgroundColor: clock.running ? C.red : C.green,
            borderRadius: 4,
            paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <S.StorySectionIcon src={clock.running ? 'square' : 'play'} tintColor={'#1e1e2e'} />
          </Box>
        </Pressable>

        <Box style={{ flexGrow: 1, gap: 2 }}>
          <S.RowSpaceBetween style={{ width: '100%' }}>
            <Text style={{ fontSize: 9, color: C.orange }}>{'BPM'}</Text>
            <Text style={{ fontSize: 9, color: C.orange }}>{String(clock.bpm)}</Text>
          </S.RowSpaceBetween>
          <Slider
            value={clock.bpm}
            minimumValue={40}
            maximumValue={240}
            onValueChange={(v: number) => clock.setBpm(Math.round(v))}
            activeTrackColor={C.orange}
            thumbColor={C.orange}
          />
        </Box>
      </S.RowCenterG8>

      <Box style={{
        backgroundColor: c.surface1, borderRadius: 4, padding: 8,
        flexDirection: 'row', gap: 16, justifyContent: 'center',
      }}>
        <Box style={{ alignItems: 'center', gap: 2 }}>
          <S.StoryTiny>{'BAR'}</S.StoryTiny>
          <Text style={{ fontSize: 14, color: C.yellow }}>{String(clock.bar + 1)}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 2 }}>
          <S.StoryTiny>{'BEAT'}</S.StoryTiny>
          <Text style={{ fontSize: 14, color: C.yellow }}>{String(clock.beat + 1)}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 2 }}>
          <S.StoryTiny>{'STEP'}</S.StoryTiny>
          <Text style={{ fontSize: 14, color: C.yellow }}>{String((clock.step % 4) + 1)}</Text>
        </Box>
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Sequencer Grid ───────────────────────────

function SequencerDemo() {
  const ready = useAudioInit();
  if (!ready) return <S.StoryCap>{'Waiting for engine...'}</S.StoryCap>;
  return <SequencerDemoReady />;
}

function SequencerDemoReady() {
  const c = useThemeColors();
  const rack = useRack(TOPOLOGY_ONLY_RACK_OPTIONS);

  useMount(() => {
    rack.addModule('sequencer', 'demo_seq', { steps: 16, tracks: 4 });
  });

  const seq = useSequencer('demo_seq');
  const trackLabels = ['KICK', 'SNARE', 'HAT', 'PERC'];
  const trackColors = [C.blue, C.green, C.orange, C.pink];

  return (
    <S.StackG6W100>
      <S.RowCenter style={{ justifyContent: 'space-between', width: '100%' }}>
        <S.StoryCap>{'Live pattern via useSequencer — click to toggle'}</S.StoryCap>
        <Pressable onPress={() => seq.clearPattern()}>
          <Box style={{ backgroundColor: C.red, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ fontSize: 8, color: '#1e1e2e' }}>{'CLEAR'}</Text>
          </Box>
        </Pressable>
      </S.RowCenter>

      <Box style={{ gap: 2, alignItems: 'center' }}>
        {Array.from({ length: 4 }, (_, track) => (
          <S.RowCenter key={track} style={{ gap: 2 }}>
            <Box style={{ width: 36 }}>
              <Text style={{ color: trackColors[track], fontSize: 8 }}>
                {trackLabels[track]}
              </Text>
            </Box>
            {Array.from({ length: 16 }, (_, step) => {
              const stepData = seq.pattern?.[String(track)]?.[String(step)];
              const isActive = stepData?.active || false;
              const isCurrent = seq.currentStep === step;

              return (
                <Pressable
                  key={step}
                  onPress={() => seq.setStep(track, step, !isActive, 36 + track, isActive ? 0 : 100)}
                  style={({ hovered }) => ({
                    width: 14, height: 14, borderRadius: 2,
                    backgroundColor: isActive
                      ? (isCurrent ? C.yellow : trackColors[track])
                      : (isCurrent ? C.yellow + '40' : hovered ? c.surface1 : c.bg),
                    borderWidth: 1,
                    borderColor: step % 4 === 0 ? c.border : 'transparent',
                  })}
                >
                  {null}
                </Pressable>
              );
            })}
          </S.RowCenter>
        ))}
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Sampler Slots ────────────────────────────

function SamplerDemo() {
  const ready = useAudioInit();
  if (!ready) return <S.StoryCap>{'Waiting for engine...'}</S.StoryCap>;
  return <SamplerDemoReady />;
}

function SamplerDemoReady() {
  const c = useThemeColors();
  const rack = useRack(TOPOLOGY_ONLY_RACK_OPTIONS);

  useMount(() => {
    rack.addModule('sampler', 'demo_sampler');
  });

  const sampler = useSampler('demo_sampler');
  const slotColors = [C.blue, C.green, C.orange, C.pink, C.teal, C.mauve, C.yellow, C.cyan];

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Live pads via useSampler — click to trigger'}</S.StoryCap>

      <S.RowWrap style={{ gap: 3 }}>
        {Array.from({ length: 8 }, (_, i) => {
          const slot = sampler.slots[i + 1];
          const hasVoice = sampler.voices.some((v) => v.slot === i + 1);

          return (
            <Pressable
              key={i}
              onPress={() => sampler.trigger(i + 1)}
              style={({ pressed, hovered }) => ({
                width: 40, height: 30, borderRadius: 4,
                backgroundColor: pressed
                  ? slotColors[i] + '60'
                  : hasVoice
                    ? slotColors[i] + '40'
                    : hovered ? c.surface1 : c.bg,
                borderWidth: 1,
                borderColor: slot ? slotColors[i] : c.border,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
              })}
            >
              <Text style={{ fontSize: 8, color: slot ? c.text : c.muted }}>
                {slot ? slot.name.slice(0, 5) : `Pad ${i + 1}`}
              </Text>
            </Pressable>
          );
        })}
      </S.RowWrap>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.green }}>{'Active voices:'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
          <S.StoryTiny>
            {sampler.voices.length > 0
              ? sampler.voices.map((v) => `slot ${v.slot} @ ${v.position.toFixed(2)}s`).join(', ')
              : 'None'}
          </S.StoryTiny>
        </Box>
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: MIDI State ───────────────────────────────

function MIDIDemo() {
  const c = useThemeColors();
  const ready = useAudioInit();
  const midi = useMIDI();

  if (!ready) {
    return <S.StoryCap>{'Waiting for engine...'}</S.StoryCap>;
  }

  return (
    <S.StackG6W100>
      <S.RowCenterG6>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: midi.available ? C.green : C.red,
        }} />
        <Text style={{ fontSize: 10, color: midi.available ? C.green : C.red }}>
          {midi.available ? 'MIDI available (ALSA)' : 'MIDI not available'}
        </Text>
      </S.RowCenterG6>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.cyan }}>{'Devices:'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
          {midi.devices.length > 0
            ? midi.devices.map((d) => (
              <S.RowCenterG6 key={d.id}>
                <Box style={{
                  width: 5, height: 5, borderRadius: 3,
                  backgroundColor: d.connected ? C.green : C.red,
                }} />
                <S.StoryTiny>{`${d.name} (${d.id})`}</S.StoryTiny>
              </S.RowCenterG6>
            ))
            : <S.StoryTiny>{'No MIDI devices detected'}</S.StoryTiny>
          }
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.mauve }}>{'CC Mappings:'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
          {midi.mappings.length > 0
            ? midi.mappings.map((m, i) => (
              <S.StoryTiny key={i}>
                {`CC${m.cc} ch${m.channel} -> ${m.moduleId}.${m.param}`}
              </S.StoryTiny>
            ))
            : <S.StoryTiny>{'No mappings — use midi.learn() to map'}</S.StoryTiny>
          }
        </Box>
      </Box>

      {midi.learning && (
        <S.RowCenterG6>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.yellow }} />
          <Text style={{ fontSize: 9, color: C.yellow }}>
            {`Learning: ${midi.learning.moduleId}.${midi.learning.param} — move a knob`}
          </Text>
        </S.RowCenterG6>
      )}
    </S.StackG6W100>
  );
}

// ── Live Demo: Recorder State ───────────────────────────

function RecorderDemo() {
  const ready = useAudioInit();
  if (!ready) return <S.StoryCap>{'Waiting for engine...'}</S.StoryCap>;
  return <RecorderDemoReady />;
}

function RecorderDemoReady() {
  const c = useThemeColors();
  const recorder = useRecorder();

  useMount(() => {
    recorder.listDevices();
  });

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Live recording state via useRecorder'}</S.StoryCap>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.red }}>{'Recording devices:'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
          {recorder.devices.length > 0
            ? recorder.devices.map((d) => (
              <S.StoryTiny key={d.index}>
                {`[${d.index}] ${d.name}`}
              </S.StoryTiny>
            ))
            : <S.StoryTiny>{'No recording devices found'}</S.StoryTiny>
          }
        </Box>
      </Box>

      <S.RowCenterG6>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: recorder.recording.active ? C.red : c.muted,
        }} />
        <Text style={{ fontSize: 9, color: recorder.recording.active ? C.red : c.muted }}>
          {recorder.recording.active
            ? `Recording: ${recorder.recording.duration.toFixed(1)}s`
            : 'Not recording'}
        </Text>
      </S.RowCenterG6>
    </S.StackG6W100>
  );
}

// ── Live Demo: Controls Showcase ────────────────────────

const PIANO_WHITES = [
  { id: 'C4', label: 'C', note: 60 },
  { id: 'D4', label: 'D', note: 62 },
  { id: 'E4', label: 'E', note: 64 },
  { id: 'F4', label: 'F', note: 65 },
  { id: 'G4', label: 'G', note: 67 },
  { id: 'A4', label: 'A', note: 69 },
  { id: 'B4', label: 'B', note: 71 },
  { id: 'C5', label: 'C', note: 72 },
];

const PIANO_BLACKS = [
  { id: 'Cs4', label: 'C#', note: 61 },
  { id: 'Ds4', label: 'D#', note: 63 },
  { id: 'Fs4', label: 'F#', note: 66 },
  { id: 'Gs4', label: 'G#', note: 68 },
  { id: 'As4', label: 'A#', note: 70 },
];

const SEQ_INIT_PATTERN = [
  [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false],
  [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
  [true,true,true,true, true,true,true,true, true,true,true,true, true,true,true,true],
];

// ── Demo: Knobs + Faders + PitchWheel (no animation — no re-renders) ──

function KnobFaderDemo() {
  const c = useThemeColors();
  const [knob1, setKnob1] = useState(0.65);
  const [knob2, setKnob2] = useState(0.3);
  const [faderVal, setFaderVal] = useState(0.7);
  const [pitchVal, setPitchVal] = useState(0);

  return (
    <S.StackG10W100>
      {/* rjit-ignore-next-line */}
      <Box style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-end', justifyContent: 'center' }}>
        <S.CenterG4>
          <Knob value={knob1} onChange={setKnob1} color={C.pink} label="Cutoff" />
          <S.StoryCap>{`${Math.round(knob1 * 100)}%`}</S.StoryCap>
        </S.CenterG4>
        <S.CenterG4>
          <Knob value={knob2} onChange={setKnob2} color={C.teal} label="Reso" />
          <S.StoryCap>{`${Math.round(knob2 * 100)}%`}</S.StoryCap>
        </S.CenterG4>
        <Fader value={faderVal} onChange={setFaderVal} color={C.accent} label="Vol" />
        <PitchWheel value={pitchVal} onChange={setPitchVal} springReturn height={120} width={28} />
      </Box>
    </S.StackG10W100>
  );
}

// ── Demo: Meters + LEDs (isolated — owns its own animation intervals) ──

function MeterLEDDemo() {
  const c = useThemeColors();
  const [levels, setLevels] = useState([0.6, 0.4, 0.7]);
  const [ledBlink, setLedBlink] = useState(false);

  useLuaInterval(100, () => {
    setLevels((prev) =>
      prev.map((l) => {
        const next = l + (Math.random() - 0.5) * 0.15;
        return Math.max(0.05, Math.min(0.95, next));
      }),
    );
  });

  useLuaInterval(500, () => setLedBlink((b) => !b));

  return (
    <S.StackG10W100>
      {/* rjit-ignore-next-line */}
      <S.RowG12 style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
        <Meter value={levels[0]} peak={0.85} height={80} />
        <Meter value={levels[1]} height={80} />
        <Meter value={levels[2]} height={80} peak={0.9} />
        <Box style={{ marginLeft: 12 }}>
          <Meter value={levels[0]} orientation="horizontal" width={120} />
        </Box>
      </S.RowG12>
      <S.RowCenter style={{ gap: 10, justifyContent: 'center' }}>
        <LEDIndicator on color={C.green} size={8} />
        <S.StoryTiny>{'Active'}</S.StoryTiny>
        <LEDIndicator on={ledBlink} color={C.red} size={8} />
        <S.StoryTiny>{'Recording'}</S.StoryTiny>
        <LEDIndicator on={ledBlink} color={C.orange} size={8} />
        <S.StoryTiny>{'Clipping'}</S.StoryTiny>
        <LEDIndicator on={false} color={C.blue} size={8} />
        <S.StoryTiny>{'Off'}</S.StoryTiny>
      </S.RowCenter>
    </S.StackG10W100>
  );
}

// ── Demo: XYPad + PadButtons ────────────────────────────

function PadXYDemo() {
  const c = useThemeColors();
  const [xyX, setXyX] = useState(0.5);
  const [xyY, setXyY] = useState(0.5);
  const [padActive, setPadActive] = useState<Record<string, boolean>>({});
  const padLabels = ['KCK', 'SNR', 'HAT', 'CLP', 'TOM', 'RIM'];
  const padColors = [C.blue, C.green, C.orange, C.pink, C.cyan, C.mauve];

  return (
    <S.StackG8W100>
      <S.RowCenter style={{ gap: 10, justifyContent: 'center' }}>
        <XYPad
          x={xyX} y={xyY}
          onChange={(x: number, y: number) => { setXyX(x); setXyY(y); }}
          size={80}
          color={C.accent}
          label="Filter"
        />
        <Box style={{ gap: 4 }}>
          {[0, 2, 4].map(row => (
            <S.RowG4 key={row}>
              {[row, row + 1].map(i => (
                <PadButton
                  key={padLabels[i]}
                  label={padLabels[i]}
                  color={padColors[i]}
                  size={38}
                  active={padActive[padLabels[i]] || false}
                  onPress={() => setPadActive(prev => ({ ...prev, [padLabels[i]]: true }))}
                  onRelease={() => setPadActive(prev => ({ ...prev, [padLabels[i]]: false }))}
                />
              ))}
            </S.RowG4>
          ))}
        </Box>
      </S.RowCenter>
      <S.RowG6 style={{ justifyContent: 'center' }}>
        <S.StoryTiny>{`X: ${xyX.toFixed(2)}`}</S.StoryTiny>
        <S.StoryTiny>{`Y: ${xyY.toFixed(2)}`}</S.StoryTiny>
      </S.RowG6>
    </S.StackG8W100>
  );
}

// ── Demo: TransportBar + StepSequencer ──────────────────

function TransportSeqDemo() {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [seqPattern, setSeqPattern] = useState(SEQ_INIT_PATTERN);

  useLuaInterval(playing ? 150 : null, () => {
    setStep((s) => (s + 1) % 16);
  });

  return (
    <S.StackG8W100>
      <TransportBar
        playing={playing}
        onPlay={() => { setPlaying(true); setStep(0); }}
        onStop={() => setPlaying(false)}
        bpm={128}
        position={`${Math.floor(step / 4) + 1}.${(step % 4) + 1}`}
      />
      <StepSequencer
        steps={16}
        tracks={3}
        pattern={seqPattern}
        currentStep={playing ? step : undefined}
        trackLabels={['KCK', 'SNR', 'HAT']}
        trackColors={[C.blue, C.green, C.orange]}
        stepSize={14}
        onStepToggle={(track: number, stepIdx: number, active: boolean) => {
          setSeqPattern(prev => {
            const next = prev.map(row => [...row]);
            next[track][stepIdx] = active;
            return next;
          });
        }}
      />
    </S.StackG8W100>
  );
}

// ── Demo: PianoKeyboard ─────────────────────────────────

function PianoDemo() {
  const c = useThemeColors();
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const [lastNote, setLastNote] = useState('');

  return (
    <S.CenterW100 style={{ gap: 6 }}>
      <PianoKeyboard
        whites={PIANO_WHITES}
        blacks={PIANO_BLACKS}
        activeKeys={activeKeys}
        onKeyDown={(keyId: string) => {
          setActiveKeys(prev => ({ ...prev, [keyId]: true }));
          setLastNote(keyId);
        }}
        onKeyUp={(keyId: string) => setActiveKeys(prev => { const n = { ...prev }; delete n[keyId]; return n; })}
        whiteKeyWidth={30}
        whiteKeyHeight={80}
        whiteGap={1}
        blackKeyWidth={18}
        blackKeyHeight={48}
        palette={{
          whiteActive: C.accent,
          blackActive: C.accent,
        }}
      />
      <S.StoryTiny>{lastNote ? `Last: ${lastNote}` : 'Click or drag across keys'}</S.StoryTiny>
    </S.CenterW100>
  );
}

// ── Module Catalog ──────────────────────────────────────

function ModuleCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {MODULE_TYPES.map(m => (
        <S.RowG8 key={m.label} style={{ alignItems: 'start' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: m.color, flexShrink: 0, marginTop: 3 }} />
          <S.StoryBreadcrumbActive style={{ width: 80, flexShrink: 0 }}>{m.label}</S.StoryBreadcrumbActive>
          <S.StoryCap style={{ flexShrink: 1 }}>{m.desc}</S.StoryCap>
        </S.RowG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Hook List ───────────────────────────────────────────

function HookList() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {HOOK_LIST.map(h => (
        <S.RowG8 key={h.label} style={{ alignItems: 'start' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: h.color, flexShrink: 0, marginTop: 3 }} />
          <S.StoryBreadcrumbActive style={{ width: 120, flexShrink: 0 }}>{h.label}</S.StoryBreadcrumbActive>
          <S.StoryCap style={{ flexShrink: 1 }}>{h.desc}</S.StoryCap>
        </S.RowG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Port Type List ──────────────────────────────────────

function PortTypeList() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {PORT_TYPES.map(p => (
        <S.RowCenterG8 key={p.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 60, flexShrink: 0 }}>{p.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{p.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── AudioStory ──────────────────────────────────────────

export function AudioStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="music" tintColor={C.accent} />
        <S.StoryTitle>
          {'Audio'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/audio'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'bwaaaaaaaaaamp'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band: accent stripe + overview ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'Modular audio synthesis in React, rendered in LuaJIT.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'@reactjit/audio gives you a virtual modular rack — oscillators, filters, envelopes, LFOs, delays, mixers, samplers, a step sequencer, and a BPM clock. Wire modules together with connect(). All DSP runs in LuaJIT at 44100 Hz / 512-sample buffers. React declares the patch, Lua renders it to audio. MIDI devices auto-connect via ALSA.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'12 hooks cover the full audio lifecycle. useAudioInit() starts the engine, useRack() manages the module graph, useModule/useParam control individual modules. Clock, sequencer, sampler, recorder, and MIDI each have dedicated hooks.'}
            </S.StoryBody>
          </Box>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={INSTALL_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 2: demo | text + code — RACK ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <RackInfoDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="layers">{'RACK MANAGEMENT'}</SectionLabel>
            <S.StoryBody>
              {'useRack() is the top-level API. Add typed modules with initial params, wire them with connect(), remove with removeModule(). The rack is a directed acyclic graph — the engine topologically sorts modules and routes buffers automatically.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Options: topologyOnly skips high-frequency param updates. maxFps caps state updates for dashboards.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={RACK_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: text + code | demo — MODULE PARAMS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="sliders">{'MODULE CONTROL'}</SectionLabel>
            <S.StoryBody>
              {'useModule(id) reads all params and provides setParam(). useParam(id, name) is the single-param shorthand — returns [value, setValue] like useState. Both update optimistically and sync via the bridge.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Params are validated against the module definition. Invalid values are clamped or rejected by Lua.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MODULE_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <ModuleParamDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Callout: DSP in Lua ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All DSP runs in LuaJIT at 44100 Hz. React never touches audio buffers — it only reads state snapshots and sends param changes via the bridge. Zero JS audio processing overhead.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 4: demo | text + code — CLOCK ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <ClockDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="timer">{'CLOCK + TRANSPORT'}</SectionLabel>
            <S.StoryBody>
              {'useClock(id) gives you full transport control — start/stop, BPM, note division (1/4 to 1/32), swing. Position tracks beat, bar, step, and phase. The clock emits sample-accurate gate pulses for driving the sequencer.'}
            </S.StoryBody>
            <S.StoryCap>
              {'useClockEvent(fn) subscribes to tick events for custom logic (e.g., visual beat indicators, external sync).'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CLOCK_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: text + code | demo — SEQUENCER ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="grid">{'STEP SEQUENCER'}</SectionLabel>
            <S.StoryBody>
              {'useSequencer(id) edits patterns on a grid: up to 64 steps, 8 tracks. Each step has active, note, and velocity. Tracks route to target modules via setTrackTarget() — the sequencer sends noteOn/noteOff events when steps fire.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Driven by a clock module wired to clock_in. Rising edge detection advances the step. Pattern state is serialized to the bridge for live UI editing.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SEQ_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SequencerDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 6: demo | text + code — SAMPLER + RECORDER ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SamplerDemo />
            <Box style={{ height: 8 }} />
            <RecorderDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="mic">{'SAMPLER + RECORDING'}</SectionLabel>
            <S.StoryBody>
              {'useSampler(id) manages 16 sample slots. Load wav/ogg/mp3 files, trigger playback with velocity, clear slots. MIDI note 36 = slot 1 (GM drum map). Supports oneshot and loop modes with pitch shifting.'}
            </S.StoryBody>
            <S.StoryCap>
              {'useRecorder() records from a microphone directly into a sampler slot. List devices, start/stop recording, monitor duration. No file management — audio goes straight into the slot buffer.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SAMPLER_CODE} />
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={RECORDER_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: text + code | demo — MIDI ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="toggle-left">{'MIDI INTEGRATION'}</SectionLabel>
            <S.StoryBody>
              {'useMIDI() exposes connected devices, CC-to-param mappings, and MIDI learn mode. Call midi.learn(moduleId, param) and twist a knob to bind it. Auto-connects to all ALSA MIDI devices, re-scans every 5 seconds.'}
            </S.StoryBody>
            <S.StoryCap>
              {'useMIDINote(fn) and useMIDICC(fn) subscribe to raw events for custom handling. Built-in CC mappings: CC1 = FM amount, CC7 = volume, CC10 = pan, CC74 = filter cutoff.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MIDI_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <MIDIDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 8: text + code | demo — KNOBS + FADERS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="sliders">{'KNOBS + FADERS'}</SectionLabel>
            <S.StoryBody>
              {'Knob is a 270-degree rotary with drag control. Fader is a vertical channel slider. PitchWheel springs back to center on release. All rendering and hit testing runs in Lua — drag a knob and it responds in the same frame.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={KNOB_FADER_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <KnobFaderDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 8b: demo | text — METERS + LED INDICATORS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <MeterLEDDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="gauge">{'METERS + LED INDICATORS'}</SectionLabel>
            <S.StoryBody>
              {'Meter is a segmented LED bar with peak hold — vertical or horizontal. LEDIndicator is a status light with configurable glow. Both update at 60fps in Lua with zero React overhead.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Wire meters to audio levels via useLuaInterval. LEDs toggle on/off for status feedback — recording, clipping, active channel.'}
            </S.StoryCap>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 9: demo | text + code — PADS + XYPAD ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <PadXYDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="grid">{'PADS + XY CONTROL'}</SectionLabel>
            <S.StoryBody>
              {'PadButton is a momentary trigger with press/release callbacks — wire them to sampler slots for a drum machine. XYPad is a 2D control surface — map X to filter cutoff and Y to resonance for hands-on sound design.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Both support custom colors, sizes, and disabled state. PadButton shows active state for sequencer step feedback.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PAD_XY_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 10: text + code | demo — TRANSPORT + SEQUENCER ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="timer">{'TRANSPORT + SEQUENCER'}</SectionLabel>
            <S.StoryBody>
              {'TransportBar bundles play/stop/record buttons with BPM display, position readout, and LED indicators. StepSequencer is an interactive grid — click to toggle steps, drag to paint. Both are pure UI controls that pair with the audio hooks.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SEQ_TRANSPORT_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <TransportSeqDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 11: demo | text + code — PIANO KEYBOARD ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <PianoDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="music">{'PIANO KEYBOARD'}</SectionLabel>
            <S.StoryBody>
              {'PianoKeyboard renders a multi-octave piano with white and black keys. Click to play, drag across keys for glissando. activeKeys highlights currently pressed notes. All hit testing and drawing runs in Lua for instant response.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Fully customizable: key dimensions, colors via palette prop, note labels. Wire onKeyDown/onKeyUp to useMIDI or a polysynth module.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PIANO_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Callout: controls install ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Controls are decoupled from audio — use them anywhere. Knobs work for color pickers, faders for opacity, meters for progress bars. import from @reactjit/controls.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Callout: one-liner ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'For a plug-and-play keyboard synth without manual patching, use the polysynth module. One addModule() call gives you a polyphonic instrument with ADSR, waveform selection, and keyboard mapping.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 9: text + code | code — POLYSYNTH + PATCH EXAMPLE ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="music">{'POLYSYNTH SHORTCUT'}</SectionLabel>
            <S.StoryBody>
              {'The polysynth module is an all-in-one instrument — oscillator + ADSR + polyphonic voice management in a single module. No manual patching needed. Keyboard keys map to notes (z=C3, a=C4, k=C5).'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={POLYSYNTH_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="git-merge">{'PATCH EXAMPLE'}</SectionLabel>
            <S.StoryBody>
              {'Classic subtractive synth: oscillator through filter, envelope-controlled amplifier, LFO modulating filter cutoff, delay for ambience. This is the modular equivalent of the polysynth — more control, more wiring.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PATCH_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 9: HOOK CATALOG (full width) ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 8 }}>
          <SectionLabel icon="code">{'HOOK CATALOG'}</SectionLabel>
          <S.StoryCap>{'All 12 hooks in @reactjit/audio:'}</S.StoryCap>
          <HookList />
        </Box>

        <Divider />

        {/* ── Band 10: MODULE CATALOG (full width) ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 8 }}>
          <SectionLabel icon="list">{'MODULE CATALOG'}</SectionLabel>
          <S.StoryCap>{'All 11 built-in module types:'}</S.StoryCap>
          <ModuleCatalog />
        </Box>

        <Divider />

        {/* ── Band 11: PORT TYPES + ENGINE SPECS (full width, stacked) ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 12 }}>
          <Box style={{ gap: 8 }}>
            <SectionLabel icon="zap">{'PORT TYPES'}</SectionLabel>
            <S.StoryBody>
              {'Modules communicate through typed ports. connect() validates type compatibility — audio-to-audio and control-to-control only.'}
            </S.StoryBody>
            <PortTypeList />
          </Box>
          <Box style={{ height: 4 }} />
          <Box style={{ gap: 8 }}>
            <SectionLabel icon="gauge">{'ENGINE SPECS'}</SectionLabel>
            <S.RowWrap style={{ gap: 20 }}>
              <Box style={{ gap: 3 }}>
                <S.RowCenterG8>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue, flexShrink: 0 }} />
                  <S.StoryBreadcrumbActive>{'Sample rate'}</S.StoryBreadcrumbActive>
                  <S.StoryCap>{'44100 Hz'}</S.StoryCap>
                </S.RowCenterG8>
                <S.RowCenterG8>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.teal, flexShrink: 0 }} />
                  <S.StoryBreadcrumbActive>{'Buffer size'}</S.StoryBreadcrumbActive>
                  <S.StoryCap>{'512 samples (~11.6ms)'}</S.StoryCap>
                </S.RowCenterG8>
                <S.RowCenterG8>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow, flexShrink: 0 }} />
                  <S.StoryBreadcrumbActive>{'Graph sort'}</S.StoryBreadcrumbActive>
                  <S.StoryCap>{"Kahn's algorithm (topological)"}</S.StoryCap>
                </S.RowCenterG8>
              </Box>
              <Box style={{ gap: 3 }}>
                <S.RowCenterG8>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.pink, flexShrink: 0 }} />
                  <S.StoryBreadcrumbActive>{'MIDI backend'}</S.StoryBreadcrumbActive>
                  <S.StoryCap>{'ALSA sequencer via FFI'}</S.StoryCap>
                </S.RowCenterG8>
                <S.RowCenterG8>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, flexShrink: 0 }} />
                  <S.StoryBreadcrumbActive>{'State push'}</S.StoryBreadcrumbActive>
                  <S.StoryCap>{'~30 FPS to bridge'}</S.StoryCap>
                </S.RowCenterG8>
                <S.RowCenterG8>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.orange, flexShrink: 0 }} />
                  <S.StoryBreadcrumbActive>{'Audio output'}</S.StoryBreadcrumbActive>
                  <S.StoryCap>{'Love2D QueueableSource'}</S.StoryCap>
                </S.RowCenterG8>
              </Box>
            </S.RowWrap>
          </Box>
        </Box>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="music" />
        <S.StoryBreadcrumbActive>{'Audio'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
