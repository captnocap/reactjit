import type { ToolDefinition, ToolCall } from './types';

// Tool registry + argument validation + execution dispatch.
// Registry is module-level; panels can register/unregister as they mount.

const registry = new Map<string, ToolDefinition>();
const listeners = new Set<() => void>();

export function registerTool(tool: ToolDefinition): () => void {
  registry.set(tool.name, tool);
  for (const fn of listeners) fn();
  return () => unregisterTool(tool.name);
}

export function unregisterTool(name: string): void {
  registry.delete(name);
  for (const fn of listeners) fn();
}

export function listTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function subscribeTools(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Minimal JSON-schema-ish validator. Accepts `type`/`required`/nested
// `properties` for object schemas. Enough to catch shape mismatches the
// model produces; not a full JSON Schema implementation.
export function validateArgs(schema: any, args: any): { ok: true } | { ok: false; error: string } {
  if (!schema || typeof schema !== 'object') return { ok: true };
  const t = schema.type;
  if (t === 'object') {
    if (args == null || typeof args !== 'object' || Array.isArray(args)) return { ok: false, error: 'expected object' };
    const props = schema.properties || {};
    for (const req of (schema.required || [])) {
      if (!(req in args)) return { ok: false, error: 'missing required: ' + req };
    }
    for (const k of Object.keys(args)) {
      if (props[k]) {
        const inner = validateArgs(props[k], args[k]);
        if (!inner.ok) return { ok: false, error: k + ': ' + inner.error };
      }
    }
    return { ok: true };
  }
  if (t === 'array') {
    if (!Array.isArray(args)) return { ok: false, error: 'expected array' };
    return { ok: true };
  }
  if (t === 'string')  return typeof args === 'string'  ? { ok: true } : { ok: false, error: 'expected string' };
  if (t === 'number' || t === 'integer') return typeof args === 'number' ? { ok: true } : { ok: false, error: 'expected number' };
  if (t === 'boolean') return typeof args === 'boolean' ? { ok: true } : { ok: false, error: 'expected boolean' };
  return { ok: true };
}

// Parse JSON-encoded args from a ToolCall and run the tool. Returns the
// raw result (tool author owns shape); caller serializes for the model.
export async function executeToolCall(call: ToolCall): Promise<{ ok: boolean; result?: any; error?: string }> {
  const tool = registry.get(call.name);
  if (!tool) return { ok: false, error: 'unknown tool: ' + call.name };
  let args: any;
  try { args = call.arguments ? JSON.parse(call.arguments) : {}; }
  catch (e: any) { return { ok: false, error: 'bad JSON args: ' + (e?.message || String(e)) }; }
  const v = validateArgs(tool.parameters, args);
  if (!v.ok) return { ok: false, error: 'invalid args: ' + v.error };
  try {
    const result = await tool.execute(args);
    return { ok: true, result };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
