/**
 * React hooks for @reactjit/environments.
 *
 * Lua-side: lua/environments.lua (env CRUD, process spawning, package management)
 * React-side: hooks for environment lifecycle, process I/O, and env listing
 */

import { useState, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent, useMount } from '@reactjit/core';
import type {
  EnvironmentConfig,
  EnvironmentState,
  ProcessConfig,
  ProcessState,
  UseEnvironmentResult,
  UseProcessResult,
  UseEnvironmentsResult,
} from './types';

// ============================================================================
// useEnvironment — create/manage a single environment
// ============================================================================

/**
 * Create and manage a named environment. Environments persist across sessions.
 *
 * On first call with a new name, creates the environment (venv, node_modules, etc.)
 * and installs packages. On subsequent calls, reuses the existing env.
 *
 * @example
 * // Python ML environment — one-liner
 * const env = useEnvironment('ml', {
 *   type: 'python',
 *   packages: ['numpy', 'pandas', 'torch'],
 *   cwd: '/home/user/projects/ml',
 * });
 *
 * // Run a script when ready
 * if (env.ready) env.run('python train.py');
 *
 * @example
 * // Node.js dev server
 * const env = useEnvironment('frontend', {
 *   type: 'node',
 *   packages: ['vite', 'react', 'react-dom'],
 *   cwd: '/home/user/projects/app',
 * });
 *
 * @example
 * // Custom env with arbitrary setup
 * const env = useEnvironment('llm-stack', {
 *   type: 'custom',
 *   setup: ['source /opt/cuda/env.sh', 'export MODEL_PATH=/data/models'],
 *   cwd: '/home/user/inference',
 * });
 */
export function useEnvironment(
  name: string,
  config: Omit<EnvironmentConfig, 'name'>
): UseEnvironmentResult {
  const [state, setState] = useState<EnvironmentState>({
    config: { name, ...config },
    ready: false,
    installing: false,
    error: null,
    installedPackages: [],
    path: null,
  });

  const createRpc = useLoveRPC('env:create');
  const installRpc = useLoveRPC('env:install');
  const destroyRpc = useLoveRPC('env:destroy');
  const runRpc = useLoveRPC('env:run');
  const getRpc = useLoveRPC('env:get');

  // Listen for env events targeting this environment
  useLoveEvent('env:ready', (payload: any) => {
    if (payload.name !== name) return;
    setState((s) => ({
      ...s,
      ready: true,
      installing: false,
      error: null,
      path: payload.path || s.path,
      installedPackages: payload.packages || s.installedPackages,
    }));
  });

  useLoveEvent('env:error', (payload: any) => {
    if (payload.name !== name) return;
    setState((s) => ({ ...s, installing: false, error: payload.error }));
  });

  useLoveEvent('env:installing', (payload: any) => {
    if (payload.name !== name) return;
    setState((s) => ({ ...s, installing: true }));
  });

  // On mount: create or reuse the environment
  useMount(() => {
    const fullConfig: EnvironmentConfig = { name, ...config };
    setState((s) => ({ ...s, installing: true }));
    createRpc(fullConfig)
      .then((result: any) => {
        if (result?.error) {
          setState((s) => ({ ...s, installing: false, error: result.error }));
        } else if (result?.ready) {
          setState((s) => ({
            ...s,
            ready: true,
            installing: false,
            path: result.path || null,
            installedPackages: result.packages || [],
          }));
        }
        // else: async setup in progress, env:ready event will fire
      })
      .catch((err: any) => {
        setState((s) => ({ ...s, installing: false, error: String(err) }));
      });
  });

  const install = useCallback(
    async (packages: string[]) => {
      setState((s) => ({ ...s, installing: true }));
      const result: any = await installRpc({ name, packages });
      if (result?.error) {
        setState((s) => ({ ...s, installing: false, error: result.error }));
      }
    },
    [name, installRpc]
  );

  const run = useCallback(
    async (command: string, opts?: Partial<ProcessConfig>) => {
      const result: any = await runRpc({
        envName: name,
        command,
        cwd: opts?.cwd,
        env: opts?.env,
        pty: opts?.pty ?? true,
        rows: opts?.rows,
        cols: opts?.cols,
      });
      if (result?.error) throw new Error(result.error);
      return result.processId as string;
    },
    [name, runRpc]
  );

  const destroy = useCallback(async () => {
    const result: any = await destroyRpc({ name });
    if (result?.error) throw new Error(result.error);
    setState((s) => ({
      ...s,
      ready: false,
      installing: false,
      path: null,
      installedPackages: [],
    }));
  }, [name, destroyRpc]);

  const rebuild = useCallback(async () => {
    await destroy();
    const fullConfig: EnvironmentConfig = { name, ...config };
    setState((s) => ({ ...s, installing: true }));
    const result: any = await createRpc(fullConfig);
    if (result?.error) {
      setState((s) => ({ ...s, installing: false, error: result.error }));
    }
  }, [destroy, createRpc, name, config]);

  return {
    state,
    install,
    run,
    destroy,
    rebuild,
    ready: state.ready,
  };
}

// ============================================================================
// useProcess — attach to a running process spawned by useEnvironment.run()
// ============================================================================

