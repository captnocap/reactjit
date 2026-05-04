// Tool dispatcher. The single entry point assistants (and the chat
// provider, on the model's behalf) use to invoke a registered tool.
//
// Flow per call:
//   1. Look up the tool by name; unknown → error.
//   2. Compute the call's scope via `tool.scopeOf(args)`.
//   3. Check permission via ./permissions:checkPermission. Missing →
//      `permission_required` result with the (tool, scope) pair so the
//      provider can render a one-tap grant card.
//   4. Invoke `tool.handler(args)`. Throwing produces an error result
//      rather than bubbling — the chat provider treats results as data
//      to feed back to the model, not exceptions to crash on.

import { get as getTool } from './registry';
import { checkPermission, ensureGrantsLoaded } from './permissions';
import type { ToolCall, ToolResult } from './types';

export async function invokeTool<V = any>(call: ToolCall): Promise<ToolResult<V>> {
  const tool = getTool(call.name);
  if (!tool) {
    return { ok: false, error: `unknown tool: ${call.name}` };
  }
  let scope: string;
  try {
    scope = tool.scopeOf(call.args ?? {});
  } catch (e: any) {
    return { ok: false, error: `bad args: ${e?.message ?? String(e)}` };
  }

  await ensureGrantsLoaded();
  const allowed = checkPermission({ tool: tool.name, scope });
  if (!allowed) {
    return {
      ok: false,
      error: 'permission required',
      requires: { tool: tool.name, scope },
    };
  }

  try {
    const value = await Promise.resolve(tool.handler(call.args ?? {}));
    return { ok: true, value };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Encode a ToolCall as the `@tool/...` reply protocol the loom uses.
 *  The model emits these inside `<Btn reply="..."/>`; the provider
 *  intercepts them before bouncing back to chat.
 *
 *  Format: `@tool/NAME?json=<urlencoded JSON of args>`
 *  We keep args as a single JSON blob so nested objects don't need
 *  per-field URL escaping. */
export function encodeToolReply(call: ToolCall): string {
  const j = encodeURIComponent(JSON.stringify(call.args ?? {}));
  return `@tool/${call.name}?json=${j}`;
}

/** Inverse of encodeToolReply. Returns null if the string isn't a
 *  tool-reply (so the provider can fall through to normal chat). */
export function parseToolReply(s: string): ToolCall | null {
  if (!s.startsWith('@tool/')) return null;
  const rest = s.slice('@tool/'.length);
  const q = rest.indexOf('?');
  const name = q < 0 ? rest : rest.slice(0, q);
  if (!name) return null;
  let args: any = {};
  if (q >= 0) {
    const params = new URLSearchParams(rest.slice(q + 1));
    const j = params.get('json');
    if (j) {
      try { args = JSON.parse(decodeURIComponent(j)); }
      catch { return null; }
    }
  }
  return { name, args };
}

/** Encode a permission grant request the same way. The grant card the
 *  provider renders carries one of these in its primary Btn. */
export function encodeGrantReply(tool: string, scope: string): string {
  return `@grant/${encodeURIComponent(tool)}/${encodeURIComponent(scope)}`;
}

export interface ParsedGrant { tool: string; scope: string }

export function parseGrantReply(s: string): ParsedGrant | null {
  if (!s.startsWith('@grant/')) return null;
  const rest = s.slice('@grant/'.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  return {
    tool: decodeURIComponent(rest.slice(0, slash)),
    scope: decodeURIComponent(rest.slice(slash + 1)),
  };
}
