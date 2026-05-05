import { useState, useEffect, useRef, useCallback } from 'react';
const host: any = globalThis;

function hasHost(name: string): boolean {
  return typeof host[name] === 'function';
}

export function useAudioCapture(bufferSize: number = 2048, sampleRate: number = 44100) {
  const [available, setAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const ringRef = useRef(new Float32Array(bufferSize));
  const writeRef = useRef(0);
  const rafRef = useRef<any>(null);

  // Check host availability on mount
  useEffect(() => {
    const hasCapture = hasHost('__audio_capture_start') && hasHost('__audio_capture_stop') && hasHost('__audio_capture_read');
    setAvailable(hasCapture);
  }, []);

  const start = useCallback(() => {
    if (!available) return;
    if (hasHost('__audio_capture_start')) {
      host.__audio_capture_start(sampleRate, bufferSize);
      setRecording(true);
    }
  }, [available, sampleRate, bufferSize]);

  const stop = useCallback(() => {
    if (hasHost('__audio_capture_stop')) {
      host.__audio_capture_stop();
    }
    setRecording(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Poll capture buffer when recording
  useEffect(() => {
    if (!recording || !available) return;

    const poll = () => {
      if (hasHost('__audio_capture_read')) {
        const data = host.__audio_capture_read();
        if (data && typeof data.length === 'number') {
          const ring = ringRef.current;
          for (let i = 0; i < data.length; i++) {
            ring[writeRef.current] = data[i];
            writeRef.current = (writeRef.current + 1) % ring.length;
          }
        }
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [recording, available]);

  const getSamples = useCallback((count: number): Float32Array => {
    const ring = ringRef.current;
    const out = new Float32Array(count);
    const w = writeRef.current;
    for (let i = 0; i < count; i++) {
      out[i] = ring[(w - count + i + ring.length) % ring.length];
    }
    return out;
  }, []);

  return { available, recording, start, stop, getSamples };
}
