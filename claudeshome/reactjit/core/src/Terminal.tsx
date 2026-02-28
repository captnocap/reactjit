/**
 * Terminal — non-visual capability node that manages a PTY session.
 *
 * Drop this in your React tree to own a shell session. It emits onData events
 * as the shell produces output, and accepts input via bridge.rpc('pty:write').
 *
 * Use the `usePTY` hook to manage state and get convenient send helpers.
 *
 * @example
 * // One-liner: stream output
 * <Terminal type="user" onData={(e) => append(e.data)} />
 *
 * @example
 * // With hook (recommended for stateful UI):
 * const { output, send, terminalProps } = usePTY({ type: 'user', session: 'main' })
 * <Terminal {...terminalProps} />
 * <Text fontSize={12}>{output}</Text>
 *
 * @example
 * // Root shell (shows sudo prompt if NOPASSWD not configured)
 * <Terminal type="root" session="admin" onData={(e) => append(e.data)} />
 *
 * @example
 * // Template: fresh PTY per command, clean env
 * <Terminal type="template" env={{ MY_API: 'key' }} session="cmd"
 *   onData={(e) => append(e.data)} onExit={(e) => setDone(true)} />
 */

import React from 'react';

export interface TerminalProps {
  /** Session archetype (default: 'user') */
  type?: 'user' | 'root' | 'template';
  /** Shell executable (default: 'bash') */
  shell?: string;
  /** Working directory for the child process */
  cwd?: string;
  /** Environment variable overrides. Set value to false to unset. */
  env?: Record<string, string | false>;
  /** Terminal rows (default: 24) */
  rows?: number;
  /** Terminal columns (default: 80) */
  cols?: number;
  /** Named session ID for RPC targeting (auto-generated if omitted) */
  session?: string;
  /** Transport backend: 'bridge' (default) | 'ws' | 'http' | 'tor' */
  transport?: 'bridge' | 'ws' | 'http' | 'tor';
  /** Auto-spawn on mount (default: true) */
  autoConnect?: boolean;
  /** Fires with each chunk of PTY output (ANSI-encoded) */
  onData?: (event: { data: string }) => void;
  /** Fires once when the shell process starts */
  onConnect?: (event: { shell: string; ptyType: string; session?: string }) => void;
  /** Fires when the shell process exits */
  onExit?: (event: { exitCode: number | null }) => void;
  /** Fires on spawn error */
  onError?: (event: { error: string }) => void;
}

/**
 * Non-visual Terminal capability node.
 * Renders nothing — manages the PTY session lifecycle on the Lua side.
 */
export function Terminal(props: TerminalProps) {
  return React.createElement('Terminal', props as any);
}
