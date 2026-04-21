// =============================================================================
// PROVIDER CONFIGS — ported from AI app specs/SPEC_AI_PROVIDER.md
// =============================================================================

export type ProviderType = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'meta' | 'mistral' | 'xai' | 'groq' | 'qwen' | 'alibaba' | 'zhipu' | 'cohere' | 'perplexity' | 'together' | 'fireworks' | 'kimi' | 'local' | 'qjs';

export interface ModelConfig {
  id: string;
  provider: ProviderType;
  displayName: string;
  contextWindow: number;
  maxOutput: number;
  supportsVision: boolean;
  supportsTools: boolean;
  inputPrice: number;   // USD per million tokens
  outputPrice: number;  // USD per million tokens
}

export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  baseUrl: string;
  apiVersion?: string;
  defaultModel: string;
  models: ModelConfig[];
}

// ── Anthropic ────────────────────────────────────────────────────────────────

// Aligned with cart/cockpit LIVE_MODELS. Claude Code CLI + Kimi CLI are wired
// through __claude_* / __kimi_* host FFI; Codex lane is listed but offline
// until the CLI ships.
const ANTHROPIC_MODELS: ModelConfig[] = [
  { id: 'claude-opus-4-7',    provider: 'anthropic', displayName: 'Claude Opus 4.7',        contextWindow: 200000, maxOutput: 32000, supportsVision: true, supportsTools: true, inputPrice: 15,   outputPrice: 75 },
  { id: 'claude-opus-4-7-1m', provider: 'anthropic', displayName: 'Claude Opus 4.7 [1M]',   contextWindow: 1000000, maxOutput: 32000, supportsVision: true, supportsTools: true, inputPrice: 15,  outputPrice: 75 },
  { id: 'claude-opus-4-6',    provider: 'anthropic', displayName: 'Claude Opus 4.6',        contextWindow: 200000, maxOutput: 32000, supportsVision: true, supportsTools: true, inputPrice: 15,   outputPrice: 75 },
  { id: 'claude-sonnet-4-6',  provider: 'anthropic', displayName: 'Claude Sonnet 4.6',      contextWindow: 200000, maxOutput: 64000, supportsVision: true, supportsTools: true, inputPrice: 3,    outputPrice: 15 },
  { id: 'claude-sonnet-4-5',  provider: 'anthropic', displayName: 'Claude Sonnet 4.5',      contextWindow: 200000, maxOutput: 64000, supportsVision: true, supportsTools: true, inputPrice: 3,    outputPrice: 15 },
  { id: 'claude-haiku-4-5',   provider: 'anthropic', displayName: 'Claude Haiku 4.5',       contextWindow: 200000, maxOutput: 8192,  supportsVision: true, supportsTools: true, inputPrice: 1,    outputPrice: 5 },
];

// ── OpenAI ───────────────────────────────────────────────────────────────────

const OPENAI_MODELS: ModelConfig[] = [
  { id: 'gpt-5-codex',    provider: 'openai', displayName: 'GPT-5 Codex',     contextWindow: 400000, maxOutput: 16384, supportsVision: true,  supportsTools: true,  inputPrice: 0,    outputPrice: 0 },
  { id: 'gpt-5.4',        provider: 'openai', displayName: 'GPT-5.4',         contextWindow: 400000, maxOutput: 16384, supportsVision: true,  supportsTools: true,  inputPrice: 0,    outputPrice: 0 },
  { id: 'gpt-5.4-mini',   provider: 'openai', displayName: 'GPT-5.4 mini',    contextWindow: 400000, maxOutput: 16384, supportsVision: true,  supportsTools: true,  inputPrice: 0,    outputPrice: 0 },
  { id: 'codex',          provider: 'openai', displayName: 'Codex (legacy)',  contextWindow: 0,      maxOutput: 0,     supportsVision: false, supportsTools: false, inputPrice: 0,    outputPrice: 0 },
];

// ── Google ───────────────────────────────────────────────────────────────────

const GOOGLE_MODELS: ModelConfig[] = [
  { id: 'gemini-2.0-flash', provider: 'google', displayName: 'Gemini 2.0 Flash', contextWindow: 1000000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 0.075, outputPrice: 0.3 },
  { id: 'gemini-1.5-pro', provider: 'google', displayName: 'Gemini 1.5 Pro', contextWindow: 2000000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 1.25, outputPrice: 5 },
];

// ── DeepSeek ─────────────────────────────────────────────────────────────────

