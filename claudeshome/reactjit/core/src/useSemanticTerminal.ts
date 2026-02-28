/**
 * useSemanticTerminal — React hook for managing SemanticTerminal state.
 *
 * Tracks classified rows, graph state, and playback position. Provides
 * control methods for playback (play/pause/seek/step) and recording.
 * Spread `terminalProps` onto `<SemanticTerminal>` in your JSX tree.
 *
 * @example
 * // Live session with classification tracking
 * const { classifiedRows, graphState, terminalProps } = useSemanticTerminal({
 *   mode: 'live',
 *   command: 'bash',
 *   classifier: 'claude',
 *   showTokens: true,
 * })
 * return <SemanticTerminal {...terminalProps} style={{ flexGrow: 1 }} />
 *
 * @example
 * // Playback with full controls
 * const { playerState, play, pause, seek, terminalProps } = useSemanticTerminal({
 *   mode: 'playback',
 *   playbackSrc: '/tmp/session.rec.lua',
 *   showTimeline: true,
 * })
 * return (
 *   <>
 *     <SemanticTerminal {...terminalProps} style={{ flexGrow: 1 }} />
 *     <Pressable onPress={playerState?.playing ? pause : play}>
 *       <Text>{playerState?.playing ? 'Pause' : 'Play'}</Text>
 *     </Pressable>
 *   </>
 * )
 */

import { useState, useCallback, useRef } from 'react';
import { useBridgeOptional } from './context';
import type { SemanticTerminalProps } from './SemanticTerminal';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseSemanticTerminalOptions {
  /** 'live' for PTY session, 'playback' for recorded session */
  mode?: 'live' | 'playback';
  /** Command to run in live mode (default: 'bash') */
  command?: string;
  /** Command arguments (space-separated) */
  args?: string;
  /** Working directory */
  cwd?: string;
  /** Terminal rows (default: 40) */
  rows?: number;
  /** Terminal columns (default: 120) */
  cols?: number;
  /** Classifier name from lua/classifiers/ (default: 'basic') */
  classifier?: string;
  /** Record PTY output for later playback */
  recording?: boolean;
  /** Path to .rec.lua file for playback mode */
  playbackSrc?: string;
  /** Playback speed multiplier (default: 1.0) */
  playbackSpeed?: number;
  /** Show token type badges on each row */
  showTokens?: boolean;
  /** Show semantic graph panel */
  showGraph?: boolean;
  /** Show timeline scrubber in playback mode */
  showTimeline?: boolean;
}

/** A single classified row from the terminal */
export interface ClassifiedRow {
  row: number;
  token: string;
  text: string;
}

/** Current state of the semantic graph */
export interface GraphState {
  nodeCount: number;
  turnCount: number;
  mode: string;
  streaming: boolean;
}

/** Current playback position and transport state */
export interface PlayerState {
  playing: boolean;
  time: number;
  duration: number;
  progress: number;
  frame: number;
  totalFrames: number;
  speed: number;
}

export interface UseSemanticTerminalResult {
  /** All classified rows received so far */
  classifiedRows: ClassifiedRow[];
  /** Current semantic graph state, or null if no graph update received */
  graphState: GraphState | null;
  /** Current playback state, or null if not in playback mode */
  playerState: PlayerState | null;
  /** Resume or start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to a specific time in seconds */
  seek: (timeSeconds: number) => void;
  /** Advance one frame forward */
  step: () => void;
  /** Go back one frame */
  stepBack: () => void;
  /** Set playback speed multiplier */
  setSpeed: (speed: number) => void;
  /** Save the current recording to a file path */
  saveRecording: (path: string) => void;
  /** Spread these props onto a `<SemanticTerminal>` element */
  terminalProps: SemanticTerminalProps;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSemanticTerminal(
  opts: UseSemanticTerminalOptions = {},
): UseSemanticTerminalResult {
  const bridge = useBridgeOptional();

  const [classifiedRows, setClassifiedRows] = useState<ClassifiedRow[]>([]);
  const [graphState, setGraphState] = useState<GraphState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);

