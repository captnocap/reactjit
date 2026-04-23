/**
 * process — subprocess + environment bindings backed by framework/process.zig.
 *
 * Stdin/stdout are handled via streaming callbacks since process output comes
 * over time. Small-program patterns (one-shot commands that finish fast) get
 * convenience wrappers that await completion.
 *
 * Registration (Zig side):
 *
 *   qjs_runtime.registerHostFn("__proc_spawn", @ptrCast(&proc_spawn), 1);
 *   qjs_runtime.registerHostFn("__proc_kill", @ptrCast(&proc_kill), 1);
 *   qjs_runtime.registerHostFn("__proc_wait", @ptrCast(&proc_wait), 1);
 *   qjs_runtime.registerHostFn("__proc_stdin_write", @ptrCast(&proc_stdin_write), 2);
 *   qjs_runtime.registerHostFn("__proc_stdin_close", @ptrCast(&proc_stdin_close), 1);
 *   qjs_runtime.registerHostFn("__env_get", @ptrCast(&env_get), 1);
 *   qjs_runtime.registerHostFn("__env_set", @ptrCast(&env_set), 2);
 *   qjs_runtime.registerHostFn("__exit", @ptrCast(&exit), 1);
 *
 * Process events (stdout lines, stderr lines, exit) fire via __ffiEmit:
 *   __ffiEmit('proc:stdout:<pid>', line)
 *   __ffiEmit('proc:stderr:<pid>', line)
 *   __ffiEmit('proc:exit:<pid>', { code, signal })
 */

import { callHost, hasHost, subscribe } from '../ffi';

export interface SpawnOptions {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: 'pipe' | 'inherit' | 'ignore';
}

export type Pid = number;

/** Spawn a subprocess. Returns pid or 0 on failure. */
export function spawn(opts: SpawnOptions): Pid {
  return callHost<number>('__proc_spawn', 0, JSON.stringify(opts));
}

/** Send SIGTERM (or optional signal name). */
export function kill(pid: Pid, signal: string = 'SIGTERM'): boolean {
  return callHost<boolean>('__proc_kill', false, pid, signal);
}

/** Block until the process exits. Returns exit code. */
export function wait(pid: Pid): number {
  return callHost<number>('__proc_wait', -1, pid);
}

/** Write to the child's stdin (only if spawned with `stdin: 'pipe'`). */
export function stdinWrite(pid: Pid, data: string): boolean {
  return callHost<boolean>('__proc_stdin_write', false, pid, data);
}

/** Close the child's stdin. */
export function stdinClose(pid: Pid): void {
  callHost<void>('__proc_stdin_close', undefined as any, pid);
}

/** Subscribe to a child's stdout line-stream. Returns unsubscribe fn. */
export function onStdout(pid: Pid, fn: (line: string) => void): () => void {
  return subscribe(`proc:stdout:${pid}`, fn);
}

/** Subscribe to a child's stderr line-stream. */
export function onStderr(pid: Pid, fn: (line: string) => void): () => void {
  return subscribe(`proc:stderr:${pid}`, fn);
}

/** Subscribe to a child's exit event. */
export function onExit(pid: Pid, fn: (res: { code: number; signal: string | null }) => void): () => void {
  return subscribe(`proc:exit:${pid}`, fn);
}

// ── Environment ────────────────────────────────────────────────────

export function envGet(name: string): string | null {
  return callHost<string | null>('__env_get', null, name);
}

export function envSet(name: string, value: string): void {
  callHost<void>('__env_set', undefined as any, name, value);
}

export function exit(code: number = 0): void {
  callHost<void>('__exit', undefined as any, code);
}

// ── Convenience: one-shot command ──────────────────────────────────

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn, collect all stdout/stderr, wait for exit. For short-running commands.
 * Don't use for long-running processes — use spawn + on* instead.
 */
export function run(cmd: string, args: string[] = []): Promise<RunResult> {
  return new Promise((resolve) => {
    const pid = spawn({ cmd, args });
    if (pid === 0) { resolve({ code: -1, stdout: '', stderr: 'spawn failed' }); return; }
    let stdout = ''; let stderr = '';
    const offOut = onStdout(pid, (l) => { stdout += l + '\n'; });
    const offErr = onStderr(pid, (l) => { stderr += l + '\n'; });
    const offExit = onExit(pid, (r) => {
      offOut(); offErr(); offExit();
      resolve({ code: r.code, stdout, stderr });
    });
  });
}

// ── Async exec (shell one-liners) ─────────────────────────────────
// `execAsync(cmd)` is the async twin of the sync `exec(cmd)` host fn. The
// host runs popen on a detached thread and drains results via __ffiEmit;
// the Promise resolves when the process exits. Use this from any UI handler
// instead of `exec` — sync `exec` blocks the click frame for subprocess
// startup + total runtime (tsc, git, etc. are easily 500ms–2s).
let _execRidCounter = 0;

export interface ExecResult {
  code: number;
  stdout: string;
}

export function execAsync(cmd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    if (!hasHost('__exec_async')) {
      const sync = (globalThis as any).__exec;
      if (typeof sync === 'function') {
        try { resolve({ code: 0, stdout: String(sync(cmd) ?? '') }); return; } catch {}
      }
      resolve({ code: -1, stdout: '' });
      return;
    }
    const rid = 'x' + (++_execRidCounter) + ':' + Date.now();
    const off = subscribe('exec:' + rid, (payload: any) => {
      off();
      try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        resolve({ code: parsed.code ?? -1, stdout: parsed.stdout ?? '' });
      } catch {
        resolve({ code: -1, stdout: '' });
      }
    });
    callHost<void>('__exec_async', undefined as any, cmd, rid);
  });
}