const DEEPSEEK_MODELS: ModelConfig[] = [
  { id: 'deepseek-chat', provider: 'deepseek', displayName: 'DeepSeek Chat', contextWindow: 64000, maxOutput: 8192, supportsVision: false, supportsTools: true, inputPrice: 0.14, outputPrice: 0.28 },
  { id: 'deepseek-reasoner', provider: 'deepseek', displayName: 'DeepSeek Reasoner', contextWindow: 64000, maxOutput: 8192, supportsVision: false, supportsTools: false, inputPrice: 0.55, outputPrice: 2.19 },
];

// ── Meta ─────────────────────────────────────────────────────────────────────

const META_MODELS: ModelConfig[] = [
  { id: 'llama-3.3-70b-instruct', provider: 'meta', displayName: 'Llama 3.3 70B', contextWindow: 128000, maxOutput: 8192, supportsVision: false, supportsTools: true, inputPrice: 0.12, outputPrice: 0.3 },
  { id: 'llama-3.2-90b-vision-instruct', provider: 'meta', displayName: 'Llama 3.2 90B Vision', contextWindow: 128000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 0.9, outputPrice: 0.9 },
];

// ── Mistral ──────────────────────────────────────────────────────────────────

const MISTRAL_MODELS: ModelConfig[] = [
  { id: 'mistral-large', provider: 'mistral', displayName: 'Mistral Large', contextWindow: 128000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 2, outputPrice: 6 },
  { id: 'codestral-2508', provider: 'mistral', displayName: 'Codestral', contextWindow: 256000, maxOutput: 8192, supportsVision: false, supportsTools: true, inputPrice: 0.3, outputPrice: 0.9 },
];

// ── xAI ──────────────────────────────────────────────────────────────────────

const XAI_MODELS: ModelConfig[] = [
  { id: 'grok-2', provider: 'xai', displayName: 'Grok 2', contextWindow: 128000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 5, outputPrice: 15 },
];

// ── Groq ─────────────────────────────────────────────────────────────────────

const GROQ_MODELS: ModelConfig[] = [
  { id: 'llama-3.3-70b-versatile', provider: 'groq', displayName: 'Llama 3.3 70B', contextWindow: 128000, maxOutput: 32768, supportsVision: false, supportsTools: true, inputPrice: 0.59, outputPrice: 0.79 },
  { id: 'mixtral-8x7b-32768', provider: 'groq', displayName: 'Mixtral 8x7B', contextWindow: 32768, maxOutput: 32768, supportsVision: false, supportsTools: true, inputPrice: 0.24, outputPrice: 0.24 },
];

// ── Qwen ─────────────────────────────────────────────────────────────────────

const QWEN_MODELS: ModelConfig[] = [
  { id: 'qwen-max', provider: 'qwen', displayName: 'Qwen Max', contextWindow: 32000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 1.6, outputPrice: 6.4 },
  { id: 'qwq-32b', provider: 'qwen', displayName: 'QwQ 32B', contextWindow: 128000, maxOutput: 8192, supportsVision: false, supportsTools: true, inputPrice: 0.2, outputPrice: 0.6 },
];

// ── Alibaba ──────────────────────────────────────────────────────────────────

const ALIBABA_MODELS: ModelConfig[] = [
  { id: 'qwen-max', provider: 'alibaba', displayName: 'Qwen Max', contextWindow: 32000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 1.6, outputPrice: 6.4 },
];

// ── Kimi ─────────────────────────────────────────────────────────────────────

const KIMI_MODELS: ModelConfig[] = [
  { id: 'kimi-k2.5',                 provider: 'kimi', displayName: 'Kimi K2.5',          contextWindow: 256000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 0.5, outputPrice: 2 },
  { id: 'kimi-k2',                   provider: 'kimi', displayName: 'Kimi K2',            contextWindow: 256000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 0.5, outputPrice: 2 },
  { id: 'kimi-k2-thinking',          provider: 'kimi', displayName: 'Kimi K2 Thinking',   contextWindow: 256000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 0.5, outputPrice: 2 },
  { id: 'kimi-code/kimi-for-coding', provider: 'kimi', displayName: 'Kimi for Coding',    contextWindow: 256000, maxOutput: 8192, supportsVision: true, supportsTools: true, inputPrice: 0.5, outputPrice: 2 },
];

// ── Local / QJS (runtime-only, no network models) ────────────────────────────

