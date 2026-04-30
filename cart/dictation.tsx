/**
 * dictation.tsx — voice-to-text via 3-model ROVER ensemble.
 *
 * Speak a phrase; watch tiny lay down a fast preview, then the ensemble
 * tightens up as base and small finish. Words are coloured by vote
 * count: dimmer = less confidence, brighter = full agreement.
 *
 * Setup:
 *   ./scripts/fetch-whisper-models             # tiny + base + small
 *   ./scripts/dev dictation
 */

import { useEffect, useState } from 'react';
import { Box, Row, Col, Text, Pressable, ScrollView } from '@reactjit/runtime/primitives';
import { useEnsembleTranscript } from '../runtime/hooks/useEnsembleTranscript';

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

// Vote-count → text shade. With 3 models: 1 = low confidence, 3 = full
// agreement. Dim words signal "verify this; only one model said it."
const SHADES = ['#475569', '#94a3b8', '#cbd5e1', '#f8fafc'];

const MODELS = [
  { name: 'tiny',  path: '~/.reactjit/models/ggml-tiny.en-q5_1.bin'  },
  { name: 'base',  path: '~/.reactjit/models/ggml-base.en-q5_1.bin'  },
  { name: 'small', path: '~/.reactjit/models/ggml-small.en-q5_1.bin' },
];

interface SavedUtterance {
  id: number;
  ms: number;
  individual: Record<string, string>;
  ensembleWords: { word: string; votes: number; sources: string[] }[];
  anchor: string;
}

export default function Dictation() {
  const [armed, setArmed] = useState(false);
  const [history, setHistory] = useState<SavedUtterance[]>([]);

  const e = useEnsembleTranscript({
    models: MODELS,
    mode: 1,
    floor: 0.333,
  });

  // Snapshot completed utterances so they don't get clobbered when the
  // hook resets for the next phrase.
  useEffect(() => {
    if (e.isProcessing) return;
    if (!e.ensemble) return;
    if (e.utteranceId === 0) return;
    if (history.some((h) => h.id === e.utteranceId)) return;
    setHistory((prev) => [{
      id: e.utteranceId,
      ms: e.utteranceMs,
      individual: { ...e.individual },
      ensembleWords: e.ensemble!.words.slice(),
      anchor: e.ensemble!.anchor,
    }, ...prev].slice(0, 6));
  }, [e.isProcessing, e.utteranceId]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: C.bg, padding: 18, gap: 14 }}>

      <Col style={{ gap: 4 }}>
        <Text fontSize={18} color={C.text}>Dictation — 3-model ensemble</Text>
        <Text fontSize={11} color={C.dim}>
          Speak a phrase. tiny lays down a fast preview, then base and small vote on each word.
          Brighter words = more model agreement. Dim words mean only one model produced them.
        </Text>
      </Col>

      <Pressable
        onPress={() => {
          if (armed) e.stop();
          else e.start();
          setArmed((x) => !x);
        }}
        style={{
          height: 48,
          borderRadius: 8,
          backgroundColor: armed ? C.vad : C.surfaceHi,
          borderWidth: 1,
          borderColor: armed ? C.vad : C.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text fontSize={13} color={armed ? '#0b1220' : C.text}>
          {armed ? '◉ listening — speak, then pause' : '○ tap to start dictating'}
        </Text>
      </Pressable>

      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Box style={{
          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
          backgroundColor: e.isSpeaking ? C.vad : C.surfaceHi,
          borderWidth: 1, borderColor: e.isSpeaking ? C.vad : C.border,
        }}>
          <Text fontSize={10} color={e.isSpeaking ? '#0b1220' : C.dim}>
            {e.isSpeaking ? 'speaking' : 'silent'}
          </Text>
        </Box>
        {e.isProcessing && (
          <Box style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
            backgroundColor: C.warn, borderWidth: 1, borderColor: C.warn,
          }}>
            <Text fontSize={10} color="#0b1220">transcribing…</Text>
          </Box>
        )}
        <Text fontSize={10} color={C.dim}>{`level=${e.level.toFixed(2)}`}</Text>
      </Row>

      {/* Live preview row: shows tiny first, then ensemble tightens up */}
      <Col style={{
        gap: 10,
        padding: 16,
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
        minHeight: 110,
      }}>
        <Text fontSize={10} color={C.dim}>live</Text>
        {e.ensemble ? (
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {e.ensemble.words.map((w, i) => {
              const max = e.ensemble!.modelCount;
              const shade = SHADES[Math.min(SHADES.length - 1, Math.round((w.votes / max) * (SHADES.length - 1)))];
              return (
                <Text key={i} fontSize={18} color={shade}>{w.word}</Text>
              );
            })}
          </Row>
        ) : e.partial ? (
          <Text fontSize={18} color={SHADES[1]}>{e.partial}</Text>
        ) : (
          <Text fontSize={14} color={C.dim}>
            {armed ? '— waiting for speech —' : '— tap to start, then say something —'}
          </Text>
        )}

        {e.ensemble && (
          <Row style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.entries(e.individual).map(([name, text]) => (
              <Row key={name} style={{ gap: 6, alignItems: 'baseline' }}>
                <Text fontSize={9} color={C.dim} style={{ width: 36 }}>{name}</Text>
                <Text fontSize={11} color={C.dim} fontFamily="monospace">{text || '…'}</Text>
              </Row>
            ))}
            <Text fontSize={9} color={C.dim}>{`anchor=${e.ensemble.anchor}`}</Text>
          </Row>
        )}
      </Col>

      {/* History */}
      <Col style={{
        flexGrow: 1,
        gap: 0,
        padding: 14,
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
      }}>
        <Text fontSize={10} color={C.dim} style={{ marginBottom: 8 }}>history</Text>
        <ScrollView style={{ flexGrow: 1 }}>
          {history.length === 0 ? (
            <Text fontSize={11} color={C.dim}>— nothing yet —</Text>
          ) : history.map((h) => (
            <Col key={h.id} style={{
              gap: 6,
              padding: 12,
              marginBottom: 8,
              backgroundColor: C.bg,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: C.border,
            }}>
              <Row style={{ flexWrap: 'wrap', gap: 5 }}>
                {h.ensembleWords.map((w, i) => {
                  const shade = SHADES[Math.min(SHADES.length - 1, Math.round((w.votes / 3) * (SHADES.length - 1)))];
                  return (
                    <Text key={i} fontSize={14} color={shade}>{w.word}</Text>
                  );
                })}
              </Row>
              <Row style={{ gap: 14, flexWrap: 'wrap' }}>
                {Object.entries(h.individual).map(([name, text]) => (
                  <Row key={name} style={{ gap: 6, alignItems: 'baseline' }}>
                    <Text fontSize={9} color={C.dim} style={{ width: 36 }}>{name}</Text>
                    <Text fontSize={10} color={C.dim} fontFamily="monospace">{text}</Text>
                  </Row>
                ))}
                <Text fontSize={9} color={C.dim}>{`#${h.id} · ${h.ms.toFixed(0)}ms · anchor=${h.anchor}`}</Text>
              </Row>
            </Col>
          ))}
        </ScrollView>
      </Col>

    </Col>
  );
}
