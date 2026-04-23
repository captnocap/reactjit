import { getCallLog, listTools } from './registry';
import type { McpServerState } from './types';

const host: any = globalThis as any;

export type TransportCapabilities = {
  httpListen: boolean;
  exec: boolean;
  execAsync: boolean;
  pty: boolean;
  fsRead: boolean;
  fsWrite: boolean;
};

export function probeTransportCapabilities(): TransportCapabilities {
  return {
    httpListen: typeof host.__http_listen === 'function',
    exec: typeof host.__exec === 'function',
    execAsync: typeof host.__exec_async === 'function',
    pty: typeof host.__pty_open === 'function' && typeof host.__pty_read === 'function' && typeof host.__pty_write === 'function',
    fsRead: typeof host.__fs_readfile === 'function',
    fsWrite: typeof host.__fs_writefile === 'function',
  };
}

export type BridgePaths = {
  script: string;
  pid: string;
  request: string;
  response: string;
  log: string;
};

export function bridgePaths(port: number): BridgePaths {
  return {
    script: `/tmp/reactjit-mcp-${port}.bridge.py`,
    pid: `/tmp/reactjit-mcp-${port}.bridge.pid`,
    request: `/tmp/reactjit-mcp-${port}.bridge.request.json`,
    response: `/tmp/reactjit-mcp-${port}.bridge.response.json`,
    log: `/tmp/reactjit-mcp-${port}.bridge.log`,
  };
}

export function bridgeSupported(): boolean {
  const caps = probeTransportCapabilities();
  return caps.execAsync && caps.fsRead && caps.fsWrite;
}

export function capabilityBanner(): string | null {
  const caps = probeTransportCapabilities();
  if (caps.httpListen) return null;
  if (bridgeSupported()) {
    return 'Native __http_listen is missing. Running a localhost bridge via __exec_async + file IO so external MCP clients can still connect.';
  }
  const missing: string[] = [];
  if (!caps.httpListen) missing.push('__http_listen');
  if (!caps.execAsync) missing.push('__exec_async');
  if (!caps.fsRead) missing.push('__fs_readfile');
  if (!caps.fsWrite) missing.push('__fs_writefile');
  return `MCP server transport is blocked until ${missing.join(' and ')} is registered in the host. The tool registry and call log still work locally.`;
}

export function initialServerState(): McpServerState {
  return {
    running: false,
    transport: 'disabled',
    port: null,
    url: null,
    startedAt: null,
    lastError: null,
    capabilityBanner: capabilityBanner(),
    clients: [],
  };
}

export function summarizeTransportState(state: McpServerState): string {
  if (state.running) return `${state.transport} · ${state.url || 'localhost'}`;
  return state.capabilityBanner || 'stopped';
}

export function buildSnapshot() {
  return {
    tools: listTools(),
    calls: getCallLog(),
    capabilities: probeTransportCapabilities(),
  };
}