// Local OpenAI-compatible endpoint (LM Studio / Ollama / llama.cpp). Actual
// model ids are discovered at runtime via listLocalModels(); entries here are
// defaults for the two lanes we care about (chat + embeddings).
const LOCAL_MODELS: ModelConfig[] = [
  { id: 'local/chat',       provider: 'local', displayName: 'Local Chat (LM Studio)',      contextWindow: 32768, maxOutput: 4096, supportsVision: false, supportsTools: true,  inputPrice: 0, outputPrice: 0 },
  { id: 'local/embeddings', provider: 'local', displayName: 'Local Embeddings (LM Studio)', contextWindow: 8192,  maxOutput: 0,    supportsVision: false, supportsTools: false, inputPrice: 0, outputPrice: 0 },
  { id: 'local-heuristics', provider: 'local', displayName: 'Local Heuristics',             contextWindow: 0,     maxOutput: 0,    supportsVision: false, supportsTools: false, inputPrice: 0, outputPrice: 0 },
];

const QJS_MODELS: ModelConfig[] = [
  { id: 'qjs-plugin', provider: 'qjs', displayName: 'QJS Plugin Logic', contextWindow: 0, maxOutput: 0, supportsVision: false, supportsTools: false, inputPrice: 0, outputPrice: 0 },
];

// ── Registry ─────────────────────────────────────────────────────────────────

export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  anthropic: { type: 'anthropic', enabled: true, baseUrl: 'https://api.anthropic.com/v1', apiVersion: '2023-06-01', defaultModel: 'claude-sonnet-4-6', models: ANTHROPIC_MODELS },
  openai: { type: 'openai', enabled: true, baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-5-codex', models: OPENAI_MODELS },
  google: { type: 'google', enabled: true, baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash', models: GOOGLE_MODELS },
  deepseek: { type: 'deepseek', enabled: false, baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', models: DEEPSEEK_MODELS },
  meta: { type: 'meta', enabled: false, baseUrl: '', defaultModel: 'llama-3.3-70b-instruct', models: META_MODELS },
  mistral: { type: 'mistral', enabled: false, baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-large', models: MISTRAL_MODELS },
  xai: { type: 'xai', enabled: false, baseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-2', models: XAI_MODELS },
  groq: { type: 'groq', enabled: false, baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', models: GROQ_MODELS },
  qwen: { type: 'qwen', enabled: false, baseUrl: 'https://dashscope.aliyuncs.com/api/v1', defaultModel: 'qwen-max', models: QWEN_MODELS },
  alibaba: { type: 'alibaba', enabled: false, baseUrl: 'https://dashscope.aliyuncs.com/api/v1', defaultModel: 'qwen-max', models: ALIBABA_MODELS },
  zhipu: { type: 'zhipu', enabled: false, baseUrl: '', defaultModel: '', models: [] },
  cohere: { type: 'cohere', enabled: false, baseUrl: '', defaultModel: '', models: [] },
  perplexity: { type: 'perplexity', enabled: false, baseUrl: '', defaultModel: '', models: [] },
  together: { type: 'together', enabled: false, baseUrl: '', defaultModel: '', models: [] },
  fireworks: { type: 'fireworks', enabled: false, baseUrl: '', defaultModel: '', models: [] },
  kimi: { type: 'kimi', enabled: true, baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'kimi-k2.5', models: KIMI_MODELS },
  local: { type: 'local', enabled: true, baseUrl: 'http://localhost:1234/v1', defaultModel: 'local/chat', models: LOCAL_MODELS },
  qjs: { type: 'qjs', enabled: true, baseUrl: '', defaultModel: 'qjs-plugin', models: QJS_MODELS },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getProviderConfig(provider: ProviderType): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function getProviderModels(provider: ProviderType): ModelConfig[] {
  return PROVIDER_CONFIGS[provider].models;
}

export function getModelConfig(provider: ProviderType, modelId: string): ModelConfig | undefined {
  return PROVIDER_CONFIGS[provider].models.find(m => m.id === modelId);
}

export function getDefaultModel(provider: ProviderType): string {
  return PROVIDER_CONFIGS[provider].defaultModel;
}

export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS);
}

export function getEnabledProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.enabled);
}

export function getAllModels(): ModelConfig[] {
  return getAllProviders().flatMap(p => p.models);
}

export function getEnabledModels(): ModelConfig[] {
  return getEnabledProviders().flatMap(p => p.models);
}

export function findModelById(modelId: string): ModelConfig | undefined {
  return getAllModels().find(m => m.id === modelId);
}

export function findProviderForModel(modelId: string): ProviderType | undefined {
  for (const [type, config] of Object.entries(PROVIDER_CONFIGS)) {
    if (config.models.some(m => m.id === modelId)) return type as ProviderType;
  }
  return undefined;
}

export function backendForModel(modelId: string): string {
  if (modelId.startsWith('claude-')) return 'claude';
  if (modelId.startsWith('kimi-')) return 'kimi';
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
  if (modelId.startsWith('local/') || modelId === 'local-heuristics') return 'local';
  return 'claude';
}
