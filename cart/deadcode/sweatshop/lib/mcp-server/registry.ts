import type { McpCallLogEntry, ToolDef } from './types';

const tools = new Map<string, ToolDef>();
const listeners = new Set<() => void>();
const MAX_LOG = 200;
let seq = 0;
const callLog: McpCallLogEntry[] = [];

function emit() {
  for (const fn of listeners) {
    try { fn(); } catch (_e) {}
  }
}

function toArgs(args: any): any {
  return args == null ? {} : args;
}

export function registerTool(def: ToolDef): () => void {
  tools.set(def.name, def);
  emit();
  return () => {
    const current = tools.get(def.name);
    if (current === def) tools.delete(def.name);
    emit();
  };
}

export function listTools(): ToolDef[] {
  return Array.from(tools.values());
}

export function getTool(name: string): ToolDef | null {
  return tools.get(name) || null;
}

export function subscribeTools(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getCallLog(): McpCallLogEntry[] {
  return callLog.slice();
}

export async function callTool(name: string, args: any): Promise<any> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Unknown MCP tool: ${name}`);

  const entry: McpCallLogEntry = {
    id: `mcp-${++seq}`,
    time: Date.now(),
    tool: name,
    args: toArgs(args),
  };
  callLog.unshift(entry);
  if (callLog.length > MAX_LOG) callLog.length = MAX_LOG;
  emit();

  try {
    const result = await tool.handler(entry.args);
    entry.result = result;
    emit();
    return result;
  } catch (error: any) {
    entry.error = error?.message || String(error);
    emit();
    throw error;
  }
}
