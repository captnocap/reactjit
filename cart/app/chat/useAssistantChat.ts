// useAssistantChat — bridge from cart's Promise-shaped chat API to the
// unified useAssistant hook. Mounts one worker (currently the
// `assistant` role), reads Settings → Actions to derive backend +
// model + connection, and exposes ask(text, { onPart }) so the existing
// AssistantChatProvider stays unchanged.
//
// Connection.kind → backend mapping:
//   - claude-code-cli   → claude_code (claude_sdk drives the CLI)
//   - anthropic-api-key → claude_code (same SDK; no configDir override)
//   - kimi-api-key      → kimi_cli_wire
//   - local-runtime     → unsupported until Backend gains local_ai
//   - openai-api-key    → unsupported until codex_app_server bridge lands

import { useEffect, useMemo, useRef } from 'react';
import { useCRUD } from '../db';
import { useAssistant, type AssistantBackend } from '@reactjit/runtime/hooks/useAssistant';
import { callHost, hasHost } from '@reactjit/runtime/ffi';

const NS = 'app';
const SETTINGS_ID = 'settings_default';
const passthrough: any = { parse: (v: unknown) => v };

function resolveConfigDir(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (v === '~/.claude' || v === '~/.claude/') return '';
  if (v.startsWith('~/') || v === '~') {
    const home = hasHost('__env') ? (callHost<string>('__env', '', 'HOME') || '') : '';
    if (home) return v === '~' ? home : `${home}/${v.slice(2)}`;
  }
  return v;
}

function processCwd(): string {
  if (hasHost('__cwd')) {
    try {
      const v = callHost<string>('__cwd', '');
      if (typeof v === 'string' && v.length > 0) return v;
    } catch { /* ignore */ }
  }
  if (hasHost('__env')) {
    try {
      const home = callHost<string>('__env', '', 'HOME');
      if (typeof home === 'string' && home.length > 0) return home;
    } catch { /* ignore */ }
  }
  return '/';
}

function kindToBackend(kind: string | undefined): AssistantBackend | undefined {
  if (!kind) return undefined;
  if (kind === 'claude-code-cli' || kind === 'anthropic-api-key') return 'claude_code';
  if (kind === 'kimi-api-key') return 'kimi_cli_wire';
  if (kind === 'local-runtime') return 'local_ai';
  return undefined;
}

export interface ChatAskOpts {
  onPart?: (partial: string) => void;
}

export function useAssistantChat() {
  const settingsStore = useCRUD<any>('settings', passthrough, { namespace: NS });
  const connectionStore = useCRUD<any>('connection', passthrough, { namespace: NS });
  const modelStore = useCRUD<any>('model', passthrough, { namespace: NS });

  const { data: settings } = settingsStore.useQuery(SETTINGS_ID);
  const boundModelId = settings?.actionDefaults?.assistant || '';
  const { data: boundModel } = modelStore.useQuery(boundModelId);
  const connId = boundModel?.connectionId || '';
  const { data: conn } = connectionStore.useQuery(connId);

  const kind = conn?.kind as string | undefined;
  const backend = kindToBackend(kind);
  const cfgDir =
    kind === 'claude-code-cli' && conn?.credentialRef?.locator
      ? resolveConfigDir(String(conn.credentialRef.locator))
      : '';
  const model = boundModel?.remoteId || '';
  const modelPath =
    kind === 'local-runtime' && conn?.credentialRef?.locator
      ? String(conn.credentialRef.locator)
      : '';
  const cwd = processCwd();

  const assistant = useAssistant({
    backend,
    cwd,
    model,
    modelPath,
    configDir: cfgDir,
    nCtx: backend === 'local_ai' ? 4096 : undefined,
  });

  // Pending-ask bridge: track the assistant_message events that arrive
  // after we sent, accumulate text, fire onPart, resolve on completion.
  const pendingRef = useRef<{
    cursor: number;
    onPart: ((s: string) => void) | null;
    resolve: ((s: string) => void) | null;
    reject: ((e: any) => void) | null;
    accum: string;
  } | null>(null);

  useEffect(() => {
    const p = pendingRef.current;
    if (!p) return;
    const events = assistant.events;
    if (events.length <= p.cursor) return;

    let resolved = false;
    let errored: string | null = null;
    for (let i = p.cursor; i < events.length; i++) {
      const ev = events[i];
      if (ev.kind === 'assistant_message' && ev.role === 'assistant' && typeof ev.text === 'string') {
        p.accum += ev.text;
        if (p.onPart) p.onPart(p.accum);
      } else if (ev.kind === 'completion') {
        resolved = true;
      } else if (ev.kind === 'error_') {
        errored = ev.text || ev.status_text || 'worker error';
      }
    }
    p.cursor = events.length;
    if (resolved) {
      pendingRef.current = null;
      p.resolve?.(p.accum);
    } else if (errored) {
      pendingRef.current = null;
      p.reject?.(new Error(errored));
    }
  }, [assistant.events]);

  // Status surface for AssistantChat header — derive from latest
  // status / lifecycle event so the provider's setChatStatus call has
  // something meaningful to publish.
  const lastStatus = useMemo(() => {
    for (let i = assistant.events.length - 1; i >= 0; i -= 1) {
      const ev = assistant.events[i];
      if (ev.kind === 'status' || ev.kind === 'lifecycle') {
        return ev.status_text || ev.text || '';
      }
    }
    return '';
  }, [assistant.events]);

  const ask = (text: string, opts: ChatAskOpts = {}): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!backend) {
        reject(new Error(`unsupported connection kind: ${kind ?? '(none — pick a model in Settings → Actions)'}`));
        return;
      }
      if (assistant.phase === 'failed') {
        reject(new Error(assistant.error ?? 'worker failed'));
        return;
      }
      if (pendingRef.current) {
        reject(new Error('previous ask still pending'));
        return;
      }
      pendingRef.current = {
        cursor: assistant.events.length,
        onPart: opts.onPart || null,
        resolve, reject,
        accum: '',
      };
      const ok = assistant.ask(text);
      if (!ok) {
        pendingRef.current = null;
        reject(new Error('worker_send returned false (worker not ready or send failed)'));
      }
    });
  };

  return {
    phase: assistant.phase,
    lastStatus,
    error: assistant.error,
    ask,
    ready: assistant.ready,
  };
}
