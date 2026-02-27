import React, { useState } from 'react';
import { Box, Text, useLuaInterval } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  Knob,
  Fader,
  Meter,
  LEDIndicator,
  PadButton,
  StepSequencer,
  TransportBar,
} from '../../../packages/controls/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

function KnobDemo() {
  const c = useThemeColors();
  const [v1, setV1] = useState(0.5);
  const [v2, setV2] = useState(0.3);
  const [v3, setV3] = useState(0.7);
  const [v4, setV4] = useState(440);

  return (
    <StorySection index={1} title="Knobs">
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        Rotary controls with drag interaction. Supports custom ranges, colors, sizes, and disabled state.
      </Text>
      <Box style={{ width: '100%', flexDirection: 'row', gap: 20, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Knob value={v1} onChange={setV1} label="Volume" />
          <Text style={{ color: c.textDim, fontSize: 9 }}>{`${Math.round(v1 * 100)}%`}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Knob value={v2} onChange={setV2} color="#22c55e" label="Pan" />
          <Text style={{ color: c.textDim, fontSize: 9 }}>{`${Math.round(v2 * 100)}%`}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Knob value={v3} onChange={setV3} color="#f59e0b" label="Drive" size={64} />
          <Text style={{ color: c.textDim, fontSize: 9 }}>{`${Math.round(v3 * 100)}%`}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Knob
            value={v4}
            onChange={setV4}
            min={20}
            max={2000}
            color="#ec4899"
            label="Freq"
            size={56}
          />
          <Text style={{ color: c.textDim, fontSize: 9 }}>{`${Math.round(v4)} Hz`}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Knob value={0.5} disabled label="Off" size={36} />
        </Box>
      </Box>
    </StorySection>
  );
}

function FaderDemo() {
  const c = useThemeColors();
  const [v1, setV1] = useState(0.7);
  const [v2, setV2] = useState(0.5);
  const [v3, setV3] = useState(0.9);
  const [v4, setV4] = useState(0.3);

  return (
    <StorySection index={2} title="Faders">
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        Vertical channel faders for mixer-style layouts. Drag to set level.
      </Text>
      <Box style={{ width: '100%', flexDirection: 'row', gap: 16, alignItems: 'flex-end', justifyContent: 'center' }}>
        <Fader value={v1} onChange={setV1} label="Kick" color="#6366f1" />
        <Fader value={v2} onChange={setV2} label="Snare" color="#22c55e" />
        <Fader value={v3} onChange={setV3} label="Hi-Hat" color="#f59e0b" height={160} />
        <Fader value={v4} onChange={setV4} label="Bass" color="#ec4899" />
        <Fader value={0.5} disabled label="Muted" />
      </Box>
    </StorySection>
  );
}

function MeterDemo() {
  const c = useThemeColors();
  const [levels, setLevels] = useState([0.6, 0.4, 0.8, 0.3]);

  useLuaInterval(100, () => {
    setLevels((prev) =>
      prev.map((l) => {
        const next = l + (Math.random() - 0.5) * 0.15;
        return Math.max(0.05, Math.min(0.95, next));
      }),
    );
  });

  return (
    <StorySection index={3} title="Meters">
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        Animated level meters with peak hold. Vertical and horizontal orientations.
      </Text>
      <Box style={{ width: '100%', flexDirection: 'row', gap: 12, alignItems: 'flex-end', justifyContent: 'center' }}>
        <Meter value={levels[0]} height={80} />
        <Meter value={levels[1]} height={80} />
        <Meter value={levels[2]} height={80} peak={0.9} />
        <Meter value={levels[3]} height={80} />
        <Box style={{ marginLeft: 12 }}>
          <Meter value={levels[0]} orientation="horizontal" width={120} />
        </Box>
      </Box>
    </StorySection>
  );
}

function LEDDemo() {
  const c = useThemeColors();
  const [blink, setBlink] = useState(false);

  useLuaInterval(500, () => setBlink((b) => !b));

  return (
    <StorySection index={4} title="LED Indicators">
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        Status indicators with on/off glow. Supports custom colors and sizes.
      </Text>
      <Box style={{ width: '100%', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        <LEDIndicator on />
        <LEDIndicator on color="#ef4444" />
        <LEDIndicator on={blink} color="#f59e0b" />
        <LEDIndicator on={false} color="#6366f1" />
        <LEDIndicator on color="#06b6d4" size={12} />
      </Box>
    </StorySection>
  );
}

function PadDemo() {
  const c = useThemeColors();
  const [activePads, setActivePads] = useState<Set<number>>(new Set());
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#8b5cf6', '#14b8a6'];

  return (
    <StorySection index={5} title="Pad Buttons">
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        Toggle pads for triggering samples or toggling states. Click to activate.
      </Text>
      <Box style={{ width: '100%', flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <PadButton
            key={i}
            label={`Pad ${i + 1}`}
            color={colors[i]}
            active={activePads.has(i)}
            onPress={() =>
              setActivePads((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
          />
        ))}
      </Box>
    </StorySection>
  );
}

function SequencerDemo() {
  const c = useThemeColors();
  const [pattern, setPattern] = useState<boolean[][]>(() => {
    const p: boolean[][] = [];
    for (let t = 0; t < 4; t++) {
      p.push(new Array(16).fill(false));
    }
    // Preset a basic 4-on-the-floor
    p[0][0] = true; p[0][4] = true; p[0][8] = true; p[0][12] = true;
    p[1][4] = true; p[1][12] = true;
    p[2][0] = true; p[2][2] = true; p[2][4] = true; p[2][6] = true;
    p[2][8] = true; p[2][10] = true; p[2][12] = true; p[2][14] = true;
    return p;
  });
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useLuaInterval(playing ? 150 : null, () => {
    setStep((s) => (s + 1) % 16);
  });

  return (
    <StorySection index={6} title="Step Sequencer + Transport">
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        16-step pattern sequencer with 4 tracks. Transport bar controls playback and shows position.
      </Text>
      <TransportBar
        playing={playing}
        onPlay={() => { setPlaying(true); setStep(0); }}
        onStop={() => setPlaying(false)}
        bpm={100}
        position={`${Math.floor(step / 4) + 1}.${(step % 4) + 1}`}
      />
      <StepSequencer
        steps={16}
        tracks={4}
        pattern={pattern}
        currentStep={playing ? step : undefined}
        trackLabels={['KICK', 'SNARE', 'HAT', 'PERC']}
        trackColors={['#6366f1', '#22c55e', '#f59e0b', '#ec4899']}
        onStepToggle={(track, stepIdx, active) => {
          setPattern((prev) => {
            const next = prev.map((row) => [...row]);
            next[track][stepIdx] = active;
            return next;
          });
        }}
      />
    </StorySection>
  );
}

export function ControlsStory() {
  return (
    <StoryPage>
      <KnobDemo />
      <FaderDemo />
      <MeterDemo />
      <LEDDemo />
      <PadDemo />
      <SequencerDemo />
    </StoryPage>
  );
}
