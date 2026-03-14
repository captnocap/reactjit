/**
 * Vesper — Shared application types.
 */

import type { AIProviderType, Message } from '@reactjit/ai';

// ── Navigation ───────────────────────────────────────────

export type ViewId = 'chat' | 'compare' | 'terminal' | 'research' | 'settings';

// ── Providers ────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  baseURL: string;
  apiKey: string;
  healthy: boolean;
}

// ── Conversations ────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ── Settings ─────────────────────────────────────────────

export interface AppSettings {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  activeProviderId: string;
  activeModel: string;
  fontSize: number;
  lineHeight: 'tight' | 'normal' | 'relaxed';
}

export const DEFAULT_SETTINGS: AppSettings = {
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 4096,
  activeProviderId: 'ollama',
  activeModel: '',
  fontSize: 14,
  lineHeight: 'normal',
};

// ── Default Providers ────────────────────────────────────

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'openai',
    baseURL: 'http://localhost:11434',
    apiKey: '',
    healthy: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseURL: 'https://api.openai.com',
    apiKey: '',
    healthy: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    apiKey: '',
    healthy: false,
  },
];
