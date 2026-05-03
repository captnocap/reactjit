// useAssistantChat — connection-aware chat hook seam.
//
// Reads the active Settings.defaultConnectionId, looks up the matching
// Connection row, and picks the appropriate generation hook. Returns
// the same { phase, streaming, ask, ... } shape regardless of which
// backend is driving — call sites stay backend-agnostic.
//
// Routing:
//   - claude-code-cli   → useClaudeChat (with configDir)
//   - anthropic-api-key → useClaudeChat (no configDir)
//   - local-runtime     → useLocalChat (subprocess llama.cpp on Vulkan;
//                          model field IS the absolute .gguf path)
//   - kimi-api-key / openai-api-key → fall through to Claude defaults
//                          (dedicated hooks land later)
//
// Rules-of-hooks: we always call BOTH useClaudeChat and useLocalChat
// every render and pick the surface to return based on `kind`. The
// inactive hook spins idle — for useLocalChat that means an empty
// model path, which short-circuits the worker spawn.

import { useCRUD } from '@reactjit/runtime/hooks';
import { useClaudeChat } from '@reactjit/runtime/hooks/useClaudeChat';
import { useLocalChat } from '@reactjit/runtime/hooks/useLocalChat';
import { callHost, hasHost } from '@reactjit/runtime/ffi';

const NS = 'app';
const SETTINGS_ID = 'settings_default';
const passthrough: any = { parse: (v: unknown) => v };

// Resolve the configDir literal stored on the Connection row to
// something the Claude CLI can read. Strips a leading `~/` or bare
// `~` against the user's HOME, and treats the canonical "~/.claude/"
// as "no override" (the CLI's own default already resolves to it).
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

export function useAssistantChat() {
  const settingsStore = useCRUD<any>('settings', passthrough, { namespace: NS });
  const connectionStore = useCRUD<any>('connection', passthrough, { namespace: NS });

  const { data: settings } = settingsStore.useQuery(SETTINGS_ID);
  const connId = (settings && settings.defaultConnectionId) || '';
  const { data: conn } = connectionStore.useQuery(connId);

  const kind = conn && conn.kind;
  const cfgDir =
    kind === 'claude-code-cli' && conn?.credentialRef?.locator
      ? resolveConfigDir(String(conn.credentialRef.locator))
      : '';
  const model = (settings && settings.defaultModelId) || 'claude-opus-4-7';
  const cwd = processCwd();

  // For local-runtime the .gguf path lives on Connection.credentialRef.locator
  // (LocalForm captures the absolute path there; defaultModelId only holds
  // the basename). Always call useLocalChat (rules of hooks); empty model
  // short-circuits the worker spawn so the non-active path costs nothing.
  const localPath =
    kind === 'local-runtime' && conn?.credentialRef?.locator
      ? String(conn.credentialRef.locator)
      : '';
  const localChat = useLocalChat({ model: localPath, nCtx: 4096 });
  const claudeChat = useClaudeChat({ cwd, model, configDir: cfgDir });

  if (kind === 'local-runtime' && localPath) {
    // Normalize useLocalChat's surface to match useClaudeChat's keys
    // that AssistantChatProvider consumes.
    return {
      phase: localChat.phase,
      streaming: localChat.streaming,
      ask: localChat.ask,
      ready: localChat.ready,
      error: localChat.error,
      lastStatus: localChat.lastStatus,
    } as any;
  }
  return claudeChat;
}
