/**
 * SemanticTerminal — visual capability node for a semantically-classified PTY.
 *
 * Renders a terminal where each row is classified by a Lua-side classifier
 * into semantic tokens (prompt, command, stdout, stderr, etc.). Supports
 * live PTY sessions and playback of recorded .rec.lua files.
 *
 * Unlike the non-visual `<Terminal>`, this component renders — so it accepts
 * a `style` prop for layout sizing (use `flexGrow: 1` to fill available space).
 *
 * Use the `useSemanticTerminal` hook for managed state and playback controls.
 *
 * @example
 * // One-liner: live classified terminal
 * <SemanticTerminal mode="live" command="bash" style={{ flexGrow: 1 }} />
 *
 * @example
 * // Playback a recorded session with timeline scrubber
 * <SemanticTerminal mode="playback" playbackSrc="/tmp/session.rec.lua"
 *   showTimeline showTokens style={{ flexGrow: 1 }} />
 *
 * @example
 * // With hook (recommended for full control):
 * const st = useSemanticTerminal({ mode: 'live', classifier: 'claude' })
 * <SemanticTerminal {...st.terminalProps} style={{ flexGrow: 1 }} />
 */

import React from 'react';

export interface SemanticTerminalProps {
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
  /** Layout style */
  style?: Record<string, any>;
  /** Fires when a row is classified */
  onClassifiedRow?: (event: { row: number; token: string; text: string }) => void;
  /** Fires when the semantic graph updates */
  onGraphUpdate?: (event: { nodeCount: number; turnCount: number }) => void;
  /** Fires when session state changes */
  onStateChange?: (event: { mode: string; streaming: boolean }) => void;
  /** Fires when recording is saved */
  onRecordingDone?: (event: { path: string; frames: number }) => void;
  /** Fires when playback reaches the end */
  onPlaybackEnd?: (event: {}) => void;
}

/**
 * Visual SemanticTerminal capability node.
 * Renders a classified terminal — accepts `style` for layout positioning.
 */
export function SemanticTerminal(props: SemanticTerminalProps) {
  return React.createElement('SemanticTerminal', props as any);
}
