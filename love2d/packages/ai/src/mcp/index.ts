// ── MCP Integration ──────────────────────────────────────

export { useMCPServer } from './hook';
export { MCPClient } from './client';
export { estimateToolTokens, estimateToolBudget } from './token-estimate';
export { createTransport } from './transport';

export type {
  MCPServerConfig,
  MCPServerResult,
  MCPPermissionsConfig,
  MCPToolPermission,
  MCPTool,
  MCPTransportType,
  MCPContent,
} from './protocol';
