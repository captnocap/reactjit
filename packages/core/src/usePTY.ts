/**
 * usePTY — React hook for PTY terminal sessions.
 *
 * Manages a Terminal capability node and provides accumulated output,
 * send helpers, and resize. Spread `terminalProps` onto `<Terminal>` in
 * your JSX tree — that's the non-visual node that owns the PTY lifecycle.
 *
 * @example
 * // Full pattern — managed output + send
 * const { output, send, connected, terminalProps } = usePTY({
 *   type: 'user',
 *   shell: 'bash',
 *   session: 'main',
 * })
 * return (
 *   <>
 *     <Terminal {...terminalProps} />
 *     <Text fontSize={12}>{output}</Text>
 *     <Pressable onPress={() => send('ls -la\n')}>
 *       <Text fontSize={12}>ls</Text>
 *     </Pressable>
 *   </>
 * )
 *
 * @example
 * // Minimal — just events, no managed state
 * <Terminal type="user" onData={(e) => console.log(e.data)} />
 *
 * @example
 * // Root shell (needs sudo or shows password prompt in PTY)
 * <Terminal type="root" session="admin" onData={(e) => setOut(o => o + e.data)} />
 *
 * @example
 * // Template: one fresh PTY per command
 * const { send, terminalProps } = usePTY({ type: 'template', env: { MY_KEY: 'abc' } })
 * <Terminal {...terminalProps} />
 * // each send() with a command key runs in a fresh bash -c "..." PTY
 */

import { useState, useCallback, useRef } from 'react';
import { useBridgeOptional } from './context';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UsePTYOptions {
  /** 'user' (default) | 'root' | 'template' */
  type?: 'user' | 'root' | 'template';
  /** Shell executable: 'bash' (default) | 'zsh' | any PATH-resolvable binary */
  shell?: string;
  /** Working directory for the shell process */
  cwd?: string;
  /** Environment variable overrides. false = unset the variable. */
  env?: Record<string, string | false>;
  /** Terminal rows (default: 24) */
  rows?: number;
  /** Terminal columns (default: 80) */
  cols?: number;
  /**
   * Named session ID. Stable string used in pty:write / pty:resize RPC calls.
   * Auto-generated if omitted. Useful when multiple terminals need to coexist.
   */
  session?: string;
  /** Transport backend: 'bridge' (default) | 'ws' | 'http' | 'tor' */
  transport?: 'bridge' | 'ws' | 'http' | 'tor';
  /** Auto-spawn shell on mount (default: true) */
  autoConnect?: boolean;
  /**
   * Max characters to keep in the output buffer (rolling window).
   * Default: 100_000. Prevents unbounded memory growth for long sessions.
   */
  maxOutput?: number;
}

export interface TerminalCapabilityProps {
  type?: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string | false>;
  rows?: number;
  cols?: number;
  session?: string;
  transport?: string;
  autoConnect?: boolean;
  onData:    (event: { data: string }) => void;
  onConnect: (event: { shell: string; ptyType: string; session?: string }) => void;
  onExit:    (event: { exitCode: number | null }) => void;
  onError:   (event: { error: string }) => void;
}

export interface UsePTYResult {
  /** Accumulated terminal output (rolling, trimmed to maxOutput) */
  output: string;
  /** Whether the shell process is currently running */
  connected: boolean;
  /** Write raw bytes to the PTY (keystrokes, escape sequences, commands) */
  send: (data: string) => void;
  /** Send a command followed by newline */
  sendLine: (command: string) => void;
  /** Send Ctrl+C (interrupt running process) */
  interrupt: () => void;
  /** Send Ctrl+D (EOF — triggers logout on interactive shells) */
  sendEOF: () => void;
  /**
   * For template PTYs: run a command in a fresh ephemeral PTY.
   * Sends via pty:write RPC with a `command` key the Lua side intercepts.
   */
  runCommand: (command: string) => void;
  /** Notify the PTY of a window size change (triggers SIGWINCH to the shell) */
  resize: (rows: number, cols: number) => void;
  /** Clear the accumulated output buffer */
  clearOutput: () => void;
  /**
   * Spread these props onto a `<Terminal>` element.
   * That element is the non-visual capability node that owns the PTY lifecycle.
   */
  terminalProps: TerminalCapabilityProps;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePTY(opts: UsePTYOptions = {}): UsePTYResult {
  const bridge    = useBridgeOptional();
  const maxOutput = opts.maxOutput ?? 100_000;

  const [output,    setOutput]    = useState('');
  const [connected, setConnected] = useState(false);

  // Stable session name that never changes across re-renders
  const sessionRef = useRef<string>(opts.session ?? `pty-${Math.random().toString(36).slice(2, 8)}`);
  const session    = sessionRef.current;

  const send = useCallback((data: string) => {
    bridge?.rpc('pty:write', { session, data });
  }, [bridge, session]);

  const sendLine   = useCallback((cmd: string)  => send(cmd + '\n'),  [send]);
  const interrupt  = useCallback(() => send('\x03'),                   [send]);
  const sendEOF    = useCallback(() => send('\x04'),                   [send]);

  const runCommand = useCallback((command: string) => {
    // Template-mode: Lua spawns a fresh bash -c "<command>" PTY
    bridge?.rpc('pty:write', { session, command });
  }, [bridge, session]);

  const resize = useCallback((rows: number, cols: number) => {
    bridge?.rpc('pty:resize', { session, rows, cols });
  }, [bridge, session]);

  const clearOutput = useCallback(() => setOutput(''), []);

  // Capability event handlers — stable references via useCallback
  const onData = useCallback((e: { data: string }) => {
    setOutput(prev => {
      const next = prev + e.data;
      return next.length > maxOutput ? next.slice(next.length - maxOutput) : next;
    });
  }, [maxOutput]);

  const onConnect = useCallback(() => setConnected(true),  []);
  const onExit    = useCallback(() => setConnected(false), []);
  const onError   = useCallback(() => setConnected(false), []);

  const terminalProps: TerminalCapabilityProps = {
    type:        opts.type,
    shell:       opts.shell,
    cwd:         opts.cwd,
    env:         opts.env,
    rows:        opts.rows,
    cols:        opts.cols,
    session,
    transport:   opts.transport,
    autoConnect: opts.autoConnect,
    onData,
    onConnect,
    onExit,
    onError,
  };

  return {
    output,
    connected,
    send,
    sendLine,
    interrupt,
    sendEOF,
    runCommand,
    resize,
    clearOutput,
    terminalProps,
  };
}
