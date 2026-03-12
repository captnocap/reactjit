import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Pressable, useMount } from '@reactjit/core';
import { useLoveRPC } from '@reactjit/core';
import { useAudioInit, useRack, useModule } from '@reactjit/audio';

// ── Key layout ─────────────────────────────────────────────────

interface KeyDef {
  label: string;
  note: number;
  isBlack: boolean;
}

const BOTTOM_WHITES: KeyDef[] = [
  { label: 'Z', note: 48, isBlack: false },
  { label: 'X', note: 50, isBlack: false },
  { label: 'C', note: 52, isBlack: false },
  { label: 'V', note: 53, isBlack: false },
  { label: 'B', note: 55, isBlack: false },
  { label: 'N', note: 57, isBlack: false },
  { label: 'M', note: 59, isBlack: false },
];
const BOTTOM_BLACKS: KeyDef[] = [
  { label: 'W', note: 49, isBlack: true },
  { label: 'E', note: 51, isBlack: true },
  { label: 'T', note: 54, isBlack: true },
  { label: 'Y', note: 56, isBlack: true },
  { label: 'U', note: 58, isBlack: true },
];
const TOP_WHITES: KeyDef[] = [
  { label: 'A', note: 60, isBlack: false },
  { label: 'S', note: 62, isBlack: false },
  { label: 'D', note: 64, isBlack: false },
  { label: 'F', note: 65, isBlack: false },
  { label: 'G', note: 67, isBlack: false },
  { label: 'H', note: 69, isBlack: false },
  { label: 'J', note: 71, isBlack: false },
  { label: 'K', note: 72, isBlack: false },
];
const TOP_BLACKS: KeyDef[] = [
  { label: '2', note: 61, isBlack: true },
  { label: '3', note: 63, isBlack: true },
  { label: '5', note: 66, isBlack: true },
  { label: '6', note: 68, isBlack: true },
  { label: '7', note: 70, isBlack: true },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

const BLACK_AFTER = [0, 1, 3, 4, 5];

// ── Palette ────────────────────────────────────────────────────

const P = {
  bg:          '#08080d',
  panel:       '#111119',
  panelBorder: '#1c1c2a',
  surface:     '#191926',
  accent:      '#7c5bf5',
  accentGlow:  '#9b7ff7',
  accentDim:   '#5b3fd4',
  textHi:      '#eaeaf4',
  textMid:     '#8888a4',
  textLo:      '#55556e',
  whiteKey:    '#e8e8f0',
  whiteHover:  '#dddde8',
  whitePress:  '#d0d0dc',
  whiteActive: '#c4bef8',
  blackKey:    '#1a1a28',
  blackHover:  '#222234',
  blackPress:  '#2a2a3e',
  blackActive: '#7c5bf5',
  sliderTrack: '#1a1a28',
  sliderFill:  '#7c5bf5',
};

// ── Waveform Selector ──────────────────────────────────────────

const WF_LABELS: Record<string, string> = { sine: 'SIN', saw: 'SAW', square: 'SQR', triangle: 'TRI' };

function WaveformButton({ wf, selected, onSelect }: {
  wf: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <Pressable onPress={onSelect}
      style={(s) => ({
        backgroundColor: selected ? P.accent : s.hovered ? P.surface : 'transparent',
        paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
        borderRadius: 5,
      })}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? '#fff' : P.textMid }}>
        {WF_LABELS[wf] || wf}
      </Text>
    </Pressable>
  );
}

// ── Vertical Slider ────────────────────────────────────────────

