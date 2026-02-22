import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Pressable, Slider } from '../../../packages/core/src';
import {
  useAudioInit,
  useRack,
  useModule,
  useParam,
  useClock,
  useSequencer,
  useSampler,
} from '../../../packages/audio/src';

// ── Colors ──────────────────────────────────────────────────

const C = {
  bg:       '#0f1117',
  panel:    '#1a1d27',
  surface:  '#252836',
  border:   '#2e3348',
  text:     '#e2e8f0',
  dim:      '#64748b',
  accent:   '#6366f1',
  accentDim:'#4f46e5',
  green:    '#22c55e',
  greenDim: '#15803d',
  red:      '#ef4444',
  redDim:   '#b91c1c',
  orange:   '#f59e0b',
  cyan:     '#06b6d4',
  pink:     '#ec4899',
  stepOn:   '#6366f1',
  stepOff:  '#1e2030',
  stepCur:  '#fbbf24',
};

// ── Small helpers ───────────────────────────────────────────

function Label({ children, color }: { children: string; color?: string }) {
  return <Text style={{ color: color || C.dim, fontSize: 10 }}>{children}</Text>;
}

function Value({ children, color }: { children: string; color?: string }) {
  return <Text style={{ color: color || C.text, fontSize: 12, fontWeight: '600' }}>{children}</Text>;
}

