/**
 * useFleet — manages N concurrent Claude Code sessions.
 *
 * Each agent gets independent status, permission, and question state.
 * RPCs are session-scoped (passes `session: agentId` to every call),
 * fixing the bug where the workspace useClaude sent unscoped RPCs that
 * defaulted to _focusedId on the Lua side.
 *
 * Auto-accept is global (matches Lua reality) — one toggle for all agents.
 *
 * @example
 * const fleet = useFleet({
 *   workingDir: '/home/user/project',
 *   agents: [
 *     { id: 'main', model: 'sonnet', label: 'Architect' },
 *     { id: 'worker', model: 'haiku', label: 'Worker' },
 *   ],
 * });
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useLoveRPC } from './hooks';

// ── Public types ──────────────────────────────────────────────

export interface FleetAgentConfig {
  id: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  label?: string;
  workingDir?: string;
}

export interface FleetPermission {
  action: string;
  target: string;
  question: string;
}

export interface FleetQuestion {
  question: string;
  options: string[];
}

export interface FleetAgentState {
  id: string;
  model: string;
  label: string;
  status: string;
  perm: FleetPermission | null;
  question: FleetQuestion | null;

  /** Send a message to this agent's PTY. */
  send: (message: string) => void;
  /** Stop this agent's current operation. */
  stop: () => void;
  /** Respond to a permission prompt (1=approve, 2=allow-all, 3=deny). */
  respond: (choice: number) => void;
  /** Respond to a question prompt (1-indexed option). */
  respondQuestion: (optionIndex: number) => void;

  /** Pass to <Native type="ClaudeCode" onStatusChange={...} /> */
  onStatusChange: (e: any) => void;
  /** Pass to <Native type="ClaudeCode" onPermissionRequest={...} /> */
  onPermissionRequest: (e: any) => void;
  /** Pass to <Native type="ClaudeCode" onPermissionResolved={...} /> */
  onPermissionResolved: () => void;
  /** Pass to <Native type="ClaudeCode" onQuestionPrompt={...} /> */
  onQuestionPrompt: (e: any) => void;
}

export interface FleetOptions {
  workingDir: string;
  agents: FleetAgentConfig[];
}

export interface FleetResult {
  agents: FleetAgentState[];
  autoAccept: boolean;
  toggleAutoAccept: () => void;
  focused: string | null;
  setFocused: (id: string | null) => void;
}

// ── Per-agent state (internal) ────────────────────────────────

interface AgentInternal {
  status: string;
  perm: FleetPermission | null;
  question: FleetQuestion | null;
}

const INITIAL_AGENT: AgentInternal = {
  status: 'idle',
  perm: null,
  question: null,
};

// ── Hook ──────────────────────────────────────────────────────

export function useFleet(options: FleetOptions): FleetResult {
  const { workingDir, agents: configs } = options;

  // RPCs — session-scoped calls
  const rpcSend = useLoveRPC('claude:send');
  const rpcRespond = useLoveRPC('claude:respond');
  const rpcStop = useLoveRPC('claude:stop');
  const rpcAutoAccept = useLoveRPC('claude:autoaccept');

  // Keep RPC refs stable for callbacks
  const rpcRef = useRef({ send: rpcSend, respond: rpcRespond, stop: rpcStop, autoAccept: rpcAutoAccept });
  rpcRef.current = { send: rpcSend, respond: rpcRespond, stop: rpcStop, autoAccept: rpcAutoAccept };

  // Per-agent state map
  const [stateMap, setStateMap] = useState<Record<string, AgentInternal>>(() => {
    const m: Record<string, AgentInternal> = {};
    for (const c of configs) m[c.id] = { ...INITIAL_AGENT };
    return m;
  });

  // Global auto-accept
  const [autoAccept, setAutoAccept] = useState(false);

  // Sync auto-accept from Lua on mount
  useEffect(() => {
    rpcAutoAccept({}).then((res: any) => {
      setAutoAccept(!!res?.autoAccept);
    }).catch(() => {});
  }, [rpcAutoAccept]);

  const toggleAutoAccept = useCallback(async () => {
    try {
      const res = await rpcRef.current.autoAccept({ toggle: true }) as any;
      setAutoAccept(!!res?.autoAccept);
    } catch { /* silent */ }
  }, []);

  // Focused agent
  const [focused, setFocused] = useState<string | null>(configs[0]?.id ?? null);

  // Build per-agent state + actions
  const agentStates = useMemo<FleetAgentState[]>(() => {
    return configs.map((cfg) => {
      const id = cfg.id;
      const internal = stateMap[id] ?? INITIAL_AGENT;

      const send = (message: string) => {
        rpcRef.current.send({ session: id, message }).catch(() => {});
      };

      const stop = () => {
        rpcRef.current.stop({ session: id }).catch(() => {});
      };

      const respond = (choice: number) => {
        rpcRef.current.respond({ session: id, choice }).catch(() => {});
        setStateMap(prev => ({
          ...prev,
          [id]: { ...prev[id], perm: null },
        }));
      };

      const respondQuestion = (optionIndex: number) => {
        rpcRef.current.respond({ session: id, choice: optionIndex }).catch(() => {});
        setStateMap(prev => ({
          ...prev,
          [id]: { ...prev[id], question: null },
        }));
      };

      const onStatusChange = (e: any) => {
        const s = e.status || e.state || 'idle';
        setStateMap(prev => {
          if (prev[id]?.status === s) return prev;
          return { ...prev, [id]: { ...prev[id], status: s } };
        });
      };

      const onPermissionRequest = (e: any) => {
        setStateMap(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            perm: {
              action: e.action || 'Tool',
              target: e.target || '',
              question: e.question || '',
            },
          },
        }));
      };

      const onPermissionResolved = () => {
        setStateMap(prev => ({
          ...prev,
          [id]: { ...prev[id], perm: null },
        }));
      };

      const onQuestionPrompt = (e: any) => {
        setStateMap(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            question: {
              question: e.question || '',
              options: e.options || [],
            },
          },
        }));
      };

      return {
        id,
        model: cfg.model ?? 'sonnet',
        label: cfg.label ?? id,
        status: internal.status,
        perm: internal.perm,
        question: internal.question,
        send,
        stop,
        respond,
        respondQuestion,
        onStatusChange,
        onPermissionRequest,
        onPermissionResolved,
        onQuestionPrompt,
      };
    });
  }, [configs, stateMap]);

  return {
    agents: agentStates,
    autoAccept,
    toggleAutoAccept,
    focused,
    setFocused,
  };
}