function ParamSlider({ label, value, min = 0, max = 1, onChange, format }: {
  label: string; value: number; min?: number; max?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const H = 64;
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fill = Math.round(frac * H);
  const text = format ? format(value) : value.toFixed(2);
  const startRef = useRef(0);

  return (
    <Box style={{ alignItems: 'center', gap: 4, width: 44 }}>
      <Text style={{ fontSize: 9, color: P.textLo, fontWeight: '700' }}>{label}</Text>
      <Box
        style={{ width: 6, height: H, backgroundColor: P.sliderTrack, borderRadius: 3, justifyContent: 'flex-end' }}
        onDragStart={() => { startRef.current = value; }}
        onDrag={(e: any) => {
          const d = -(e.totalDeltaY || 0) / H;
          onChange(Math.max(min, Math.min(max, startRef.current + d * (max - min))));
        }}
      >
        <Box style={{ width: 6, height: fill, backgroundColor: P.sliderFill, borderRadius: 3 }} />
      </Box>
      <Text style={{ fontSize: 9, color: P.textMid }}>{text}</Text>
    </Box>
  );
}

// ── Piano Keyboard ─────────────────────────────────────────────

const KEY_W = 44;
const KEY_H = 120;
const KEY_GAP = 2;
const BLACK_W = 28;
const BLACK_H = 72;

function WhiteKey({ keyDef, active, onDown, onUp }: {
  keyDef: KeyDef; active: boolean;
  onDown: () => void; onUp: () => void;
}) {
  return (
    <Pressable onPressIn={onDown} onPressOut={onUp}
      style={(s) => ({
        width: KEY_W, height: KEY_H,
        backgroundColor: active ? P.whiteActive : s.pressed ? P.whitePress : s.hovered ? P.whiteHover : P.whiteKey,
        borderRadius: 3,
        borderWidth: active ? 2 : 1,
        borderColor: active ? P.accent : '#c8c8d8',
        alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6,
      })}
    >
      <Text style={{ fontSize: 10, color: active ? P.accentDim : '#9999aa', fontWeight: '600' }}>
        {keyDef.label}
      </Text>
      <Text style={{ fontSize: 8, color: active ? P.accent : '#b0b0c0' }}>
        {noteName(keyDef.note)}
      </Text>
    </Pressable>
  );
}

function BlackKeyButton({ keyDef, active, onDown, onUp, ml }: {
  keyDef: KeyDef; active: boolean;
  onDown: () => void; onUp: () => void; ml: number;
}) {
  return (
    <Pressable onPressIn={onDown} onPressOut={onUp}
      style={(s) => ({
        width: BLACK_W, height: BLACK_H,
        marginLeft: ml,
        backgroundColor: active ? P.blackActive : s.pressed ? P.blackPress : s.hovered ? P.blackHover : P.blackKey,
        borderRadius: 3,
        borderWidth: active ? 2 : 1,
        borderColor: active ? P.accentGlow : '#2a2a3a',
        alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5,
      })}
    >
      <Text style={{ fontSize: 9, color: active ? '#fff' : '#555568', fontWeight: '600' }}>
        {keyDef.label}
      </Text>
    </Pressable>
  );
}

function computeBlackMargins(whiteCount: number): number[] {
  const margins: number[] = [];
  let cursor = 0;

  for (let i = 0; i < BLACK_AFTER.length; i++) {
    const afterIdx = BLACK_AFTER[i];
    if (afterIdx + 1 >= whiteCount) break;

    const leftWhiteCenter = afterIdx * (KEY_W + KEY_GAP) + KEY_W / 2;
    const rightWhiteCenter = (afterIdx + 1) * (KEY_W + KEY_GAP) + KEY_W / 2;
    const blackCenter = (leftWhiteCenter + rightWhiteCenter) / 2;
    const blackLeft = blackCenter - BLACK_W / 2;

    margins.push(blackLeft - cursor);
    cursor = blackLeft + BLACK_W;
  }
  return margins;
}

function KeyboardOctave({ whites, blacks, notes, onDown, onUp }: {
  whites: KeyDef[]; blacks: KeyDef[];
  notes: Record<string, { note: number; envelope: number }>;
  onDown: (k: string) => void; onUp: (k: string) => void;
}) {
  const totalW = whites.length * KEY_W + (whites.length - 1) * KEY_GAP;
  const blackMargins = computeBlackMargins(whites.length);

  return (
    <Box style={{ width: totalW, height: KEY_H }}>
      <Box style={{ flexDirection: 'row', gap: KEY_GAP }}>
        {whites.map((k) => {
          const id = k.label.toLowerCase();
          const a = notes[id];
          return <WhiteKey key={k.label} keyDef={k} active={!!a} onDown={() => onDown(id)} onUp={() => onUp(id)} />;
        })}
      </Box>

      <Box style={{ flexDirection: 'row', marginTop: -KEY_H, height: BLACK_H, zIndex: 1 }}>
        {blacks.map((k, i) => {
          const id = k.label.toLowerCase();
          const a = notes[id];
          return (
            <BlackKeyButton key={k.label} keyDef={k} active={!!a}
              onDown={() => onDown(id)} onUp={() => onUp(id)}
              ml={blackMargins[i] || 0}
            />
          );
        })}
      </Box>
    </Box>
  );
}

// ── Main App ───────────────────────────────────────────────────

const SYNTH_ID = 'synth';

// ── Rack initializer (fires once on mount) ─────────────────────
function RackInit({ rack, onReady }: { rack: ReturnType<typeof useRack>; onReady: () => void }) {
  useMount(() => {
    rack.addModule('polysynth', SYNTH_ID, {
      waveform: 'saw',
      attack: 0.01,
      decay: 0.15,
      sustain: 0.6,
      release: 0.4,
      volume: 0.5,
      octaveShift: 0,
    }).then(onReady);
  });
  return null;
}

export function App() {
  const audioReady = useAudioInit();
  const rack = useRack();
  const synth = useModule(SYNTH_ID);
  const [rackInitialized, setRackInitialized] = useState(false);

  // Extract state from the module
  const activeNotes = synth.activeNotes || {};
  const waveform = synth.params.waveform || 'saw';
  const attack = synth.params.attack || 0.01;
  const decay = synth.params.decay || 0.15;
  const sustain = synth.params.sustain || 0.6;
  const release = synth.params.release || 0.4;
  const volume = synth.params.volume || 0.5;
  const octaveShift = synth.params.octaveShift || 0;

  // Mouse-based note playing via RPC (keyboard notes are handled in Lua for zero latency)
  const rpcKeyNoteOn = useLoveRPC('audio:keyNoteOn');
  const rpcKeyNoteOff = useLoveRPC('audio:keyNoteOff');
  const rpcShiftOctave = useLoveRPC('audio:shiftOctave');

  const mouseNoteDown = useCallback((k: string) => {
    rpcKeyNoteOn({ moduleId: SYNTH_ID, key: k });
  }, [rpcKeyNoteOn]);

  const mouseNoteUp = useCallback((k: string) => {
    rpcKeyNoteOff({ moduleId: SYNTH_ID, key: k });
  }, [rpcKeyNoteOff]);

  const voiceCount = Object.keys(activeNotes).length;
  const oct = octaveShift / 12;
  const fmtTime = (v: number) => v < 0.1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(1)}s`;
  const fmtPct  = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: P.bg, padding: 16, gap: 12 }}>
      {audioReady && !rackInitialized && <RackInit rack={rack} onReady={() => setRackInitialized(true)} />}

      {/* ── Header ──────────────────────────────── */}
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box style={{ gap: 1 }}>
          <Text style={{ fontSize: 18, color: P.textHi, fontWeight: '700' }}>ReactJIT Synth</Text>
          <Text style={{ fontSize: 11, color: P.textLo }}>Type to play. Click keys or drag sliders.</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{
            flexDirection: 'row', gap: 4, alignItems: 'center',
            backgroundColor: P.panel, borderRadius: 5, borderWidth: 1, borderColor: P.panelBorder,
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
          }}>
            <Pressable onPress={() => rpcShiftOctave({ moduleId: SYNTH_ID, direction: -1 })}
              style={(s) => ({ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderRadius: 3, backgroundColor: s.hovered ? P.surface : 'transparent' })}
            >
              <Text style={{ fontSize: 13, color: P.textMid, fontWeight: '700' }}>-</Text>
            </Pressable>
            <Text style={{ fontSize: 11, color: P.textHi, fontWeight: '600' }}>
              {`Oct ${oct >= 0 ? '+' : ''}${oct}`}
            </Text>
            <Pressable onPress={() => rpcShiftOctave({ moduleId: SYNTH_ID, direction: 1 })}
              style={(s) => ({ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderRadius: 3, backgroundColor: s.hovered ? P.surface : 'transparent' })}
            >
              <Text style={{ fontSize: 13, color: P.textMid, fontWeight: '700' }}>+</Text>
            </Pressable>
          </Box>
          <Box style={{
            backgroundColor: voiceCount > 0 ? P.accentDim : P.panel,
            borderRadius: 5, borderWidth: 1, borderColor: voiceCount > 0 ? P.accent : P.panelBorder,
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
          }}>
            <Text style={{ fontSize: 10, color: voiceCount > 0 ? '#fff' : P.textLo, fontWeight: '600' }}>
              {`${voiceCount} voice${voiceCount !== 1 ? 's' : ''}`}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* ── Controls ────────────────────────────── */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
        <Box style={{ backgroundColor: P.panel, borderRadius: 6, borderWidth: 1, borderColor: P.panelBorder, padding: 10, gap: 6 }}>
          <Text style={{ fontSize: 9, color: P.textLo, fontWeight: '700' }}>WAVEFORM</Text>
          <Box style={{ flexDirection: 'row', gap: 4 }}>
            {(['sine', 'saw', 'square', 'triangle'] as const).map(wf => (
              <WaveformButton key={wf} wf={wf} selected={waveform === wf}
                onSelect={() => synth.setParam('waveform', wf)} />
            ))}
          </Box>
        </Box>
        <Box style={{ backgroundColor: P.panel, borderRadius: 6, borderWidth: 1, borderColor: P.panelBorder, padding: 10, gap: 6 }}>
          <Text style={{ fontSize: 9, color: P.textLo, fontWeight: '700' }}>ENVELOPE</Text>
          <Box style={{ flexDirection: 'row', gap: 2 }}>
            <ParamSlider label="ATK" value={attack}  min={0.001} max={2} onChange={(v) => synth.setParam('attack', v)}  format={fmtTime} />
            <ParamSlider label="DEC" value={decay}   min={0.001} max={2} onChange={(v) => synth.setParam('decay', v)}   format={fmtTime} />
            <ParamSlider label="SUS" value={sustain}  min={0}     max={1} onChange={(v) => synth.setParam('sustain', v)} format={fmtPct} />
            <ParamSlider label="REL" value={release} min={0.001} max={3} onChange={(v) => synth.setParam('release', v)} format={fmtTime} />
          </Box>
        </Box>
        <Box style={{ backgroundColor: P.panel, borderRadius: 6, borderWidth: 1, borderColor: P.panelBorder, padding: 10, gap: 6 }}>
          <Text style={{ fontSize: 9, color: P.textLo, fontWeight: '700' }}>VOLUME</Text>
          <ParamSlider label="VOL" value={volume} onChange={(v) => synth.setParam('volume', v)} format={fmtPct} />
        </Box>
      </Box>

      {/* ── Keyboard ────────────────────────────── */}
      <Box style={{
        backgroundColor: P.panel, borderRadius: 6, borderWidth: 1, borderColor: P.panelBorder,
        padding: 14, gap: 10, alignItems: 'center',
      }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: P.textLo, fontWeight: '700' }}>KEYBOARD</Text>
          <Text style={{ fontSize: 9, color: P.textLo }}>{`C${3 + oct} - C${5 + oct}`}</Text>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
          <Box style={{ gap: 3 }}>
            <Text style={{ fontSize: 8, color: P.textLo }}>{`C${3 + oct}`}</Text>
            <KeyboardOctave whites={BOTTOM_WHITES} blacks={BOTTOM_BLACKS}
              notes={activeNotes} onDown={mouseNoteDown} onUp={mouseNoteUp} />
          </Box>
          <Box style={{ gap: 3 }}>
            <Text style={{ fontSize: 8, color: P.textLo }}>{`C${4 + oct}`}</Text>
            <KeyboardOctave whites={TOP_WHITES} blacks={TOP_BLACKS}
              notes={activeNotes} onDown={mouseNoteDown} onUp={mouseNoteUp} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
