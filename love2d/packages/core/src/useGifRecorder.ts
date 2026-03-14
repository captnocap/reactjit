/**
 * useGifRecorder — record the Love2D window as a GIF.
 *
 * Captures frames at the configured FPS using Love2D's screenshot API,
 * then assembles them into a GIF via ffmpeg (must be on PATH).
 *
 * @example
 * const { recording, start, stop, gifPath, frames } = useGifRecorder();
 *
 * <Pressable onPress={() => recording ? stop() : start()}>
 *   <Text>{recording ? `Recording (${frames} frames)` : 'Record GIF'}</Text>
 * </Pressable>
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useBridgeOptional } from './context';

export interface GifRecorderOptions {
  /** Frames per second (default 15). */
  fps?: number;
  /** Output file path (default: <project>/recording.gif). */
  output?: string;
}

export interface GifRecorderResult {
  /** Whether recording is in progress. */
  recording: boolean;
  /** Number of frames captured so far. */
  frames: number;
  /** Path to the last generated GIF (null until first stop). */
  gifPath: string | null;
  /** Start recording. */
  start: (opts?: GifRecorderOptions) => void;
  /** Stop recording and assemble GIF. Returns the output path. */
  stop: () => Promise<string | null>;
}

export function useGifRecorder(): GifRecorderResult {
  const bridge = useBridgeOptional();
  const [recording, setRecording] = useState(false);
  const [frames, setFrames] = useState(0);
  const [gifPath, setGifPath] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll frame count while recording
  // rjit-ignore-next-line — Dep-driven: polls GIF recorder status while recording is active
  useEffect(() => {
    if (!recording || !bridge) return;
    pollRef.current = setInterval(() => {
      bridge.rpc<{ recording: boolean; frames: number }>('gif:status')
        .then((s) => {
          setFrames(s.frames);
          if (!s.recording) setRecording(false);
        })
        .catch(() => {});
    }, 500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [recording, bridge]);

  const start = useCallback(
    (opts?: GifRecorderOptions) => {
      if (!bridge) return;
      bridge.rpc('gif:start', opts ?? {}).then(() => {
        setRecording(true);
        setFrames(0);
        setGifPath(null);
      }).catch(() => {});
    },
    [bridge],
  );

  const stop = useCallback(async () => {
    if (!bridge) return null;
    const result = await bridge.rpc<{ path?: string; error?: string }>('gif:stop');
    setRecording(false);
    if (result.path) {
      setGifPath(result.path);
      return result.path;
    }
    return null;
  }, [bridge]);

  return { recording, frames, gifPath, start, stop };
}
