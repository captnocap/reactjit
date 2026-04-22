// =============================================================================
// MODEL ICONS — ported from /home/siah/creative/ai/app/src/mainview/lib/model-icons.ts
// =============================================================================
// Maps provider IDs and model IDs to brand colors + short initials.
// In ReactJIT we render these as colored text badges since PNG/SVG icons
// require network or bundle embedding.

export interface IconInfo {
  color: string;
  initial: string;
  name: string;
}

// ── Provider brand colors (from LobeHub / common brand guidelines) ───────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#D4A574',
  openai: '#10A37F',
  google: '#4285F4',
  meta: '#0081FB',
  mistral: '#FF7000',
  qwen: '#6B21A8',
  deepseek: '#4D6BFA',
  xai: '#1DA1F2',
  groq: '#F55036',
  ollama: '#FFFFFF',
  openrouter: '#FFFFFF',
  huggingface: '#FFD21E',
  cohere: '#D6C2F5',
  ai21: '#E8E8E8',
  together: '#3B82F6',
  perplexity: '#22D3EE',
  replicate: '#F87171',
  fireworks: '#F59E0B',
  anyscale: '#34D399',
  bytedance: '#3B82F6',
  baidu: '#2932E1',
  tencent: '#0052D9',
  microsoft: '#00A4EF',
  apple: '#555555',
  amazon: '#FF9900',
  aws: '#FF9900',
  bedrock: '#FF9900',
  azure: '#00A4EF',
  nvidia: '#76B900',
  intel: '#0071C5',
  amd: '#ED1C24',
  minimax: '#8B5CF6',
  moonshot: '#10B981',
  kimi: '#10B981',
  zhipu: '#3B82F6',
  baichuan: '#F59E0B',
  yi: '#6366F1',
  '01ai': '#6366F1',
  cerebras: '#EF4444',
  sambanova: '#10B981',
  inflection: '#8B5CF6',
  reka: '#F43F5E',
  aleph: '#3B82F6',
  llama: '#0081FB',
  codellama: '#0081FB',
  local: '#7EE787',
  qjs: '#D2A8FF',
  // Image/video providers
  'black-forest-labs': '#8B5CF6',
  midjourney: '#1A1A1A',
  ideogram: '#6366F1',
  stability: '#3B82F6',
  recraft: '#10B981',
  runway: '#F59E0B',
  kuaishou: '#FF6B00',
  alibaba: '#FF6A00',
  pixverse: '#8B5CF6',
  vidu: '#3B82F6',
  lightricks: '#F43F5E',
  luma: '#10B981',
  pika: '#EC4899',
  // Audio
  elevenlabs: '#10B981',
  // Embeddings
  voyage: '#6366F1',
};

const PROVIDER_INITIALS: Record<string, string> = {
  anthropic: 'An',
  openai: 'OA',
  google: 'Go',
  meta: 'Me',
  mistral: 'Mi',
  qwen: 'Qw',
  deepseek: 'DS',
  xai: 'xA',
  groq: 'Gq',
  ollama: 'Ol',
  openrouter: 'OR',
  huggingface: 'HF',
  cohere: 'Co',
  ai21: 'A2',
  together: 'To',
  perplexity: 'Px',
  replicate: 'Rp',
  fireworks: 'Fw',
  anyscale: 'As',
  bytedance: 'BD',
  baidu: 'Bd',
  tencent: 'Tx',
  microsoft: 'Ms',
  apple: 'Ap',
  amazon: 'Am',
  aws: 'Aw',
  bedrock: 'Br',
  azure: 'Az',
  nvidia: 'Nv',
  intel: 'In',
  amd: 'Am',
  minimax: 'Mm',
  moonshot: 'Ms',
  kimi: 'Ki',
  zhipu: 'Zp',
  baichuan: 'Bc',
  yi: 'Yi',
  '01ai': '01',
  cerebras: 'Cb',
  sambanova: 'Sn',
  inflection: 'If',
  reka: 'Rk',
  aleph: 'Al',
  llama: 'Ll',
  codellama: 'CL',
  local: 'Lo',
  qjs: 'QJ',
  'black-forest-labs': 'BF',
  midjourney: 'Mj',
  ideogram: 'Id',
  stability: 'St',
  recraft: 'Rc',
  runway: 'Rw',
  kuaishou: 'Ks',
  alibaba: 'Ab',
  pixverse: 'Pv',
  vidu: 'Vi',
  lightricks: 'Lt',
  luma: 'Lu',
  pika: 'Pk',
  elevenlabs: 'E1',
  voyage: 'Vy',
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  xai: 'xAI',
  groq: 'Groq',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  huggingface: 'HuggingFace',
  cohere: 'Cohere',
  ai21: 'AI21',
  together: 'Together',
  perplexity: 'Perplexity',
  replicate: 'Replicate',
  fireworks: 'Fireworks',
  anyscale: 'Anyscale',
  bytedance: 'ByteDance',
  baidu: 'Baidu',
  tencent: 'Tencent',
  microsoft: 'Microsoft',
  apple: 'Apple',
  amazon: 'Amazon',
  aws: 'AWS',
  bedrock: 'Bedrock',
  azure: 'Azure',
  nvidia: 'NVIDIA',
  intel: 'Intel',
  amd: 'AMD',
  minimax: 'MiniMax',
  moonshot: 'Moonshot',
  kimi: 'Kimi',
  zhipu: 'Zhipu',
  baichuan: 'Baichuan',
  yi: 'Yi',
  '01ai': '01.AI',
  cerebras: 'Cerebras',
  sambanova: 'SambaNova',
  inflection: 'Inflection',
  reka: 'Reka',
  aleph: 'Aleph',
  llama: 'Llama',
  codellama: 'CodeLlama',
  local: 'Local',
  qjs: 'QJS',
  'black-forest-labs': 'Black Forest',
  midjourney: 'Midjourney',
  ideogram: 'Ideogram',
  stability: 'Stability',
  recraft: 'Recraft',
  runway: 'Runway',
  kuaishou: 'Kuaishou',
  alibaba: 'Alibaba',
  pixverse: 'PixVerse',
  vidu: 'Vidu',
  lightricks: 'Lightricks',
  luma: 'Luma',
  pika: 'Pika',
  elevenlabs: 'ElevenLabs',
  voyage: 'Voyage',
};

