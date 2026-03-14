import type { AIProviderType, Message } from '@reactjit/ai';
import { z } from '@reactjit/storage/schema';

export interface Provider {
  id: string;
  name: string;
  type: AIProviderType;
  baseURL?: string;
  apiKey?: string;
  icon: string;
  healthy?: boolean;
}

export interface ConversationRecord {
  id: string;
  title: string;
  providerId: string;
  model: string;
  messages: Message[];
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  totalTokens?: number;
  tags?: string[];
  pinned?: boolean;
  parentId?: string;       // forked from this conversation
  branchPoint?: number;    // message index where branch occurred
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  parameter_size?: string;
  quantization_level?: string;
  family?: string;
  format?: string;
}

export type View = 'chat' | 'compare' | 'providers' | 'models' | 'server';

// ── Built-in providers ───────────────────────────────────────────────────────

export const DEFAULT_PROVIDERS: Provider[] = [
  { id: 'ollama', name: 'Ollama', type: 'openai', baseURL: 'http://localhost:11434', icon: '\u{1F999}' },
  { id: 'llamacpp', name: 'llama.cpp', type: 'openai', baseURL: 'http://localhost:8080', icon: '\u{1F4BB}' },
  { id: 'vllm', name: 'vLLM', type: 'openai', baseURL: 'http://localhost:8000', icon: '\u26A1' },
  { id: 'lmstudio', name: 'LM Studio', type: 'openai', baseURL: 'http://localhost:1234', icon: '\u{1F9EA}' },
  { id: 'openai', name: 'OpenAI', type: 'openai', icon: '\u{1F916}' },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', icon: '\u{1F9E0}' },
];

// ── Schemas for SQLite persistence ───────────────────────────────────────────

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  providerId: z.string(),
  model: z.string(),
  messages: z.string(), // JSON-serialized Message[]
  systemPrompt: z.string(),
  updatedAt: z.number(),
});

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  baseURL: z.string().optional(),
  apiKey: z.string().optional(),
  icon: z.string(),
});
