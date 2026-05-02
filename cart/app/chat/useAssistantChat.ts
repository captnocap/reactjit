// useAssistantChat — connection-aware chat hook seam.
//
// Reads the active Settings.defaultConnectionId, looks up the matching
// Connection row, and picks the appropriate generation hook. Returns
// the same { phase, streaming, ask, ... } shape regardless of which
// backend is driving — call sites stay backend-agnostic.
//
// v1: Claude only.
//   - claude-code-cli  → Claude SDK CLI subprocess (uses configDir)
//   - anthropic-api-key → Claude SDK CLI subprocess (no configDir)
// Other connection kinds (kimi-api-key, openai-api-key, local-runtime)
// fall through to Claude defaults today; their dedicated branches land
// when their hook implementations exist (see app.md line 1010).
//
// Both Claude kinds share the same V8 host bindings
// (__claude_init / __claude_send / __claude_poll / __claude_close), so
// the only piece that varies between them at v1 is whether configDir
// is forwarded into __claude_init.

import { useCRUD } from '@reactjit/runtime/hooks';
import { useClaudeChat } from '@reactjit/runtime/hooks/useClaudeChat';

const NS = 'app';
const SETTINGS_ID = 'settings_default';
const passthrough: any = { parse: (v: unknown) => v };

export function useAssistantChat() {
  const settingsStore = useCRUD<any>('settings', passthrough, { namespace: NS });
  const connectionStore = useCRUD<any>('connection', passthrough, { namespace: NS });

  const { data: settings } = settingsStore.useQuery(SETTINGS_ID);
  const connId = (settings && settings.defaultConnectionId) || '';
  const { data: conn } = connectionStore.useQuery(connId);

  const kind = conn && conn.kind;
  const cfgDir =
    kind === 'claude-code-cli' && conn?.credentialRef?.locator
      ? String(conn.credentialRef.locator)
      : '';
  const model = (settings && settings.defaultModelId) || 'claude-opus-4-7';

  return useClaudeChat({ model, configDir: cfgDir });
}