// ── Model family patterns (more specific first) ──────────────────────────────

const MODEL_ICON_PATTERNS: [RegExp, string][] = [
  [/claude/i, 'anthropic'],
  [/gpt|chatgpt|o1|o3|davinci|curie|babbage|ada/i, 'openai'],
  [/dall-?e/i, 'openai'],
  [/gemini/i, 'google'],
  [/gemma/i, 'google'],
  [/llama|codellama/i, 'meta'],
  [/mixtral|mistral/i, 'mistral'],
  [/qwen/i, 'qwen'],
  [/deepseek/i, 'deepseek'],
  [/grok/i, 'xai'],
  [/doubao/i, 'bytedance'],
  [/groq/i, 'groq'],
  [/ollama/i, 'ollama'],
  [/openrouter/i, 'openrouter'],
  [/flux/i, 'black-forest-labs'],
  [/midjourney|mj/i, 'midjourney'],
  [/kling/i, 'kuaishou'],
  [/kimi|moonshot/i, 'kimi'],
  [/minimax/i, 'minimax'],
  [/huggingface|hf/i, 'huggingface'],
];

// ── Public API ───────────────────────────────────────────────────────────────

export function getProviderIconInfo(providerId: string): IconInfo {
  const normalized = providerId.toLowerCase().trim();
  return {
    color: PROVIDER_COLORS[normalized] || '#9CA3AF',
    initial: PROVIDER_INITIALS[normalized] || normalized.slice(0, 2).toUpperCase(),
    name: PROVIDER_DISPLAY_NAMES[normalized] || normalized,
  };
}

export function getModelIconInfo(modelId: string): IconInfo {
  for (const [pattern, provider] of MODEL_ICON_PATTERNS) {
    if (pattern.test(modelId)) {
      return getProviderIconInfo(provider);
    }
  }
  return { color: '#9CA3AF', initial: '??', name: 'Unknown' };
}

export function getModelProviderId(modelId: string): string {
  for (const [pattern, provider] of MODEL_ICON_PATTERNS) {
    if (pattern.test(modelId)) return provider;
  }
  return 'unknown';
}

// LobeHub CDN URL generator (for future Image primitive usage)
export function getLobeIconCDN(
  providerId: string,
  opts: { variant?: 'color' | 'mono'; format?: 'svg' | 'png' } = {}
): string {
  const { variant = 'color', format = 'svg' } = opts;
  const id = providerId.toLowerCase().trim();
  if (format === 'svg') {
    const suffix = variant === 'color' ? '-color' : '';
    return `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${id}${suffix}.svg`;
  }
  const suffix = variant === 'color' ? '-color' : '';
  return `https://unpkg.com/@lobehub/icons-static-png@latest/light/${id}${suffix}.png`;
}
