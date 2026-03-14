// ── Types ───────────────────────────────────────────────
export type {
  AIProviderType,
  AIConfig,
  MessageRole,
  ContentBlock,
  ToolCall,
  Message,
  ToolDefinition,
  StreamDelta,
  SSEEvent,
  ChatOptions,
  ChatResult,
  CompletionOptions,
  CompletionResult,
  ModelsResult,
  ModelInfo,
  APIKeyRecord,
  APIKeysResult,
  ProviderRequest,
  ProviderModule,
} from './types';

// ── Context ─────────────────────────────────────────────
export { AIProvider, useAIConfig } from './context';
export type { AIProviderProps } from './context';

// ── Hooks ───────────────────────────────────────────────
export { useChat, useCompletion, useModels, getProvider } from './hooks';

// ── Key Storage ─────────────────────────────────────────
export { useAPIKeys } from './keys';

// ── Streaming Utilities ─────────────────────────────────
export { SSEParser, startStream } from './stream';
export type { StreamHandle } from './stream';

// ── Tool Execution ──────────────────────────────────────
export { executeToolCalls, formatToolResults, shouldContinueLoop } from './tools';
export type { ToolExecutionResult } from './tools';

// ── Browse Integration ──────────────────────────────────
export { useBrowser, createBrowserTools } from './browse';
export type { BrowseOptions, BrowseResult, PageContent } from './browse';

// ── Providers ───────────────────────────────────────────
export { openai } from './providers/openai';
export { anthropic } from './providers/anthropic';

// ── MCP Integration ────────────────────────────────────
export { useMCPServer, MCPClient, estimateToolTokens, estimateToolBudget, createTransport } from './mcp';
export type {
  MCPServerConfig,
  MCPServerResult,
  MCPPermissionsConfig,
  MCPToolPermission,
  MCPTool,
  MCPTransportType,
} from './mcp';

// ── Components (Tier 2 — AI-wired) ───────────────────
export {
  AIMessageList,
  AIChatInput,
  AIModelSelector,
  AISettingsPanel,
  AIConversationSidebar,
  AIMessageWithActions,
} from './components';
export type {
  AIMessageListProps,
  AIChatInputProps,
  AIModelSelectorProps,
  AISettingsPanelProps,
  AIConversationSidebarProps,
  Conversation,
  AIMessageWithActionsProps,
} from './components';

// ── Templates (Tier 3 — drop-in UIs) ─────────────────
export { MinimalChat, SimpleChatUI, PowerChatUI } from './templates';
export type { MinimalChatProps, SimpleChatUIProps, PowerChatUIProps } from './templates';
