/**
 * VesperVoice — Kokoro TTS integration for Vesper.
 *
 * Watches for new messages from Vesper (dreams, mood changes, greetings)
 * and speaks them aloud using Kokoro TTS via shell:exec + Python.
 *
 * Requirements:
 *   - Python venv at .venv/ with kokoro-onnx, soundfile, numpy installed
 *   - Kokoro model files at ~/.cache/kokoro/
 *   - paplay or aplay available for audio playback
 *
 * This component renders nothing — it's a side-effect-only hook wrapper.
 */
import { useRef, useCallback } from 'react';
import { useLoveRPC } from '@reactjit/core';

const VENV_PYTHON = '/home/siah/creative/reactjit/claudeshome/.venv/bin/python3';

const TTS_SCRIPT = `
import sys, os
text = sys.argv[1]
voice = sys.argv[2] if len(sys.argv) > 2 else 'af_heart'
speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0

model_dir = os.path.expanduser('~/.cache/kokoro')
model_path = os.path.join(model_dir, 'model.onnx')
voices_path = os.path.join(model_dir, 'voices.bin')

if not os.path.exists(model_path) or not os.path.exists(voices_path):
    print('KOKORO_NOT_READY')
    sys.exit(0)

from kokoro_onnx import Kokoro
import soundfile as sf
kokoro = Kokoro(model_path, voices_path)
samples, sr = kokoro.create(text, voice=voice, speed=speed)
out = '/tmp/vesper_speech.wav'
sf.write(out, samples, sr)
print(out)
`.trim();

export function useVesperVoice() {
  const exec = useLoveRPC('shell:exec');
  const execRef = useRef(exec);
  execRef.current = exec;
  const speakingRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  const processQueue = useCallback(async () => {
    if (speakingRef.current || queueRef.current.length === 0) return;
    speakingRef.current = true;

    const text = queueRef.current.shift()!;
    try {
      // Generate WAV via Kokoro
      const genResult = await execRef.current({
        command: `${VENV_PYTHON} -c '${TTS_SCRIPT.replace(/'/g, "'\\''")}' '${text.replace(/'/g, "'\\''")}' af_heart 1.0`,
        maxOutput: 1024,
      }) as any;

      if (genResult?.ok && genResult.output?.trim() && !genResult.output.includes('KOKORO_NOT_READY')) {
        const wavPath = genResult.output.trim();
        // Play the WAV
        await execRef.current({
          command: `paplay ${wavPath} 2>/dev/null || aplay ${wavPath} 2>/dev/null`,
          maxOutput: 256,
        });
      }
    } catch {}

    speakingRef.current = false;
    // Process next in queue
    if (queueRef.current.length > 0) {
      processQueue();
    }
  }, []);

  const speak = useCallback((text: string) => {
    // Keep queue small — only last 3 utterances
    if (queueRef.current.length >= 3) {
      queueRef.current.splice(0, queueRef.current.length - 2);
    }
    queueRef.current.push(text);
    processQueue();
  }, [processQueue]);

  return { speak };
}
