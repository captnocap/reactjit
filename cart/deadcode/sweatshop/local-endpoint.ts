// =============================================================================
// LOCAL ENDPOINT — OpenAI-compatible HTTP (LM Studio / Ollama / llama.cpp)
// =============================================================================
//
// One endpoint handles both chat and embeddings (LM Studio serves both on the
// same port). Config is persistent via __store_get/__store_set. All calls ride
// on the runtime fetch() shim (runtime/hooks/http.ts).
//
// Defaults to LM Studio: http://localhost:1234/v1
//   • Ollama: http://localhost:11434/v1
//   • llama.cpp server: http://localhost:8080/v1
// =============================================================================

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

export interface LocalEndpointConfig {
  baseUrl: string;
  apiKey: string;            // most local servers ignore this; keep for compat
  chatModel: string;         // default model id when none specified
  embeddingModel: string;    // embedding model id on the same endpoint
}

const STORE_KEY = 'sweatshop:localEndpoint';

export const DEFAULT_LOCAL_ENDPOINT: LocalEndpointConfig = {
  baseUrl: 'http://localhost:1234/v1',
  apiKey: 'lm-studio',
  chatModel: 'local-model',
  embeddingModel: 'text-embedding-nomic-embed-text-v1.5',
};

export function loadLocalEndpoint(): LocalEndpointConfig {
  const raw = storeGet(STORE_KEY);
  if (!raw) return DEFAULT_LOCAL_ENDPOINT;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LOCAL_ENDPOINT, ...parsed };
  } catch {
    return DEFAULT_LOCAL_ENDPOINT;
  }
}

export function saveLocalEndpoint(cfg: LocalEndpointConfig): void {
  storeSet(STORE_KEY, JSON.stringify(cfg));
}

// ── List models ─────────────────────────────────────────────────────────────

export interface LocalModelInfo { id: string; object?: string; owned_by?: string }

export async function listLocalModels(cfg?: LocalEndpointConfig): Promise<LocalModelInfo[]> {
  const c = cfg ?? loadLocalEndpoint();
  const res = await fetch(c.baseUrl + '/models', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + c.apiKey },
  });
  if (!res.ok) throw new Error('listLocalModels ' + res.status);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

// ── Chat completion ─────────────────────────────────────────────────────────

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onDelta?: (token: string) => void;   // called per streamed token if streaming
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

// Non-streaming chat. For streaming, use chatStream() — LM Studio supports SSE
// but the fetch shim buffers the body, so we parse SSE chunks after the
// response resolves rather than incrementally.
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const c = loadLocalEndpoint();
  const model = opts.model || c.chatModel;
  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? -1,
    stream: false,
  };
  const res = await fetch(c.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('chat ' + res.status + ': ' + await res.text());
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? '';
  return {
    text,
    model: json?.model ?? model,
    promptTokens: json?.usage?.prompt_tokens ?? 0,
    completionTokens: json?.usage?.completion_tokens ?? 0,
  };
}

// Streaming chat. The fetch shim returns after the whole body arrives, so this
// parses the buffered SSE stream and fires onDelta for each chunk. Still useful
// because the server streams (faster TTFB than non-stream for large outputs).
export async function chatStream(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const c = loadLocalEndpoint();
  const model = opts.model || c.chatModel;
  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? -1,
    stream: true,
  };
  const res = await fetch(c.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('chatStream ' + res.status + ': ' + await res.text());
  const raw = await res.text();
  let acc = '';
  let promptTokens = 0;
  let completionTokens = 0;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]' || data.length === 0) continue;
    try {
      const evt = JSON.parse(data);
      const delta = evt?.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        acc += delta;
        opts.onDelta?.(delta);
      }
      if (evt?.usage) {
        promptTokens = evt.usage.prompt_tokens ?? promptTokens;
        completionTokens = evt.usage.completion_tokens ?? completionTokens;
      }
    } catch {}
  }
  return { text: acc, model, promptTokens, completionTokens };
}

// ── Embeddings ──────────────────────────────────────────────────────────────

export interface EmbedOptions { model?: string }

export interface EmbedResult {
  model: string;
  vectors: number[][];     // one vector per input string
  promptTokens: number;
}

export async function embed(input: string | string[], opts: EmbedOptions = {}): Promise<EmbedResult> {
  const c = loadLocalEndpoint();
  const model = opts.model || c.embeddingModel;
  const inputs = Array.isArray(input) ? input : [input];
  const res = await fetch(c.baseUrl + '/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error('embed ' + res.status + ': ' + await res.text());
  const json = await res.json();
  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  const vectors = data
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(d => Array.isArray(d.embedding) ? d.embedding : []);
  return {
    model: json?.model ?? model,
    vectors,
    promptTokens: json?.usage?.prompt_tokens ?? 0,
  };
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function pingLocalEndpoint(cfg?: LocalEndpointConfig): Promise<boolean> {
  try {
    const models = await listLocalModels(cfg);
    return models.length >= 0;
  } catch {
    return false;
  }
}
