/**
 * @ilovereact/ai — Type definitions
 *
 * Provider-agnostic types for LLM integration.
 * Supports OpenAI-compatible and Anthropic APIs.
 */

// ── Provider types ──────────────────────────────────────

export type AIProviderType = 'openai' | 'anthropic' | 'custom';

export interface AIConfig {
  provider: AIProviderType;
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /** SOCKS5 or HTTP proxy URL — leverages Love2D's existing proxy support */
  proxy?: string;
}

// ── Message types ───────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments string */
  arguments: string;
}

export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

// ── Tool definitions ────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters */
  parameters: Record<string, any>;
  /** User-provided function to execute when the model calls this tool */
  execute: (args: any) => Promise<any>;
}

// ── Streaming types ─────────────────────────────────────

export interface StreamDelta {
  content?: string;
  toolCalls?: Partial<ToolCall>[];
  done?: boolean;
}

export interface SSEEvent {
  event?: string;
  data: string;
}

// ── Hook option types ───────────────────────────────────

export interface ChatOptions extends Partial<AIConfig> {
  initialMessages?: Message[];
  tools?: ToolDefinition[];
  /** Max tool call → response rounds before stopping. Default: 10 */
  maxToolRounds?: number;
  /** Called for each streaming content token */
  onChunk?: (chunk: string) => void;
  /** Called when the model invokes a tool */
  onToolCall?: (call: ToolCall) => void;
  /** Called on errors */
  onError?: (error: Error) => void;
}

export interface ChatResult {
  messages: Message[];
  send: (content: string) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  stop: () => void;
  error: Error | null;
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
}

export interface CompletionOptions extends Partial<AIConfig> {
  onChunk?: (chunk: string) => void;
  onError?: (error: Error) => void;
}

export interface CompletionResult {
  completion: string;
  complete: (prompt: string) => Promise<string>;
  isLoading: boolean;
  isStreaming: boolean;
  stop: () => void;
  error: Error | null;
}

export interface ModelsResult {
  models: ModelInfo[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: AIProviderType;
}

// ── Key storage types ───────────────────────────────────

export interface APIKeyRecord {
  id: string;
  provider: AIProviderType;
  apiKey: string;
  label?: string;
  baseURL?: string;
  models?: string[];
}

export interface APIKeysResult {
  keys: APIKeyRecord[];
  setKey: (record: Omit<APIKeyRecord, 'id'> & { id?: string }) => Promise<string>;
  deleteKey: (id: string) => Promise<void>;
  getKey: (provider: AIProviderType) => APIKeyRecord | undefined;
  loading: boolean;
}

// ── Provider interface ──────────────────────────────────

export interface ProviderRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface ProviderModule {
  formatRequest(
    messages: Message[],
    config: AIConfig,
    tools?: ToolDefinition[],
    stream?: boolean,
  ): ProviderRequest;

  parseResponse(json: any): Message;

  parseStreamChunk(line: string, eventType?: string): StreamDelta | null;

  formatToolResult(callId: string, result: any): Message;
}
