/**
 * voice_lab.tsx — mic + WebRTC VAD smoke cart.
 *
 * Two interaction shapes side by side:
 *   - Hold-to-talk button (left): start on press, stop on release. Watch the
 *     level meter and "speaking now / silent" pill animate live.
 *   - Always-on toggle (right): start once, observe automatic utterance
 *     boundaries fired by libfvad (rejects mouth clicks via 90ms minimum,
 *     closes utterances after 750ms of silence).
 *
 * Whisper isn't wired yet — `transcript` stays empty. Once whisper.cpp ships,
 * this same cart will show live transcripts without a code change here.
 *
 * Run: ./scripts/dev voice_lab    (dev host force-enables -Dhas-voice=true)
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Row, Col, Text, Pressable } from '@reactjit/runtime/primitives';
import { useVoiceInput } from '../runtime/hooks/useVoiceInput';

// ── Colour tokens (cart-local — theme isn't being touched in duct-tape mode) ──
const C = {
  bg: '#08090d',
  surface: '#11141d',
  surfaceHi: '#181c28',
  border: '#222637',
  text: '#e7eaf3',
  dim: '#7a8294',
  accent: '#7dd3fc',
  hot: '#fb7185',
  speakOn: '#22c55e',
  speakOff: '#475569',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function LevelMeter({ level, isSpeaking }: { level: number; isSpeaking: boolean }) {
  // 32 segment bar. Cheap & legible at any size.
  const segs = 32;
  const lit = Math.round(level * segs);
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < segs; i++) {
    const on = i < lit;
    const colour = on ? (isSpeaking ? C.speakOn : C.accent) : C.surfaceHi;
    cells.push(
      <Box key={i} style={{
        flexGrow: 1,
        height: 18,
        backgroundColor: colour,
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

// ── Hold-to-talk panel ────────────────────────────────────────────────────

function HoldToTalk() {
  const v = useVoiceInput({ mode: 2 });
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
      <Text fontSize={10} color={C.dim}>Press and hold the button. VAD edges show on the meter — release to close the utterance.</Text>

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

      <Row style={{ gap: 8, alignItems: 'center' }}>
        <StatePill on={v.isListening} label={v.isListening ? 'mic open' : 'mic idle'} color={C.accent} />
        <StatePill on={v.isSpeaking} label={v.isSpeaking ? 'speaking' : 'silent'} color={C.speakOn} />
        <Text fontSize={10} color={C.dim}>{`level=${v.level.toFixed(2)}`}</Text>
      </Row>

      <LevelMeter level={v.level} isSpeaking={v.isSpeaking} />

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

function AlwaysOn() {
  const v = useVoiceInput({ mode: 2 });
  const [armed, setArmed] = useState(false);
  const [history, setHistory] = useState<{ id: number; ms: number; text: string }[]>([]);
  const lastIdRef = useRef(0);

  useEffect(() => {
    if (armed) v.start(); else v.stop();
  }, [armed]);

  // Append on every speech-end edge (utteranceId increments).
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
          backgroundColor: armed ? C.speakOn : C.surfaceHi,
          borderWidth: 1,
          borderColor: armed ? C.speakOn : C.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text fontSize={12} color={armed ? '#0b1220' : C.text}>
          {armed ? '◉ listening — tap to stop' : '○ tap to start listening'}
        </Text>
      </Pressable>

      <Row style={{ gap: 8, alignItems: 'center' }}>
        <StatePill on={v.isSpeaking} label={v.isSpeaking ? 'speaking' : 'silent'} color={C.speakOn} />
        <Text fontSize={10} color={C.dim}>{`level=${v.level.toFixed(2)}`}</Text>
      </Row>

      <LevelMeter level={v.level} isSpeaking={v.isSpeaking} />

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

export default function VoiceLab() {
  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: C.bg, padding: 18, gap: 14 }}>
      <Col style={{ gap: 4 }}>
        <Text fontSize={18} color={C.text}>Voice Lab</Text>
        <Text fontSize={11} color={C.dim}>
          SDL3 mic → libfvad (WebRTC VAD, mode 2) → utterance buffers. Whisper is next; transcripts will fill in once it lands.
        </Text>
      </Col>

      <Row style={{ flexGrow: 1, gap: 14 }}>
        <HoldToTalk />
        <AlwaysOn />
      </Row>
    </Col>
  );
}
