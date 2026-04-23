// Provider-agnostic AI types. OpenAI + Anthropic adapters share this
// vocabulary. Ported (re-synthesized) from the love2d reference at
// love2d/storybook/reactjit/ai/src/types.ts — kept in lockstep so the
// provider adapters stay drop-in compatible.

export type AIProviderType = 'openai' | 'anthropic' | 'custom';

export interface AIConfig {
  provider: AIProviderType;
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  proxy?: string;
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON-encoded
}

export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<any>;
}

export interface StreamDelta {
  content?: string;
  toolCalls?: Partial<ToolCall>[];
  done?: boolean;
}

export interface SSEEvent {
  event?: string;
  data: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: AIProviderType;
}

export interface APIKeyRecord {
  id: string;
  provider: AIProviderType;
  apiKey: string;
  label?: string;
  baseURL?: string;
  models?: string[];
}

export interface ProviderRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface ProviderModule {
  formatRequest(messages: Message[], config: AIConfig, tools?: ToolDefinition[], stream?: boolean): ProviderRequest;
  parseResponse(json: any): Message;
  parseStreamChunk(line: string, eventType?: string): StreamDelta | null;
  formatToolResult(callId: string, result: any): Message;
}

export interface ChatOptions extends Partial<AIConfig> {
  initialMessages?: Message[];
  tools?: ToolDefinition[];
  maxToolRounds?: number;
  onChunk?: (chunk: string) => void;
  onToolCall?: (call: ToolCall) => void;
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
