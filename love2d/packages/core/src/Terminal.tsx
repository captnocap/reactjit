/**
 * Terminal — visual, interactive PTY terminal.
 *
 * Click to focus, type to interact. Renders the vterm cell grid with proper
 * ANSI colors, handles keyboard input, scrolling, and cursor blink.
 *
 * Give it a style with dimensions (flexGrow, width/height) so the layout
 * engine knows how much space to allocate.
 *
 * @example
 * // Interactive terminal (one-liner):
 * <Terminal type="user" style={{ flexGrow: 1 }} />
 *
 * @example
 * // With hook for programmatic control:
 * const { send, sendLine, terminalProps } = usePTY({ type: 'user', session: 'main' })
 * <Terminal {...terminalProps} style={{ flexGrow: 1 }} />
 *
 * @example
 * // Fixed-size terminal:
 * <Terminal type="user" rows={24} cols={80} style={{ width: 660, height: 400 }} />
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
  /** Detect and underline clickable URLs/file paths in terminal output (default: false) */
  hyperlinks?: boolean;
  /** Layout style (flexGrow, width, height, etc.) */
  style?: Record<string, any>;
  /** Fires with each chunk of raw PTY output (ANSI-encoded, backward compat) */
  onData?: (event: { data: string }) => void;
  /** Fires on settle with structured row data from vterm (only changed rows) */
  onDirtyRows?: (event: { rows: Array<{ row: number; text: string }> }) => void;
  /** Fires when the cursor moves in the vterm grid */
  onCursorMove?: (event: { row: number; col: number; visible: boolean }) => void;
  /** Fires once when the shell process starts */
  onConnect?: (event: { shell: string; ptyType: string; session?: string }) => void;
  /** Fires when the shell process exits */
  onExit?: (event: { exitCode: number | null }) => void;
  /** Fires on spawn error */
  onError?: (event: { error: string }) => void;
  /** Fires when a detected hyperlink is clicked (requires hyperlinks={true}) */
  onLinkClick?: (event: { url: string; linkType: 'image' | 'video' | 'web' | 'document' | 'file'; row: number; col: number }) => void;
}

/**
 * Visual, interactive PTY terminal.
 * Click to focus, type to interact. Renders vterm output with ANSI colors.
 */
export function Terminal(props: TerminalProps) {
  return React.createElement('Terminal', props as any);
}