/**
 * Attach to a process running inside an environment.
 *
 * @example
 * const env = useEnvironment('ml', { type: 'python', packages: ['torch'] });
 * const [procId, setProcId] = useState<string | null>(null);
 *
 * // Start process when env is ready
 * if (env.ready && !procId) env.run('python train.py').then(setProcId);
 *
 * // Attach to process I/O
 * const proc = useProcess(procId, {
 *   onStdout: (data) => appendLog(data),
 *   onExit: (code) => console.log('done:', code),
 * });
 *
 * // Send input
 * proc.sendLine('yes');
 */
export function useProcess(
  processId: string | null,
  handlers?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onExit?: (code: number) => void;
  }
): UseProcessResult {
  const [state, setState] = useState<ProcessState>({
    id: processId,
    running: processId !== null,
    exitCode: null,
    stdout: '',
    stderr: '',
  });

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const sendRpc = useLoveRPC('env:process:send');
  const resizeRpc = useLoveRPC('env:process:resize');
  const killRpc = useLoveRPC('env:process:kill');

  // Update id tracking when processId changes
  useMount(() => {
    if (processId) {
      setState((s) => ({ ...s, id: processId, running: true, exitCode: null }));
    }
  });

  useLoveEvent('env:stdout', (payload: any) => {
    if (payload.processId !== processId) return;
    const data = payload.data || '';
    setState((s) => ({
      ...s,
      stdout: (s.stdout + data).slice(-50000), // cap at 50k chars
    }));
    handlersRef.current?.onStdout?.(data);
  });

  useLoveEvent('env:stderr', (payload: any) => {
    if (payload.processId !== processId) return;
    const data = payload.data || '';
    setState((s) => ({
      ...s,
      stderr: (s.stderr + data).slice(-50000),
    }));
    handlersRef.current?.onStderr?.(data);
  });

  useLoveEvent('env:exit', (payload: any) => {
    if (payload.processId !== processId) return;
    const code = payload.exitCode ?? -1;
    setState((s) => ({ ...s, running: false, exitCode: code }));
    handlersRef.current?.onExit?.(code);
  });

  const send = useCallback(
    (data: string) => {
      if (!processId) return;
      sendRpc({ processId, data }).catch(() => {});
    },
    [processId, sendRpc]
  );

  const sendLine = useCallback(
    (line: string) => send(line + '\n'),
    [send]
  );

  const resize = useCallback(
    (rows: number, cols: number) => {
      if (!processId) return;
      resizeRpc({ processId, rows, cols }).catch(() => {});
    },
    [processId, resizeRpc]
  );

  const kill = useCallback(
    (signal?: number) => {
      if (!processId) return;
      killRpc({ processId, signal }).catch(() => {});
    },
    [processId, killRpc]
  );

  return {
    state,
    send,
    sendLine,
    resize,
    kill,
    running: state.running,
    exitCode: state.exitCode,
  };
}

// ============================================================================
// useEnvironments — list and manage all environments
// ============================================================================

/**
 * List and manage all stored environments.
 *
 * @example
 * const { environments, remove, refresh } = useEnvironments();
 *
 * // Show all envs
 * environments.map(e => <Text>{e.config.name} ({e.config.type})</Text>)
 *
 * // Delete one
 * remove('old-project');
 */
export function useEnvironments(): UseEnvironmentsResult {
  const [environments, setEnvironments] = useState<EnvironmentState[]>([]);

  const listRpc = useLoveRPC('env:list');
  const destroyRpc = useLoveRPC('env:destroy');

  const refresh = useCallback(async () => {
    const result: any = await listRpc({});
    if (result?.environments) {
      setEnvironments(
        result.environments.map((e: any) => ({
          config: e.config,
          ready: e.ready,
          installing: false,
          error: null,
          installedPackages: e.packages || [],
          path: e.path || null,
        }))
      );
    }
  }, [listRpc]);

  useMount(() => {
    refresh();
  });

  // Update when envs change
  useLoveEvent('env:ready', () => refresh());
  useLoveEvent('env:destroyed', () => refresh());

  const remove = useCallback(
    async (name: string) => {
      await destroyRpc({ name });
      await refresh();
    },
    [destroyRpc, refresh]
  );

  return { environments, refresh, remove };
}

// ============================================================================
// useEnvRun — one-liner: run a command in a named environment
// ============================================================================

/**
 * One-liner: run a command in a previously-created environment.
 *
 * @example
 * const proc = useEnvRun('ml', 'python inference.py --input data.csv');
 * // proc.stdout, proc.running, proc.send(), etc.
 */
export function useEnvRun(
  envName: string,
  command: string,
  opts?: {
    autoStart?: boolean;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onExit?: (code: number) => void;
  }
): UseProcessResult & { start: () => Promise<void> } {
  const [processId, setProcessId] = useState<string | null>(null);
  const startedRef = useRef(false);
  const runRpc = useLoveRPC('env:run');

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const result: any = await runRpc({ envName, command });
    if (result?.processId) {
      setProcessId(result.processId);
    }
  }, [envName, command, runRpc]);

  useMount(() => {
    if (opts?.autoStart !== false) {
      start();
    }
  });

  const proc = useProcess(processId, {
    onStdout: opts?.onStdout,
    onStderr: opts?.onStderr,
    onExit: opts?.onExit,
  });

  return { ...proc, start };
}
