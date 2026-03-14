/**
 * useRecorder — record the Love2D window as MP4 or WebM video.
 *
 * Pipes raw RGBA frames to ffmpeg in a subprocess. No temp files,
 * no PNG encoding overhead. ffmpeg must be on PATH.
 *
 * @example
 * const { recording, start, stop, filePath, frames, duration } = useRecorder();
 *
 * <Pressable onPress={() => recording ? stop() : start({ fps: 30 })}>
 *   <Text>{recording ? `Recording ${duration.toFixed(1)}s` : 'Record'}</Text>
 * </Pressable>
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useBridgeOptional } from './context';

export interface RecorderOptions {
  /** Frames per second (default 30). */
  fps?: number;
  /** Output format: 'mp4' (default) or 'webm'. */
  format?: 'mp4' | 'webm';
  /** Output file path (default: <project>/recording.<ext>). */
  output?: string;
}

export interface RecorderResult {
  /** Whether recording is in progress. */
  recording: boolean;
  /** Number of frames captured so far. */
  frames: number;
  /** Duration in seconds since recording started. */
  duration: number;
  /** Path to the last generated video (null until first stop). */
  filePath: string | null;
  /** Current format being recorded. */
  format: string | null;
  /** Start recording. */
  start: (opts?: RecorderOptions) => void;
  /** Stop recording and finalize video. Returns the output path. */
  stop: () => Promise<string | null>;
}

interface RecorderStatus {
  recording: boolean;
  frames: number;
  fps: number;
  format: string;
  duration: number;
  output: string | null;
  width: number;
  height: number;
}

export function useRecorder(): RecorderResult {
  const bridge = useBridgeOptional();
  const [recording, setRecording] = useState(false);
  const [frames, setFrames] = useState(0);
  const [duration, setDuration] = useState(0);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // rjit-ignore-next-line — Dep-driven: polls recorder status while recording is active
  useEffect(() => {
    if (!recording || !bridge) return;
    pollRef.current = setInterval(() => {
      bridge.rpc<RecorderStatus>('recorder:status')
        .then((s) => {
          setFrames(s.frames);
          setDuration(s.duration);
          if (!s.recording) setRecording(false);
        })
        .catch(() => {});
    }, 500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [recording, bridge]);

  const start = useCallback(
    (opts?: RecorderOptions) => {
      if (!bridge) return;
      bridge.rpc('recorder:start', opts ?? {}).then((result: any) => {
        if (result && result.error) return;
        setRecording(true);
        setFrames(0);
        setDuration(0);
        setFilePath(null);
        setFormat(opts?.format ?? 'mp4');
      }).catch(() => {});
    },
    [bridge],
  );

  const stop = useCallback(async () => {
    if (!bridge) return null;
    const result = await bridge.rpc<{ path?: string; error?: string }>('recorder:stop');
    setRecording(false);
    if (result.path) {
      setFilePath(result.path);
      return result.path;
    }
    return null;
  }, [bridge]);

  return { recording, frames, duration, filePath, format, start, stop };
}