  // Stable session ref so RPC calls target the same instance across re-renders
  const sessionRef = useRef<string>(
    `sem-${Math.random().toString(36).slice(2, 8)}`,
  );
  const session = sessionRef.current;

  // ── Playback controls ────────────────────────────────────────────────────

  const play = useCallback(() => {
    bridge?.rpc('semantic_terminal:playback_control', {
      session,
      action: 'play',
    });
  }, [bridge, session]);

  const pause = useCallback(() => {
    bridge?.rpc('semantic_terminal:playback_control', {
      session,
      action: 'pause',
    });
  }, [bridge, session]);

  const seek = useCallback(
    (timeSeconds: number) => {
      bridge?.rpc('semantic_terminal:playback_control', {
        session,
        action: 'seek',
        time: timeSeconds,
      });
    },
    [bridge, session],
  );

  const step = useCallback(() => {
    bridge?.rpc('semantic_terminal:playback_control', {
      session,
      action: 'step',
    });
  }, [bridge, session]);

  const stepBack = useCallback(() => {
    bridge?.rpc('semantic_terminal:playback_control', {
      session,
      action: 'step_back',
    });
  }, [bridge, session]);

  const setSpeed = useCallback(
    (speed: number) => {
      bridge?.rpc('semantic_terminal:playback_control', {
        session,
        action: 'set_speed',
        speed,
      });
    },
    [bridge, session],
  );

  // ── Recording ────────────────────────────────────────────────────────────

  const saveRecording = useCallback(
    (path: string) => {
      bridge?.rpc('semantic_terminal:save_recording', { session, path });
    },
    [bridge, session],
  );

  // ── Event handlers (stable refs via useCallback) ─────────────────────────

  const onClassifiedRow = useCallback(
    (event: { row: number; token: string; text: string }) => {
      setClassifiedRows((prev) => {
        // Replace existing row entry or append new one
        const idx = prev.findIndex((r) => r.row === event.row);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = event;
          return next;
        }
        return [...prev, event];
      });
    },
    [],
  );

  const onGraphUpdate = useCallback(
    (event: { nodeCount: number; turnCount: number }) => {
      setGraphState((prev) => ({
        nodeCount: event.nodeCount,
        turnCount: event.turnCount,
        mode: prev?.mode ?? 'unknown',
        streaming: prev?.streaming ?? false,
      }));
    },
    [],
  );

  const onStateChange = useCallback(
    (event: { mode: string; streaming: boolean }) => {
      setGraphState((prev) => ({
        nodeCount: prev?.nodeCount ?? 0,
        turnCount: prev?.turnCount ?? 0,
        mode: event.mode,
        streaming: event.streaming,
      }));
    },
    [],
  );

  const onRecordingDone = useCallback(
    (_event: { path: string; frames: number }) => {
      // Recording saved — no additional state to track
    },
    [],
  );

  const onPlaybackEnd = useCallback((_event: {}) => {
    setPlayerState((prev) =>
      prev ? { ...prev, playing: false, progress: 1 } : prev,
    );
  }, []);

  // ── Terminal props to spread onto <SemanticTerminal> ─────────────────────

  const terminalProps: SemanticTerminalProps = {
    mode: opts.mode,
    command: opts.command,
    args: opts.args,
    cwd: opts.cwd,
    rows: opts.rows,
    cols: opts.cols,
    classifier: opts.classifier,
    recording: opts.recording,
    playbackSrc: opts.playbackSrc,
    playbackSpeed: opts.playbackSpeed,
    showTokens: opts.showTokens,
    showGraph: opts.showGraph,
    showTimeline: opts.showTimeline,
    onClassifiedRow,
    onGraphUpdate,
    onStateChange,
    onRecordingDone,
    onPlaybackEnd,
  };

  return {
    classifiedRows,
    graphState,
    playerState,
    play,
    pause,
    seek,
    step,
    stepBack,
    setSpeed,
    saveRecording,
    terminalProps,
  };
}
