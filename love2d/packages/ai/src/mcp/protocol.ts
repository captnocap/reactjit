/**
 * MCP (Model Context Protocol) — JSON-RPC 2.0 types and message builders.
 *
 * Implements the MCP specification for client→server communication.
 * Protocol version: 2025-11-05
 */

// ── Protocol constants ─────────────────────────────────────

export const MCP_PROTOCOL_VERSION = '2025-11-05';

export const MCP_CLIENT_INFO = {
  name: 'reactjit',
  version: '1.0.0',
} as const;

// ── JSON-RPC 2.0 base types ───────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// ── MCP initialize ────────────────────────────────────────

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: Record<string, any>;
  clientInfo: { name: string; version: string };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: Record<string, any>;
  serverInfo: { name: string; version?: string };
}

// ── MCP tools ─────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPToolCallParams {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolCallResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

// ── Config types (for useMCPServer hook) ──────────────────

export type MCPTransportType = 'stdio' | 'sse' | 'streamable-http';

export interface MCPServerConfig {
  name: string;
  transport: MCPTransportType;
  // stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // HTTP transports (SSE / streamable HTTP)
  url?: string;
  headers?: Record<string, string>;
  // shared
  timeout?: number;
  permissions?: MCPPermissionsConfig;
  onConfirm?: (toolName: string, args: any) => Promise<boolean>;
}

// ── Permissions config (shape of mcp.tools.json entries) ──

export interface MCPToolPermission {
  enabled: boolean;
  confirm: boolean;
  description?: string;
  inputSchema?: Record<string, any>;
  tokenEstimate?: number;
  _stale?: boolean;
}

export interface MCPPermissionsConfig {
  lastDiscovered?: string;
  tools: Record<string, MCPToolPermission>;
  tokenBudget?: {
    totalIfAllEnabled: number;
    note: string;
  };
}

// ── Hook return type ──────────────────────────────────────

export interface MCPServerResult {
  status: 'connecting' | 'ready' | 'error';
  tools: import('../types').ToolDefinition[];
  availableTools: string[];
  error: Error | null;
  disconnect: () => void;
}

// ── Message builders ──────────────────────────────────────

let _nextId = 1;

export function createRequest(method: string, params?: Record<string, any>): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: _nextId++,
    method,
    params,
  };
}

export function createNotification(method: string, params?: Record<string, any>): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

export function parseResponse(json: any): any {
  if (json.error) {
    const err = json.error as JsonRpcError;
    throw new Error(`MCP error ${err.code}: ${err.message}${err.data ? ' — ' + JSON.stringify(err.data) : ''}`);
  }
  return json.result;
}

export function createInitializeRequest(): JsonRpcRequest {
  return createRequest('initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: MCP_CLIENT_INFO,
  });
}

export function createToolsListRequest(): JsonRpcRequest {
  return createRequest('tools/list', {});
}

export function createToolCallRequest(name: string, args: Record<string, any>): JsonRpcRequest {
  return createRequest('tools/call', { name, arguments: args });
}

export function createInitializedNotification(): JsonRpcRequest {
  return createNotification('notifications/initialized', {});
}
