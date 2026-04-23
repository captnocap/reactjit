// =============================================================================
// SECURE API KEY STORE — encrypted-at-rest provider API keys
// =============================================================================
// Keys are obfuscated (not truly encrypted — no key management — but not
// plaintext either). Uses a simple XOR obfuscation to deter casual inspection.
// =============================================================================

const host: any = globalThis;

const STORE_PREFIX = 'sweatshop.apikey.';

function storeGet(key: string): string | null {
  try { return host.__store_get(key); } catch { return null; }
}
function storeSet(key: string, value: string): void {
  try { host.__store_set(key, value); } catch {}
}
function storeDelete(key: string): void {
  try { host.__store_del(key); } catch {}
}

// Simple obfuscation: XOR with rotating salt derived from key name
function obfuscate(text: string, keyName: string): string {
  const salt = keyName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) ^ ((salt + i * 7) & 0xff);
    out += String.fromCharCode(code);
  }
  // Base64-like encode to avoid null bytes in storage
  let encoded = '';
  for (let i = 0; i < out.length; i++) {
    encoded += out.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return encoded;
}

function deobfuscate(encoded: string, keyName: string): string {
  const salt = keyName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let out = '';
  for (let i = 0; i < encoded.length; i += 2) {
    const code = parseInt(encoded.slice(i, i + 2), 16);
    out += String.fromCharCode(code);
  }
  let text = '';
  for (let i = 0; i < out.length; i++) {
    text += String.fromCharCode(out.charCodeAt(i) ^ ((salt + i * 7) & 0xff));
  }
  return text;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiKeyEntry {
  provider: string;
  nickname: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface ApiKeyStore {
  keys: ApiKeyEntry[];
}

const STORE_META_KEY = 'sweatshop.apikey.meta';

function loadMeta(): ApiKeyEntry[] {
  const raw = storeGet(STORE_META_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveMeta(meta: ApiKeyEntry[]): void {
  storeSet(STORE_META_KEY, JSON.stringify(meta));
}

// ── Public API ───────────────────────────────────────────────────────────────

export function listApiKeys(): ApiKeyEntry[] {
  return loadMeta();
}

export function getApiKey(provider: string): string | null {
  const raw = storeGet(STORE_PREFIX + provider);
  if (!raw) return null;
  try {
    const deob = deobfuscate(raw, provider);
    // Update lastUsed
    const meta = loadMeta();
    const entry = meta.find(k => k.provider === provider);
    if (entry) {
      entry.lastUsedAt = Date.now();
      saveMeta(meta);
    }
    return deob;
  } catch { return null; }
}

export function hasApiKey(provider: string): boolean {
  return !!storeGet(STORE_PREFIX + provider);
}

export function setApiKey(provider: string, key: string, nickname?: string): void {
  const obfuscated = obfuscate(key, provider);
  storeSet(STORE_PREFIX + provider, obfuscated);

  const meta = loadMeta();
  const existing = meta.find(k => k.provider === provider);
  if (existing) {
    existing.nickname = nickname || provider;
  } else {
    meta.push({
      provider,
      nickname: nickname || provider,
      createdAt: Date.now(),
    });
  }
  saveMeta(meta);
}

export function deleteApiKey(provider: string): void {
  storeDelete(STORE_PREFIX + provider);
  const meta = loadMeta().filter(k => k.provider !== provider);
  saveMeta(meta);
}

export function getApiKeyForModel(modelId: string): string | null {
  // Derive provider from model ID
  const provider = deriveProviderFromModel(modelId);
  if (!provider) return null;
  return getApiKey(provider);
}

function deriveProviderFromModel(modelId: string): string | null {
  const lower = modelId.toLowerCase();
  if (lower.startsWith('claude-')) return 'anthropic';
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3')) return 'openai';
  if (lower.startsWith('gemini-')) return 'google';
  if (lower.startsWith('deepseek-')) return 'deepseek';
  if (lower.startsWith('llama-')) return 'meta';
  if (lower.startsWith('mistral-')) return 'mistral';
  if (lower.startsWith('grok-')) return 'xai';
  if (lower.startsWith('qwen-')) return 'qwen';
  return null;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateApiKey(provider: string, key: string): { valid: boolean; error?: string } {
  if (!key || key.length < 8) {
    return { valid: false, error: 'Key too short (min 8 chars)' };
  }
  if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
    return { valid: false, error: 'Anthropic keys should start with sk-ant-' };
  }
  if (provider === 'openai' && !key.startsWith('sk-')) {
    return { valid: false, error: 'OpenAI keys should start with sk-' };
  }
  if (provider === 'google' && key.length < 20) {
    return { valid: false, error: 'Google API key looks invalid' };
  }
  return { valid: true };
}
