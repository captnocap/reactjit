/**
 * voice_lab.tsx — mic + WebRTC VAD smoke cart with three separate signals.
 *
 *   1. Amplitude meter   — peak-dBFS of the live audio (cyan).
 *   2. Raw VAD trace     — every 30ms libfvad verdict, last ~2s scrolling
 *                          (green = speech-like, gray = silent). NO debounce.
 *   3. Speaking pill     — debounced utterance state (90ms speech-start /
 *                          750ms silence-end). The thing the hook actually
 *                          uses to chunk audio for whisper.
 *
 * Why three: the level meter reacts to anything loud (typing, fan), the raw
 * trace shows what libfvad's GMM thinks of each frame, and the pill shows the
 * post-debounce decision. Watching all three side-by-side makes "did the VAD
 * misfire on my keyboard" trivially answerable.
 *
 * Run: ./scripts/dev voice_lab    (dev host force-enables -Dhas-voice=true)
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Row, Col, Text, Pressable } from '@reactjit/runtime/primitives';
import {
  useVoiceInput,
  subscribeRawVadFrame,
  subscribeRawLevel,
} from '../runtime/hooks/useVoiceInput';

// ── Colour tokens ─────────────────────────────────────────────────────────
const C = {
  bg: '#08090d',
  surface: '#11141d',
  surfaceHi: '#181c28',
  border: '#222637',
  text: '#e7eaf3',
  dim: '#7a8294',
  amp: '#7dd3fc',     // cyan — amplitude
  vad: '#22c55e',     // green — VAD speech verdict
  hot: '#fb7185',
};

const TRACE_CELLS = 64; // ~1.9s of 30ms frames

// ── Visualisers ───────────────────────────────────────────────────────────

function AmplitudeBar({ level }: { level: number }) {
  const segs = 32;
  const lit = Math.round(level * segs);
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < segs; i++) {
    cells.push(
      <Box key={i} style={{
        flexGrow: 1,
        height: 18,
        backgroundColor: i < lit ? C.amp : C.surfaceHi,
        marginHorizontal: 1,
        borderRadius: 2,
      }} />,
    );
  }
  return <Row style={{ width: '100%' }}>{cells}</Row>;
}

function VadTrace({ trace }: { trace: number[] }) {
  // Render most-recent on the right, scrolling left.
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < TRACE_CELLS; i++) {
    const v = trace[i] ?? 0;
    cells.push(
      <Box key={i} style={{
        flexGrow: 1,
        height: 18,
        backgroundColor: v ? C.vad : C.surfaceHi,
        marginHorizontal: 1,
        borderRadius: 2,
      }} />,
    );
  }
  return <Row style={{ width: '100%' }}>{cells}</Row>;
}

function StatePill({ on, label, color }: { on: boolean; label: string; color: string }) {
  return (
    <Box style={{
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: on ? color : C.surfaceHi,
      borderWidth: 1,
      borderColor: on ? color : C.border,
    }}>
      <Text fontSize={10} color={on ? '#0b1220' : C.dim}>{label}</Text>
    </Box>
  );
}

// ── Trace panel — drives the raw VAD strip + amplitude trace ─────────────

function VisualiserStack({ v, mode }: { v: ReturnType<typeof useVoiceInput>; mode: 0 | 1 | 2 | 3 }) {
  // Two ring buffers, pushed on every Zig event (subscribe path bypasses
  // React state-bail-out so identical-in-a-row values still register).
  const [vadTrace, setVadTrace] = useState<number[]>(() => Array(TRACE_CELLS).fill(0));
  const [ampTrace, setAmpTrace] = useState<number[]>(() => Array(TRACE_CELLS).fill(0));

  useEffect(() => {
    if (!v.isListening) return;
    const offV = subscribeRawVadFrame((val) => {
      setVadTrace((prev) => {
        const next = prev.slice(1);
        next.push(val);
        return next;
      });
    });
    const offA = subscribeRawLevel((lvl) => {
      setAmpTrace((prev) => {
        const next = prev.slice(1);
        next.push(lvl);
        return next;
      });
    });
    return () => { offV(); offA(); };
  }, [v.isListening]);

  // Speech-frame-density readout — what fraction of the visible window
  // libfvad called speech. Zero = clean rejection of whatever's happening.
  const speechFrac = vadTrace.reduce((a, b) => a + b, 0) / TRACE_CELLS;

  return (
    <Col style={{ gap: 14 }}>

      <Col style={{ gap: 4 }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={C.amp}>amplitude</Text>
          <Text fontSize={10} color={C.dim}>{`peak-dBFS · live=${v.level.toFixed(2)}`}</Text>
        </Row>
        <AmplitudeBar level={v.level} />
      </Col>

      <Col style={{ gap: 4 }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={C.vad}>raw VAD</Text>
          <Text fontSize={10} color={C.dim}>{`per-30ms libfvad mode ${mode} · ${(speechFrac * 100).toFixed(0)}% of window`}</Text>
        </Row>
        <VadTrace trace={vadTrace} />
      </Col>

      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Text fontSize={10} color={C.dim}>debounced</Text>
        <StatePill on={v.isListening} label={v.isListening ? 'mic open' : 'mic idle'} color={C.amp} />
        <StatePill on={v.isSpeaking} label={v.isSpeaking ? 'speaking' : 'silent'} color={C.vad} />
      </Row>
    </Col>
  );
}

// ── Hold-to-talk panel ────────────────────────────────────────────────────

function HoldToTalk({ mode, floor }: { mode: 0 | 1 | 2 | 3; floor: number }) {
  const v = useVoiceInput({ mode, floor });
  const [pressed, setPressed] = useState(false);

  return (
    <Col style={{
      flexGrow: 1,
      gap: 12,
      padding: 18,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
    }}>
      <Text fontSize={14} color={C.text}>Hold-to-talk</Text>
      <Text fontSize={10} color={C.dim}>Press and hold. Watch all three signals — keyboard should bump amplitude only.</Text>

      <Pressable
        onPressIn={() => { setPressed(true); v.start(); }}
        onPressOut={() => { setPressed(false); v.stop(); }}
        style={{
          height: 64,
          borderRadius: 10,
          backgroundColor: pressed ? C.hot : C.surfaceHi,
          borderWidth: 1,
          borderColor: pressed ? C.hot : C.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text fontSize={14} color={pressed ? '#0b1220' : C.text}>
          {pressed ? '🔴 release to send' : 'hold to talk'}
        </Text>
      </Pressable>

      <VisualiserStack v={v} mode={mode} />

      <Box style={{
        padding: 10,
        backgroundColor: C.bg,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.border,
      }}>
        <Text fontSize={10} color={C.dim}>last utterance</Text>
        <Text fontSize={11} color={C.text}>
          {v.utteranceId === 0
            ? '— none yet —'
            : `id ${v.utteranceId} • ${v.utteranceMs.toFixed(0)} ms${v.transcript ? ` • "${v.transcript}"` : ' (transcript pending whisper)'}`}
        </Text>
      </Box>
    </Col>
  );
}

// ── Always-on panel ───────────────────────────────────────────────────────

function AlwaysOn({ mode, floor }: { mode: 0 | 1 | 2 | 3; floor: number }) {
  const v = useVoiceInput({ mode, floor });
  const [armed, setArmed] = useState(false);
  const [history, setHistory] = useState<{ id: number; ms: number; text: string }[]>([]);
  const lastIdRef = useRef(0);

  useEffect(() => {
    if (armed) v.start(); else v.stop();
  }, [armed]);

  useEffect(() => {
    if (v.utteranceId === 0 || v.utteranceId === lastIdRef.current) return;
    lastIdRef.current = v.utteranceId;
    setHistory((prev) => {
      const next = prev.slice(-7);
      next.push({ id: v.utteranceId, ms: v.utteranceMs, text: v.transcript });
      return next;
    });
  }, [v.utteranceId]);

  return (
    <Col style={{
      flexGrow: 1,
      gap: 12,
      padding: 18,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
    }}>
      <Text fontSize={14} color={C.text}>Always-on (auto-segmented)</Text>
      <Text fontSize={10} color={C.dim}>Toggle on, just talk. libfvad chunks each phrase between natural pauses.</Text>

      <Pressable
        onPress={() => setArmed((x) => !x)}
        style={{
          height: 40,
          borderRadius: 8,
          backgroundColor: armed ? C.vad : C.surfaceHi,
          borderWidth: 1,
          borderColor: armed ? C.vad : C.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text fontSize={12} color={armed ? '#0b1220' : C.text}>
          {armed ? '◉ listening — tap to stop' : '○ tap to start listening'}
        </Text>
      </Pressable>

      <VisualiserStack v={v} mode={mode} />

      <Col style={{ gap: 4, padding: 10, backgroundColor: C.bg, borderRadius: 6, borderWidth: 1, borderColor: C.border }}>
        <Text fontSize={10} color={C.dim}>recent utterances</Text>
        {history.length === 0 ? (
          <Text fontSize={11} color={C.dim}>{armed ? '— waiting for speech —' : '— inactive —'}</Text>
        ) : history.map((h) => (
          <Text key={h.id} fontSize={11} color={C.text}>
            {`#${h.id} ${h.ms.toFixed(0)}ms ${h.text || '(transcript pending whisper)'}`}
          </Text>
        ))}
      </Col>
    </Col>
  );
}

// ── Cart root ─────────────────────────────────────────────────────────────

// ── Settings bar — A/B mode + floor live ─────────────────────────────────

function ChipPicker<T>({ label, options, value, onPick, render }: {
  label: string;
  options: T[];
  value: T;
  onPick: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <Row style={{ gap: 8, alignItems: 'center' }}>
      <Text fontSize={10} color={C.dim} style={{ width: 60 }}>{label}</Text>
      <Row style={{ gap: 4 }}>
        {options.map((opt, i) => {
          const active = opt === value;
          return (
            <Pressable
              key={i}
              onPress={() => onPick(opt)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: active ? C.amp : C.surfaceHi,
                borderWidth: 1,
                borderColor: active ? C.amp : C.border,
              }}
            >
              <Text fontSize={10} color={active ? '#0b1220' : C.text}>{render(opt)}</Text>
            </Pressable>
          );
        })}
      </Row>
    </Row>
  );
}

const FLOOR_OPTS: { name: string; value: number }[] = [
  { name: 'off', value: 0 },
  { name: '−50 dB', value: 0.167 }, // (60-50)/60
  { name: '−40 dB', value: 0.333 },
  { name: '−30 dB', value: 0.5 },
  { name: '−20 dB', value: 0.667 },
];

export default function VoiceLab() {
  // Defaults from empirical room-test on HyperX USB mic (2026-04-29):
  // mode 1 + -30 dB floor was the sweet spot — robust to ambient and
  // typing without losing soft speech. Mode 3 alone also rejects typing
  // but can clip the front of quiet phrases.
  const [mode, setMode] = useState<0 | 1 | 2 | 3>(1);
  const [floorIdx, setFloorIdx] = useState(3); // -30 dB
  const floor = FLOOR_OPTS[floorIdx].value;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: C.bg, padding: 18, gap: 14 }}>
      <Col style={{ gap: 4 }}>
        <Text fontSize={18} color={C.text}>Voice Lab</Text>
        <Text fontSize={11} color={C.dim}>
          Three separate signals: amplitude (any loud sound), raw VAD (libfvad per-frame speech verdict), and the debounced "speaking" pill. A/B the mode + amplitude floor live to chase off keyboard false-positives.
        </Text>
      </Col>

      <Col style={{
        gap: 10,
        padding: 14,
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
      }}>
        <ChipPicker
          label="VAD mode"
          options={[0, 1, 2, 3] as const}
          value={mode}
          onPick={(v) => setMode(v as 0 | 1 | 2 | 3)}
          render={(v) => String(v)}
        />
        <ChipPicker
          label="Amp floor"
          options={FLOOR_OPTS.map((_, i) => i)}
          value={floorIdx}
          onPick={setFloorIdx}
          render={(i) => FLOOR_OPTS[i].name}
        />
      </Col>

      <Row style={{ flexGrow: 1, gap: 14 }}>
        <HoldToTalk mode={mode} floor={floor} />
        <AlwaysOn mode={mode} floor={floor} />
      </Row>
    </Col>
  );
}
