/**
 * whisper_bench.tsx — speak once, transcribe with every selected model.
 *
 * Captures audio via useVoiceInput (libfvad-segmented utterances). On each
 * speech-end edge, fires whisper.transcribe() in sequence against every
 * model in the picker and renders a results table:
 *
 *   model   |  text                 |  audio ms  |  inference ms  |  rt-x
 *   --------+-----------------------+------------+----------------+------
 *   tiny    | hello world           |    1320    |       180      | 7.3×
 *   base    | hello, world.         |    1320    |       310      | 4.3×
 *   small   | Hello, world.         |    1320    |       820      | 1.6×
 *
 * `rt-x` is realtime multiplier (audio_ms / inference_ms). >1 means
 * faster than realtime, <1 means slower.
 *
 * Importing this cart triggers `-Dhas-whisper=true` via the metafile gate
 * (because runtime/hooks/whisper.ts lands in the bundle), which compiles
 * libwhisper.so. Carts that just want VAD/capture stay lean.
 *
 * Setup:
 *   ./scripts/fetch-whisper-models      # tiny + base + small (~280 MB)
 *   ./scripts/dev whisper_bench         # or scripts/ship for production
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Row, Col, Text, Pressable, ScrollView } from '@reactjit/runtime/primitives';
import { useVoiceInput } from '../runtime/hooks/useVoiceInput';
import { transcribe, type TranscribeResult } from '../runtime/hooks/whisper';

// ── Models — paths under ~/.reactjit/models/ (fetched by scripts/fetch-whisper-models) ──

interface ModelDef { name: string; path: string; }

const MODELS: ModelDef[] = [
  { name: 'tiny.en-q5_1',   path: '~/.reactjit/models/ggml-tiny.en-q5_1.bin' },
  { name: 'base.en-q5_1',   path: '~/.reactjit/models/ggml-base.en-q5_1.bin' },
  { name: 'small.en-q5_1',  path: '~/.reactjit/models/ggml-small.en-q5_1.bin' },
  { name: 'medium.en-q5_1', path: '~/.reactjit/models/ggml-medium.en-q5_1.bin' },
];

// ── Colour tokens ─────────────────────────────────────────────────────

const C = {
  bg: '#08090d',
  surface: '#11141d',
  surfaceHi: '#181c28',
  border: '#222637',
  text: '#e7eaf3',
  dim: '#7a8294',
  amp: '#7dd3fc',
  vad: '#22c55e',
  hot: '#fb7185',
  warn: '#fbbf24',
};

// ── Per-utterance row of model results ────────────────────────────────

interface UtteranceRow {
  id: number;
  audioMs: number;
  // Plain Record + array — Set/Map lazy init doesn't survive this
  // runtime's state serialisation cleanly. Tiny model lists; perf is fine.
  results: Record<string, TranscribeResult | { error: string }>;
  pending: string[];
}

// ── UI bits ───────────────────────────────────────────────────────────

function Cell({ children, color = C.text, width, monospace = false }: {
  children: React.ReactNode;
  color?: string;
  width?: number;
  monospace?: boolean;
}) {
  return (
    <Box style={{ width, paddingHorizontal: 8, paddingVertical: 6 }}>
      <Text fontSize={11} color={color} fontFamily={monospace ? 'monospace' : undefined}>
        {children}
      </Text>
    </Box>
  );
}

function ChipPicker<T extends string | number>({ label, options, selected, onToggle, render }: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Text fontSize={11} color={C.dim} style={{ width: 80 }}>{label}</Text>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {options.map((opt, i) => {
          const active = selected.indexOf(opt) >= 0;
          return (
            <Pressable
              key={i}
              onPress={() => onToggle(opt)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: active ? C.amp : C.surfaceHi,
                borderWidth: 1,
                borderColor: active ? C.amp : C.border,
              }}
            >
              <Text fontSize={11} color={active ? '#0b1220' : C.text}>{render(opt)}</Text>
            </Pressable>
          );
        })}
      </Row>
    </Row>
  );
}

// ── Cart root ────────────────────────────────────────────────────────

export default function WhisperBench() {
  const [active, setActive] = useState<string[]>(['tiny.en-q5_1', 'base.en-q5_1']);
  const [armed, setArmed] = useState(false);
  const [rows, setRows] = useState<UtteranceRow[]>([]);
  const lastIdRef = useRef(0);

  // mode 1 + -30dB floor — same calibration as voice_lab.
  // autoRelease:false because we run multiple transcribes against the
  // same PCM buffer; the cart releases manually after the loop finishes.
  const v = useVoiceInput({ mode: 1, floor: 0.5, autoRelease: false });

  useEffect(() => {
    if (armed) v.start();
    else v.stop();
  }, [armed]);

  // On speech-end, fan out to every selected model.
  useEffect(() => {
    if (v.utteranceId === 0 || v.utteranceId === lastIdRef.current) return;
    lastIdRef.current = v.utteranceId;
    const id = v.utteranceId;
    const audioMs = v.utteranceMs;
    const selected = active.slice();

    const newRow: UtteranceRow = {
      id, audioMs,
      results: {},
      pending: selected.slice(),
    };
    setRows((prev) => [newRow, ...prev].slice(0, 8));

    // Run sequentially — whisper holds one context at a time, switching
    // models reloads ~1-3s per swap. Sequential keeps the bench honest.
    (async () => {
      const G = globalThis as any;
      for (const name of selected) {
        const model = MODELS.find((m) => m.name === name);
        if (!model) continue;
        try {
          const result = await transcribe(id, model.path);
          setRows((prev) => prev.map((r) => {
            if (r.id !== id) return r;
            return {
              ...r,
              results: { ...r.results, [name]: result },
              pending: r.pending.filter((n) => n !== name),
            };
          }));
        } catch (e: any) {
          setRows((prev) => prev.map((r) => {
            if (r.id !== id) return r;
            return {
              ...r,
              results: { ...r.results, [name]: { error: String(e?.message ?? e) } },
              pending: r.pending.filter((n) => n !== name),
            };
          }));
        }
      }
      // All models done — release the PCM buffer in the voice subsystem.
      const rel = G.__voice_release_buffer;
      if (typeof rel === 'function') rel(id);
    })();
  }, [v.utteranceId]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: C.bg, padding: 18, gap: 14 }}>

      <Col style={{ gap: 4 }}>
        <Text fontSize={18} color={C.text}>Whisper Bench</Text>
        <Text fontSize={11} color={C.dim}>
          Speak once, transcribe with every selected model. Compares accuracy + speed on the same audio.
          Models live in ~/.reactjit/models/ — run ./scripts/fetch-whisper-models first.
        </Text>
      </Col>

      <Col style={{ gap: 12, padding: 14, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
        <ChipPicker
          label="Models"
          options={MODELS.map((m) => m.name)}
          selected={active}
          onToggle={(n) => setActive((prev) =>
            prev.indexOf(n) >= 0 ? prev.filter((x) => x !== n) : [...prev, n]
          )}
          render={(n) => n}
        />

        <Pressable
          onPress={() => setArmed((x) => !x)}
          style={{
            height: 44,
            borderRadius: 8,
            backgroundColor: armed ? C.vad : C.surfaceHi,
            borderWidth: 1,
            borderColor: armed ? C.vad : C.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text fontSize={13} color={armed ? '#0b1220' : C.text}>
            {armed ? '◉ listening — speak a phrase, then pause' : '○ tap to start listening'}
          </Text>
        </Pressable>

        <Row style={{ gap: 10, alignItems: 'center' }}>
          <Box style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
            backgroundColor: v.isSpeaking ? C.vad : C.surfaceHi,
            borderWidth: 1, borderColor: v.isSpeaking ? C.vad : C.border,
          }}>
            <Text fontSize={10} color={v.isSpeaking ? '#0b1220' : C.dim}>
              {v.isSpeaking ? 'speaking' : 'silent'}
            </Text>
          </Box>
          <Text fontSize={10} color={C.dim}>
            {`level=${v.level.toFixed(2)} · last utterance: ${v.utteranceId === 0 ? '—' : `#${v.utteranceId} (${v.utteranceMs.toFixed(0)} ms)`}`}
          </Text>
        </Row>
      </Col>

      <Col style={{
        flexGrow: 1,
        gap: 0,
        padding: 14,
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
      }}>
        <Row style={{ gap: 0, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.border }}>
          <Cell width={80} color={C.dim}>utt #</Cell>
          <Cell width={150} color={C.dim}>model</Cell>
          <Cell width={80} color={C.dim}>audio</Cell>
          <Cell width={100} color={C.dim}>inference</Cell>
          <Cell width={70} color={C.dim}>rt-x</Cell>
          <Cell color={C.dim}>transcript</Cell>
        </Row>

        <ScrollView style={{ flexGrow: 1 }}>
          {rows.length === 0 ? (
            <Box style={{ padding: 14 }}>
              <Text fontSize={11} color={C.dim}>
                {armed ? '— waiting for speech —' : '— tap to start, then say something —'}
              </Text>
            </Box>
          ) : rows.map((row) => (
            <Col key={row.id} style={{ gap: 0 }}>
              {active.map((name, i) => {
                const r = row.results[name];
                const isPending = row.pending.indexOf(name) >= 0;
                let text = '…';
                let inferStr = '—';
                let rtx = '—';
                let color = C.dim;
                if (isPending) {
                  text = 'transcribing…';
                  color = C.warn;
                } else if (r && 'error' in r) {
                  text = `error: ${r.error}`;
                  color = C.hot;
                } else if (r && 'text' in r) {
                  text = r.text || '(empty)';
                  inferStr = `${r.elapsedMs} ms`;
                  rtx = r.elapsedMs > 0 ? `${(row.audioMs / r.elapsedMs).toFixed(1)}×` : '∞';
                  color = r.success ? C.text : C.hot;
                }
                return (
                  <Row key={`${row.id}-${name}`} style={{
                    gap: 0,
                    paddingVertical: 4,
                    backgroundColor: i % 2 === 0 ? C.bg : 'transparent',
                  }}>
                    <Cell width={80} color={C.dim}>{i === 0 ? `#${row.id}` : ''}</Cell>
                    <Cell width={150} monospace>{name}</Cell>
                    <Cell width={80} color={C.dim}>{i === 0 ? `${row.audioMs.toFixed(0)} ms` : ''}</Cell>
                    <Cell width={100} color={C.dim} monospace>{inferStr}</Cell>
                    <Cell width={70} color={C.amp} monospace>{rtx}</Cell>
                    <Cell color={color}>{text}</Cell>
                  </Row>
                );
              })}
            </Col>
          ))}
        </ScrollView>
      </Col>

    </Col>
  );
}