function Btn({
  label, onPress, color, active, small,
}: {
  label: string; onPress: () => void; color: string; active?: boolean; small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => ({
        backgroundColor: pressed
          ? color + '40'
          : active
            ? color
            : hovered ? color + '30' : C.surface,
        borderWidth: 1,
        borderColor: active ? color : C.border,
        paddingLeft: small ? 8 : 14,
        paddingRight: small ? 8 : 14,
        paddingTop: small ? 4 : 7,
        paddingBottom: small ? 4 : 7,
        borderRadius: 4,
        alignItems: 'center' as const,
      })}
    >
      <Text style={{
        color: active ? '#fff' : color,
        fontSize: small ? 10 : 12,
        fontWeight: '600',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ParamSlider({
  label, value, min, max, color, onChange, suffix,
}: {
  label: string; value: number; min: number; max: number;
  color: string; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <Box>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        <Label>{label}</Label>
        <Value color={color}>{`${Math.round(value)}${suffix || ''}`}</Value>
      </Box>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        onValueChange={onChange}
        activeTrackColor={color}
        thumbColor={color}
      />
    </Box>
  );
}

// ── Module panel ────────────────────────────────────────────

function ModulePanel({ title, color, children }: {
  title: string; color: string; children: React.ReactNode;
}) {
  return (
    <Box style={{
      backgroundColor: C.panel,
      borderWidth: 1,
      borderColor: C.border,
      borderTopWidth: 3,
      borderTopColor: color,
      borderRadius: 6,
      padding: 8,
      gap: 6,
      flexGrow: 1,
      flexBasis: 0,
    }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{title}</Text>
      {children}
    </Box>
  );
}

// ── Transport bar ───────────────────────────────────────────

function Transport({ clockId }: { clockId: string }) {
  const clock = useClock(clockId);
  const [swing, setSwingParam] = useParam(clockId, 'swing');

  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.panel,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 6,
      padding: 8,
      width: '100%',
    }}>
      {/* Play/Stop */}
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Btn
          label={clock.running ? 'STOP' : 'PLAY'}
          onPress={() => clock.running ? clock.stop() : clock.start()}
          color={clock.running ? C.red : C.green}
          active={clock.running}
        />
      </Box>

      {/* BPM */}
      <Box style={{ flexGrow: 1, flexBasis: 0 }}>
        <ParamSlider
          label="BPM"
          value={clock.bpm}
          min={40}
          max={240}
          color={C.orange}
          onChange={(v) => clock.setBpm(Math.round(v))}
        />
      </Box>

      {/* Swing */}
      <Box style={{ width: 100 }}>
        <ParamSlider
          label="Swing"
          value={Math.round((swing || 0) * 100)}
          min={0}
          max={100}
          color={C.cyan}
          onChange={(v) => { setSwingParam(v / 100); clock.setSwing(v / 100); }}
          suffix="%"
        />
      </Box>

      {/* Position display */}
      <Box style={{
        backgroundColor: C.bg,
        borderRadius: 4,
        padding: 8,
        alignItems: 'center',
        gap: 2,
      }}>
        <Label>POSITION</Label>
        <Text style={{ color: C.stepCur, fontSize: 16, fontWeight: '700' }}>
          {`${clock.bar + 1}.${clock.beat + 1}.${(clock.step % 4) + 1}`}
        </Text>
      </Box>
    </Box>
  );
}

// ── Synth controls ──────────────────────────────────────────

function OscPanel({ moduleId }: { moduleId: string }) {
  const mod = useModule(moduleId);
  const waveforms = ['sine', 'saw', 'square', 'triangle'];

  return (
    <ModulePanel title="OSCILLATOR" color={C.accent}>
      <Label>Waveform</Label>
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {waveforms.map((w) => (
          <Btn
            key={w}
            label={w.slice(0, 3).toUpperCase()}
            onPress={() => mod.setParam('waveform', w)}
            color={C.accent}
            active={mod.params.waveform === w}
            small
          />
        ))}
      </Box>
      <ParamSlider
        label="Frequency"
        value={mod.params.frequency || 440}
        min={20}
        max={2000}
        color={C.accent}
        onChange={(v) => mod.setParam('frequency', Math.round(v))}
        suffix=" Hz"
      />
      <ParamSlider
        label="Gain"
        value={(mod.params.gain || 0.8) * 100}
        min={0}
        max={100}
        color={C.accent}
        onChange={(v) => mod.setParam('gain', v / 100)}
        suffix="%"
      />
    </ModulePanel>
  );
}

function FilterPanel({ moduleId }: { moduleId: string }) {
  const mod = useModule(moduleId);
  const modes = ['lowpass', 'highpass', 'bandpass'];

  return (
    <ModulePanel title="FILTER" color={C.pink}>
      <Label>Mode</Label>
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {modes.map((m) => (
          <Btn
            key={m}
            label={m === 'lowpass' ? 'LP' : m === 'highpass' ? 'HP' : 'BP'}
            onPress={() => mod.setParam('mode', m)}
            color={C.pink}
            active={mod.params.mode === m}
            small
          />
        ))}
      </Box>
      <ParamSlider
        label="Cutoff"
        value={mod.params.cutoff || 1000}
        min={20}
        max={15000}
        color={C.pink}
        onChange={(v) => mod.setParam('cutoff', Math.round(v))}
        suffix=" Hz"
      />
      <ParamSlider
        label="Resonance"
        value={mod.params.resonance || 1}
        min={0.1}
        max={20}
        color={C.pink}
        onChange={(v) => mod.setParam('resonance', Number(v.toFixed(1)))}
      />
    </ModulePanel>
  );
}

function EnvelopePanel({ moduleId }: { moduleId: string }) {
  const mod = useModule(moduleId);

  return (
    <ModulePanel title="ENVELOPE" color={C.cyan}>
      <ParamSlider
        label="Attack"
        value={(mod.params.attack || 0.01) * 1000}
        min={1}
        max={2000}
        color={C.cyan}
        onChange={(v) => mod.setParam('attack', v / 1000)}
        suffix=" ms"
      />
      <ParamSlider
        label="Decay"
        value={(mod.params.decay || 0.15) * 1000}
        min={1}
        max={2000}
        color={C.cyan}
        onChange={(v) => mod.setParam('decay', v / 1000)}
        suffix=" ms"
      />
      <ParamSlider
        label="Sustain"
        value={(mod.params.sustain || 0.6) * 100}
        min={0}
        max={100}
        color={C.cyan}
        onChange={(v) => mod.setParam('sustain', v / 100)}
        suffix="%"
      />
      <ParamSlider
        label="Release"
        value={(mod.params.release || 0.4) * 1000}
        min={1}
        max={5000}
        color={C.cyan}
        onChange={(v) => mod.setParam('release', v / 1000)}
        suffix=" ms"
      />
    </ModulePanel>
  );
}

// ── Step sequencer grid ─────────────────────────────────────

function StepGrid({
  sequencerId,
  tracks,
  steps,
  trackLabels,
  trackColors,
}: {
  sequencerId: string;
  tracks: number;
  steps: number;
  trackLabels: string[];
  trackColors: string[];
}) {
  const seq = useSequencer(sequencerId);

  return (
    <Box style={{ gap: 3, alignItems: 'center' }}>
      {Array.from({ length: tracks }, (_, track) => (
        <Box key={track} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Box style={{ width: 40 }}>
            <Text style={{
              color: trackColors[track] || C.dim,
              fontSize: 9,
              fontWeight: '700',
            }}>
              {trackLabels[track] || `T${track + 1}`}
            </Text>
          </Box>
          {Array.from({ length: steps }, (_, step) => {
            const stepData = seq.pattern?.[String(track)]?.[String(step)];
            const isActive = stepData?.active || false;
            const isCurrent = seq.currentStep === step;

            return (
              <Pressable
                key={step}
                onPress={() => {
                  seq.setStep(track, step, !isActive, 36 + track, isActive ? 0 : 100);
                }}
                style={({ hovered }) => ({
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  backgroundColor: isActive
                    ? (isCurrent ? C.stepCur : trackColors[track] || C.stepOn)
                    : (isCurrent ? C.stepCur + '40' : hovered ? C.surface : C.stepOff),
                  borderWidth: 1,
                  borderColor: isCurrent ? C.stepCur : (step % 4 === 0 ? C.border : 'transparent'),
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                })}
              >
                {step % 4 === 0 && !isActive ? (
                  <Box style={{
                    width: 3,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: C.border,
                  }} />
                ) : null}
              </Pressable>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ── Sampler slot display ────────────────────────────────────

function SamplerSlots({ moduleId }: { moduleId: string }) {
  const sampler = useSampler(moduleId);
  const slotColors = [C.accent, C.green, C.orange, C.pink, C.cyan, C.red];

  return (
    <Box style={{ gap: 4 }}>
      <Label>SAMPLE SLOTS</Label>
      <Box style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
        {Array.from({ length: 8 }, (_, i) => {
          const slot = sampler.slots[i + 1];
          const hasVoice = sampler.voices.some((v) => v.slot === i + 1);

          return (
            <Pressable
              key={i}
              onPress={() => sampler.trigger(i + 1)}
              style={({ pressed, hovered }) => ({
                width: 46,
                height: 34,
                backgroundColor: pressed
                  ? (slotColors[i % slotColors.length] + '60')
                  : hasVoice
                    ? slotColors[i % slotColors.length] + '40'
                    : hovered ? C.surface : C.bg,
                borderWidth: 1,
                borderColor: slot ? slotColors[i % slotColors.length] : C.border,
                borderRadius: 4,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                gap: 2,
              })}
            >
              <Text style={{
                color: slot ? C.text : C.dim,
                fontSize: 8,
                fontWeight: '600',
              }}>
                {slot ? slot.name.slice(0, 6) : `Pad ${i + 1}`}
              </Text>
              {slot && (
                <Text style={{ color: C.dim, fontSize: 7 }}>
                  {`${slot.duration.toFixed(1)}s`}
                </Text>
              )}
            </Pressable>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Connection display ──────────────────────────────────────

function ConnectionList() {
  const rack = useRack();

  return (
    <Box style={{ gap: 4 }}>
      <Label>SIGNAL CHAIN</Label>
      {rack.connections.map((conn, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Text style={{ color: C.accent, fontSize: 9, fontWeight: '600' }}>
            {conn.fromId}
          </Text>
          <Text style={{ color: C.dim, fontSize: 9 }}>
            {`.${conn.fromPort}`}
          </Text>
          <Text style={{ color: C.orange, fontSize: 9 }}>{'>'}</Text>
          <Text style={{ color: C.green, fontSize: 9, fontWeight: '600' }}>
            {conn.toId}
          </Text>
          <Text style={{ color: C.dim, fontSize: 9 }}>
            {`.${conn.toPort}`}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Module count badges ─────────────────────────────────────

function RackInfo() {
  const rack = useRack();
  const types: Record<string, number> = {};
  for (const mod of rack.modules) {
    types[mod.type] = (types[mod.type] || 0) + 1;
  }

  return (
    <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {Object.entries(types).map(([type, count]) => (
        <Box key={type} style={{
          flexDirection: 'row',
          gap: 4,
          backgroundColor: C.surface,
          borderRadius: 4,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.dim, fontSize: 9 }}>{type}</Text>
          <Text style={{ color: C.text, fontSize: 9, fontWeight: '700' }}>{String(count)}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Main story ──────────────────────────────────────────────

export function AudioRackStory() {
  const ready = useAudioInit();
  const rack = useRack();
  const patchBuilt = useRef(false);

  // Build the patch once
  useEffect(() => {
    if (!ready || patchBuilt.current) return;
    patchBuilt.current = true;

    // Synth modules
    rack.addModule('oscillator', 'osc1', { waveform: 'saw', frequency: 440, gain: 0.6 });
    rack.addModule('filter', 'filt1', { mode: 'lowpass', cutoff: 2000, resonance: 2 });
    rack.addModule('envelope', 'env1', { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 });
    rack.addModule('amplifier', 'amp1', { gain: 0.7 });

    // Clock + Sequencer
    rack.addModule('clock', 'clock1', { bpm: 120, division: '1/16', running: false });
    rack.addModule('sequencer', 'seq1', { steps: 16, tracks: 4 });

    // Sampler
    rack.addModule('sampler', 'sampler1');

    // Mixer (combines synth + sampler)
    rack.addModule('mixer', 'mix1', { gain_1: 1, gain_2: 0.8, master: 0.8 });

    // Wire synth chain: osc -> filter -> amp -> mixer input 1
    rack.connect('osc1', 'audio_out', 'filt1', 'audio_in');
    rack.connect('env1', 'control_out', 'amp1', 'gain_in');
    rack.connect('filt1', 'audio_out', 'amp1', 'audio_in');
    rack.connect('amp1', 'audio_out', 'mix1', 'input_1');

    // Wire sampler -> mixer input 2
    rack.connect('sampler1', 'audio_out', 'mix1', 'input_2');

    // Wire clock -> sequencer
    rack.connect('clock1', 'gate_out', 'seq1', 'clock_in');
  }, [ready]);

  if (!ready) {
    return (
      <Box style={{
        width: '100%',
        height: '100%',
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color: C.dim, fontSize: 14 }}>Initializing audio engine...</Text>
      </Box>
    );
  }

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      padding: 10,
      gap: 8,
    }}>
      {/* Transport */}
      <Transport clockId="clock1" />

      {/* Step sequencer */}
      <Box style={{
        backgroundColor: C.panel,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 6,
        padding: 8,
        gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Text style={{ color: C.orange, fontSize: 11, fontWeight: '700' }}>STEP SEQUENCER</Text>
          <Label>Click steps to toggle</Label>
        </Box>
        <StepGrid
          sequencerId="seq1"
          tracks={4}
          steps={16}
          trackLabels={['KICK', 'SNARE', 'HAT', 'PERC']}
          trackColors={[C.accent, C.green, C.orange, C.pink]}
        />
      </Box>

      {/* Module panels row */}
      <Box style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
        <OscPanel moduleId="osc1" />
        <FilterPanel moduleId="filt1" />
        <EnvelopePanel moduleId="env1" />
      </Box>

      {/* Bottom row: sampler + connections */}
      <Box style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
        <Box style={{
          backgroundColor: C.panel,
          borderWidth: 1,
          borderColor: C.border,
          borderTopWidth: 3,
          borderTopColor: C.green,
          borderRadius: 6,
          padding: 8,
          gap: 6,
          flexGrow: 1,
          flexBasis: 0,
        }}>
          <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>SAMPLER</Text>
          <SamplerSlots moduleId="sampler1" />
        </Box>

        <Box style={{
          backgroundColor: C.panel,
          borderWidth: 1,
          borderColor: C.border,
          borderTopWidth: 3,
          borderTopColor: C.orange,
          borderRadius: 6,
          padding: 8,
          gap: 6,
          flexGrow: 1,
          flexBasis: 0,
        }}>
          <Text style={{ color: C.orange, fontSize: 11, fontWeight: '700' }}>PATCH BAY</Text>
          <ConnectionList />
        </Box>
      </Box>
    </Box>
  );
}
