/**
 * useVoiceInput — microphone capture + WebRTC VAD as a one-line hook.
 *
 * Hardware path is in framework/voice.zig (SDL3 mic → libfvad → utterance
 * state machine). This hook just watches the bridge globals it installs and
 * exposes a React-friendly surface.
 *
 * ── What you get back ──────────────────────────────────────────────────
 *   isListening   true between start() and stop()
 *   isSpeaking    true between speech-start and speech-end edges
 *   level         live RMS, 0..1 (square-rooted from int16 amplitude)
 *   transcript    last full-utterance text. Empty until whisper lands —
 *                 the speech-end event already fires; the transcript fills
 *                 once framework/whisper integration ships. Edits cleanly
 *                 once whisper arrives without changing the cart contract.
 *   utteranceId   id of the last finalised PCM buffer in the Zig store.
 *                 Whisper integration consumes this; carts can pass it to
 *                 a "transcribe(id)" hook once that exists.
 *   start()       opens the default recording device, begins streaming
 *   stop()        closes the device, finalises any in-flight utterance
 *
 * ── Aggressiveness ─────────────────────────────────────────────────────
 *   { mode: 0..3 } — libfvad VAD aggressiveness. 2 (default) = "aggressive",
 *   the best general-purpose setting per upstream docs. Bump to 3 if
 *   ambient noise is high; drop to 0/1 in studio-quiet rooms.
 *
 * ── Hold-to-talk vs always-on ──────────────────────────────────────────
 * Both shapes work today. Hold-to-talk: call start() onMouseDown, stop()
 * onMouseUp, ignore the speech-start/end edges. Always-on: call start()
 * once on mount, react to speech-start/end and dispatch each utterance.
 *
 * @example  hold-to-talk
 *   const v = useVoiceInput();
 *   <Pressable
 *     onPressIn={v.start}
 *     onPressOut={v.stop}
 *   ><Text>{v.isListening ? 'listening…' : 'hold to talk'}</Text></Pressable>
 *
 * @example  always-on with transcription
 *   const v = useVoiceInput();
 *   useEffect(() => { v.start(); return () => v.stop(); }, []);
 *   useEffect(() => {
 *     if (v.transcript) console.log('heard:', v.transcript);
 *   }, [v.transcript]);
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Bridge globals (installed by framework/voice.zig + v8_bindings_voice) ─

declare const globalThis: any;

// Install the receiving callbacks once (idempotent — same pattern as useIFTTT
// guarding with __ifttt_handlers_installed). All hook instances share the
// same upstream events; per-hook subscription happens via a tiny in-module
// pub-sub table below.

type Handler = (payload?: any) => void;

const subs = {
  level: new Set<Handler>(),
  speechStart: new Set<Handler>(),
  speechEnd: new Set<Handler>(),
  transcript: new Set<Handler>(),
};

function emit(set: Set<Handler>, payload?: any) {
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch (e: any) {
      console.error('[voice] handler error:', e?.message || e);
    }
  }
}

const G = globalThis;
if (!G.__voice_handlers_installed) {
  G.__voice_handlers_installed = true;
  G.__voice_onLevel = (rms_x100: number) => {
    // Zig sends 0..10000 (×100 of 0..100). Normalise to 0..1.
    emit(subs.level, Math.max(0, Math.min(1, rms_x100 / 10000)));
  };
  G.__voice_onSpeechStart = () => emit(subs.speechStart);
  G.__voice_onSpeechEnd = (id: number, lenSamples: number) => {
    emit(subs.speechEnd, { id, lenSamples, durationMs: (lenSamples / 16000) * 1000 });
  };
  G.__voice_onTranscript = (text: string) => emit(subs.transcript, text);
}

// ── Public types ─────────────────────────────────────────────────────────

export interface VoiceInputResult {
  isListening: boolean;
  isSpeaking: boolean;
  level: number;            // 0..1
  transcript: string;       // last finalised utterance (whisper). '' until then.
  utteranceId: number;      // 0 until first speech-end
  utteranceMs: number;      // duration of the last finalised utterance
  start: () => boolean;
  stop: () => void;
}

export interface VoiceInputOptions {
  /** libfvad aggressiveness 0..3. Default 2 ("aggressive"). */
  mode?: 0 | 1 | 2 | 3;
  /** Free the captured PCM buffer after speech-end. Default true; set false
   *  if you want to call a transcribe-by-id helper before it's freed. */
  autoRelease?: boolean;
}

// ── The hook ─────────────────────────────────────────────────────────────

export function useVoiceInput(opts: VoiceInputOptions = {}): VoiceInputResult {
  const [isListening, setListening] = useState(false);
  const [isSpeaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [utterance, setUtterance] = useState({ id: 0, ms: 0 });

  const autoRelease = opts.autoRelease !== false;
  const autoReleaseRef = useRef(autoRelease);
  autoReleaseRef.current = autoRelease;

  // Mode application: re-apply on change (cheap, fvad_set_mode only flips an int).
  useEffect(() => {
    const fn = G.__voice_set_mode;
    if (typeof fn === 'function') fn(opts.mode ?? 2);
  }, [opts.mode]);

  // Subscribe to bridge events for this instance's lifetime.
  useEffect(() => {
    const onLevel: Handler = (v) => setLevel(v);
    const onSpeechStart: Handler = () => setSpeaking(true);
    const onSpeechEnd: Handler = (e: { id: number; lenSamples: number; durationMs: number }) => {
      setSpeaking(false);
      setUtterance({ id: e.id, ms: e.durationMs });
      if (autoReleaseRef.current) {
        const rel = G.__voice_release_buffer;
        if (typeof rel === 'function') rel(e.id);
      }
    };
    const onTranscript: Handler = (text) => setTranscript(String(text ?? ''));

    subs.level.add(onLevel);
    subs.speechStart.add(onSpeechStart);
    subs.speechEnd.add(onSpeechEnd);
    subs.transcript.add(onTranscript);
    return () => {
      subs.level.delete(onLevel);
      subs.speechStart.delete(onSpeechStart);
      subs.speechEnd.delete(onSpeechEnd);
      subs.transcript.delete(onTranscript);
    };
  }, []);

  const start = useCallback(() => {
    const fn = G.__voice_start;
    if (typeof fn !== 'function') {
      console.warn('[voice] __voice_start missing — was -Dhas-voice=true set?');
      return false;
    }
    const ok = !!fn();
    if (ok) setListening(true);
    return ok;
  }, []);

  const stop = useCallback(() => {
    const fn = G.__voice_stop;
    if (typeof fn === 'function') fn();
    setListening(false);
    setSpeaking(false);
    setLevel(0);
  }, []);

  return {
    isListening,
    isSpeaking,
    level,
    transcript,
    utteranceId: utterance.id,
    utteranceMs: utterance.ms,
    start,
    stop,
  };
}
