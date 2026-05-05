// modelRegistry.ts — master registry of known LLM/AI model metadata.
//
// Why this exists: the model's authoring lab hard-defines facts that
// users should never have to re-pick — modality (claude-opus-4-7 is
// obviously a text model), context length (200k for Claude 4 family),
// authoring lab (gemma is a Google model, not a Meta one), and a
// reasonable default capability set. Asking the user to confirm those
// is a no-shit-sherlock moment.
//
// Provider vs lab: a Provider is *where* you fetched the model
// (Anthropic API, an OpenAI-compatible local server, OpenRouter, …).
// A Lab is *who built it*. Llama served via Ollama is still Meta's;
// Gemma served via your local llama.cpp is still Google's. The
// registry returns the lab so the card shows the right brand icon
// regardless of where the bytes flowed in from.
//
// ─── Shape ──────────────────────────────────────────────────────────
//
// REGISTRY is keyed by lab; each lab has per-modality buckets:
//
//   REGISTRY = {
//     qwen: {
//       iconId:   'qwen',              // default icon for the lab
//       labLabel: 'Alibaba (Qwen)',
//       text:  [{ match, ctx?, caps?, displayName? }, …],
//       embed: [{ match: 'qwen3-embedding', displayName: 'Qwen Embedding' }, …],
//       voice: [...],
//       image: [...],
//       tts:   [...],
//     },
//     google: {
//       iconId:   'google',
//       labLabel: 'Google',
//       text: [
//         { match: 'gemini-2.5-pro', iconId: 'gemini', … },  // per-entry icon override
//         { match: 'gemma', … },                              // uses default 'google'
//       ],
//     },
//     ...
//   };
//
// Order DOES NOT MATTER. lookupModel scans every entry across every lab
// and picks the longest matching pattern. So you can drop a new entry
// at the top, bottom, or alphabetised — the longest-match rule keeps
// `claude-opus-4-7` (15 chars) winning over `claude-opus-4` (13) and
// the catch-all `claude-` (7) without you having to think about it.
//
// To add a new model: drop a `{ match, ctx?, caps?, displayName? }`
// entry into `REGISTRY[<lab>][<modality>]`.
//
// To add a new lab: extend ModelLab + LAB_LABEL + LAB_DEFAULT_ICON,
// then add a top-level entry in REGISTRY. Icons must already exist in
// PROVIDER_ICONS — re-run scripts/build-provider-icons.mjs to add new
// ones; otherwise the card falls back to a letter glyph, which is
// still better than showing the wrong lab.

export type Modality = 'text' | 'embed' | 'voice' | 'image' | 'tts';

export type Capability =
  | 'vision'
  | 'reasoning'
  | 'tools'
  | 'search'
  | 'code'
  | 'files';

export const ALL_MODALITIES: Modality[] = ['text', 'embed', 'voice', 'image', 'tts'];

export const ALL_CAPABILITIES: Capability[] = [
  'vision', 'reasoning', 'tools', 'search', 'code', 'files',
];

export const MODALITY_LABEL: Record<Modality, string> = {
  text:  'Text',
  embed: 'Embedding',
  voice: 'Voice',
  image: 'Image',
  tts:   'TTS',
};

export type ModelLab =
  // Labs with brand icons in PROVIDER_ICONS.
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'deepseek'
  | 'qwen'
  | 'xai'
  | 'cohere'
  | 'perplexity'
  | 'huggingface'
  | 'zhipu'
  // Labs without icons yet — letter glyph fallback. Add an icon by
  // dropping a 128px PNG into the build-provider-icons script and
  // re-running it, then point LAB_DEFAULT_ICON at the new id.
  | 'amazon'
  | 'baichuan'
  | 'bytedance'
  | 'baidu'
  | 'tencent'
  | 'stepfun'
  | 'ai21'
  | 'inflection'
  | 'liquidai'
  | 'minimax'
  | 'xiaomi'
  | 'nvidia'
  | 'microsoft'
  | '01ai'
  | 'inclusionai'
  | 'ibm'
  | 'moonshot'
  | 'arcee'
  | 'inception'
  | 'upstage'
  | 'allenai'
  | 'vercel'
  | 'salesforce'
  | 'reka'
  | 'nous'
  | 'aionlabs'
  | 'tongyi'
  | 'unknown';

export const LAB_LABEL: Record<ModelLab, string> = {
  anthropic:   'Anthropic',
  openai:      'OpenAI',
  google:      'Google',
  meta:        'Meta',
  mistral:     'Mistral AI',
  deepseek:    'DeepSeek',
  qwen:        'Alibaba (Qwen)',
  xai:         'xAI',
  cohere:      'Cohere',
  perplexity:  'Perplexity',
  huggingface: 'Hugging Face',
  zhipu:       'Zhipu / Z.AI',
  amazon:      'Amazon',
  baichuan:    'Baichuan',
  bytedance:   'ByteDance',
  baidu:       'Baidu',
  tencent:     'Tencent',
  stepfun:     'StepFun',
  ai21:        'AI21 Labs',
  inflection:  'Inflection AI',
  liquidai:    'Liquid AI',
  minimax:     'MiniMax',
  xiaomi:      'Xiaomi',
  nvidia:      'Nvidia',
  microsoft:   'Microsoft',
  '01ai':      '01.AI',
  inclusionai: 'inclusionAI',
  ibm:         'IBM',
  moonshot:    'Moonshot AI',
  arcee:       'Arcee AI',
  inception:   'Inception Labs',
  upstage:     'Upstage',
  allenai:     'Allen Institute for AI',
  vercel:      'Vercel',
  salesforce:  'Salesforce',
  reka:        'Reka AI',
  nous:        'Nous Research',
  aionlabs:    'Aion Labs',
  tongyi:      'Tongyi Lab',
  unknown:     'Unknown',
};

// PROVIDER_ICONS key per lab. Empty string → letter glyph fallback.
const LAB_DEFAULT_ICON: Record<ModelLab, string> = {
  anthropic: 'anthropic', openai: 'openai', google: 'google', meta: 'meta',
  mistral: 'mistral', deepseek: 'deepseek', qwen: 'qwen', xai: 'xai',
  cohere: 'cohere', perplexity: 'perplexity', huggingface: 'huggingface',
  zhipu: 'zhipu',
  amazon: '', baichuan: '', bytedance: '', baidu: '', tencent: '',
  stepfun: '', ai21: '', inflection: '', liquidai: '', minimax: '',
  xiaomi: '', nvidia: '', microsoft: '', '01ai': '', inclusionai: '',
  ibm: '', moonshot: '', arcee: '', inception: '', upstage: '',
  allenai: '', vercel: '', salesforce: '', reka: '', nous: '',
  aionlabs: '', tongyi: '', unknown: '',
};

// ─── Capability presets ─────────────────────────────────────────────
// Frontier:  vision + extended thinking + tool use + code + file io
// Mid:       vision + tool use + code + file io (no extended thinking)
// Reasoning: reasoning + tool use + code (often text-only)
// Text:      tool use + code (small chat models)
// Code:      tool use + code (coding-specialised models)
// Search:    search + tool use + code (Perplexity-style web models)
// SearchR:   search + reasoning + tool use + code (Sonar Reasoning, Deep Research)
const CAPS_FRONTIER: Capability[] = ['vision', 'reasoning', 'tools', 'code', 'files'];
const CAPS_MID:      Capability[] = ['vision', 'tools', 'code', 'files'];
const CAPS_REASON:   Capability[] = ['reasoning', 'tools', 'code'];
const CAPS_TEXT:     Capability[] = ['tools', 'code'];
const CAPS_CODE:     Capability[] = ['tools', 'code'];
const CAPS_SEARCH:   Capability[] = ['search', 'tools', 'code'];
const CAPS_SEARCH_R: Capability[] = ['search', 'reasoning', 'tools', 'code'];

// ─── Definition shape ───────────────────────────────────────────────

type EntryMatch = string | RegExp | (string | RegExp)[];

type ModelDef = {
  /** Substring (lowercased) or regex tested against the lowercased remoteId. */
  match: EntryMatch;
  /** Override the lab's default icon for this specific model. */
  iconId?: string;
  /** Max context window (tokens). Anthropic Opus/Sonnet 1M-capable rows
   *  also implicitly accept 200k via header — see ctxLabel() in routes/models.tsx. */
  ctx?: number;
  /** Capability badges. Omit for embed/voice/image/tts (modality is the badge). */
  caps?: Capability[];
  /** Clean marketing name used as the initial displayName for new rows. */
  displayName?: string;
};

type LabBucket = {
  iconId: string;
  text?:  ModelDef[];
  embed?: ModelDef[];
  voice?: ModelDef[];
  image?: ModelDef[];
  tts?:   ModelDef[];
};

// ─── Registry ───────────────────────────────────────────────────────

const REGISTRY: Partial<Record<ModelLab, LabBucket>> = {

  // ━━━ Anthropic ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  anthropic: {
    iconId: 'claude',
    text: [
      { match: 'claude-opus-4-7',    ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Claude Opus 4.7' },
      { match: 'claude-opus-4-6',    ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Claude Opus 4.6' },
      { match: 'claude-opus-4-5',    ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'Claude Opus 4.5' },
      { match: 'claude-opus-4-1',    ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'Claude Opus 4.1' },
      { match: 'claude-opus-4',      ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'Claude Opus 4' },

      { match: 'claude-sonnet-4-7',  ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Claude Sonnet 4.7' },
      { match: 'claude-sonnet-4-6',  ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Claude Sonnet 4.6' },
      { match: 'claude-sonnet-4-5',  ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Claude Sonnet 4.5' },
      { match: 'claude-sonnet-4',    ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Claude Sonnet 4' },

      { match: 'claude-haiku-4-5',   ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'Claude Haiku 4.5' },
      { match: 'claude-haiku-4',     ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'Claude Haiku 4' },

      { match: 'claude-3-7-sonnet',  ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'Claude Sonnet 3.7' },
      { match: 'claude-3-5-sonnet',  ctx: 200_000,   caps: CAPS_MID,      displayName: 'Claude Sonnet 3.5' },
      { match: 'claude-3-5-haiku',   ctx: 200_000,   caps: CAPS_MID,      displayName: 'Claude Haiku 3.5' },
      { match: 'claude-3-opus',      ctx: 200_000,   caps: CAPS_MID,      displayName: 'Claude Opus 3' },
      { match: 'claude-3-sonnet',    ctx: 200_000,   caps: CAPS_MID,      displayName: 'Claude Sonnet 3' },
      { match: 'claude-3-haiku',     ctx: 200_000,   caps: CAPS_MID,      displayName: 'Claude Haiku 3' },
      { match: 'claude-2',           ctx: 100_000,   caps: CAPS_TEXT,     displayName: 'Claude 2' },
      { match: 'claude-instant',     ctx: 100_000,   caps: CAPS_TEXT,     displayName: 'Claude Instant' },

      // Catch-all for any future / unknown Claude variant.
      { match: ['claude-', 'claude'], caps: CAPS_FRONTIER },
    ],
  },

  // ━━━ OpenAI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  openai: {
    iconId: 'openai',
    text: [
      // o-series reasoning
      { match: 'o4-mini',       ctx: 200_000, caps: CAPS_REASON,  displayName: 'o4-mini' },
      { match: 'o3-mini',       ctx: 200_000, caps: CAPS_REASON,  displayName: 'o3-mini' },
      { match: 'o3-pro',        ctx: 200_000, caps: CAPS_REASON,  displayName: 'o3-pro' },
      { match: 'o3-deep-research', ctx: 200_000, caps: CAPS_SEARCH_R, displayName: 'o3 Deep Research' },
      { match: /(^|[^a-z])o3(-|$)/, ctx: 200_000, caps: CAPS_REASON, displayName: 'o3' },
      { match: 'o1-mini',       ctx: 128_000, caps: CAPS_REASON,  displayName: 'o1-mini' },
      { match: 'o1-pro',        ctx: 200_000, caps: CAPS_REASON,  displayName: 'o1-pro' },
      { match: 'o1-preview',    ctx: 128_000, caps: CAPS_REASON,  displayName: 'o1-preview' },
      { match: /(^|[^a-z])o1(-|$)/, ctx: 200_000, caps: CAPS_REASON, displayName: 'o1' },

      // GPT-5.x — patterns use [.-] so `gpt-5.4` and `gpt-5-4` both hit.
      { match: /gpt-5[.-]5/,            ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'GPT-5.5' },
      { match: /gpt-5[.-]4-pro/,        ctx: 922_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.4 Pro' },
      { match: /gpt-5[.-]4-mini/,       ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.4 mini' },
      { match: /gpt-5[.-]4-nano/,       ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.4 nano' },
      { match: /gpt-5[.-]4/,            ctx: 922_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.4' },
      { match: /gpt-5[.-]3-codex/,      ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.3 Codex' },
      { match: /gpt-5[.-]3/,            ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.3' },
      { match: /gpt-5[.-]2-codex/,      ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.2 Codex' },
      { match: /gpt-5[.-]2-pro/,        ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.2 Pro' },
      { match: /gpt-5[.-]2/,            ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.2' },
      { match: /gpt-5[.-]1-codex-max/,  ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.1 Codex Max' },
      { match: /gpt-5[.-]1-codex-mini/, ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.1 Codex mini' },
      { match: /gpt-5[.-]1-codex/,      ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.1 Codex' },
      { match: /gpt-5[.-]1/,            ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5.1' },
      { match: 'gpt-5-codex',           ctx: 256_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5 Codex' },
      { match: 'gpt-5-pro',             ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5 Pro' },
      { match: 'gpt-5-nano',            ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5 nano' },
      { match: 'gpt-5-mini',            ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5 mini' },
      { match: 'gpt-5',                 ctx: 400_000,   caps: CAPS_FRONTIER, displayName: 'GPT-5' },

      // GPT-4.x
      { match: /gpt-4[.-]1-nano/, ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'GPT-4.1 nano' },
      { match: /gpt-4[.-]1-mini/, ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'GPT-4.1 mini' },
      { match: /gpt-4[.-]1/,      ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'GPT-4.1' },
      { match: 'gpt-4o-search',   ctx: 128_000,   caps: ['vision', 'search', 'tools', 'code', 'files'], displayName: 'GPT-4o Search' },
      { match: 'gpt-4o-mini-search', ctx: 128_000, caps: ['vision', 'search', 'tools'], displayName: 'GPT-4o mini Search' },
      { match: 'gpt-4o-mini',     ctx: 128_000,   caps: CAPS_MID,      displayName: 'GPT-4o mini' },
      { match: 'gpt-4o',          ctx: 128_000,   caps: CAPS_MID,      displayName: 'GPT-4o' },
      { match: 'gpt-4-turbo',     ctx: 128_000,   caps: CAPS_MID,      displayName: 'GPT-4 Turbo' },
      { match: 'gpt-4-vision',    ctx: 128_000,   caps: CAPS_MID,      displayName: 'GPT-4 Vision' },
      { match: 'gpt-4-32k',       ctx: 32_768,    caps: CAPS_TEXT,     displayName: 'GPT-4 32K' },
      { match: 'gpt-4',           ctx: 8_192,     caps: CAPS_TEXT,     displayName: 'GPT-4' },
      { match: /gpt-3[.-]5-turbo/, ctx: 16_385,   caps: CAPS_TEXT,     displayName: 'GPT-3.5 Turbo' },

      // OSS
      { match: 'gpt-oss-safeguard', ctx: 128_000, caps: CAPS_REASON, displayName: 'GPT-OSS Safeguard 20B' },
      { match: 'gpt-oss-120b',      ctx: 128_000, caps: CAPS_REASON, displayName: 'GPT-OSS 120B' },
      { match: 'gpt-oss-20b',       ctx: 128_000, caps: CAPS_REASON, displayName: 'GPT-OSS 20B' },
      { match: 'gpt-oss',           caps: CAPS_REASON },

      // Catch-all
      { match: 'gpt-', caps: CAPS_TEXT },
    ],
    embed: [
      { match: 'text-embedding-3-large', ctx: 8_191, displayName: 'OpenAI Embedding 3 large' },
      { match: 'text-embedding-3-small', ctx: 8_191, displayName: 'OpenAI Embedding 3 small' },
      { match: 'text-embedding-ada',     ctx: 8_191, displayName: 'OpenAI ADA-002' },
      { match: 'text-embedding' },
    ],
    voice: [
      { match: 'whisper', displayName: 'Whisper' },
    ],
    tts: [
      { match: 'tts-1-hd',    displayName: 'TTS-1 HD' },
      { match: 'tts-1',       displayName: 'TTS-1' },
      { match: 'gpt-4o-audio', displayName: 'GPT-4o Audio' },
    ],
    image: [
      { match: 'dall-e-3',  displayName: 'DALL·E 3' },
      { match: 'dall-e-2',  displayName: 'DALL·E 2' },
      { match: 'dall-e',    displayName: 'DALL·E' },
      { match: 'gpt-image', displayName: 'GPT Image' },
    ],
  },

  // ━━━ Google (Gemini + Gemma) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Default icon is 'google' (used by Gemma open-weights and others);
  // Gemini-family entries override iconId to 'gemini' per-entry.
  google: {
    iconId: 'google',
    text: [
      // Gemini 3.x
      { match: /gemini-3[.-]1-pro/,        iconId: 'gemini', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 3.1 Pro' },
      { match: /gemini-3[.-]1-flash-lite/, iconId: 'gemini', ctx: 1_000_000, caps: CAPS_MID,      displayName: 'Gemini 3.1 Flash Lite' },
      { match: /gemini-3[.-]1-flash/,      iconId: 'gemini', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 3.1 Flash' },
      { match: 'gemini-3-flash',           iconId: 'gemini', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 3 Flash' },
      { match: 'gemini-3',                 iconId: 'gemini', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 3' },

      // Gemini 2.x
      { match: /gemini-2[.-]5-pro/,            iconId: 'gemini', ctx: 2_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 2.5 Pro' },
      { match: /gemini-2[.-]5-flash-lite/,     iconId: 'gemini', ctx: 1_000_000, caps: CAPS_MID,      displayName: 'Gemini 2.5 Flash Lite' },
      { match: /gemini-2[.-]5-flash/,          iconId: 'gemini', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 2.5 Flash' },
      { match: /gemini-2[.-]0-pro/,            iconId: 'gemini', ctx: 2_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 2.0 Pro' },
      { match: /gemini-2[.-]0-flash-thinking/, iconId: 'gemini', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Gemini 2.0 Flash Thinking' },
      { match: /gemini-2[.-]0-flash-lite/,     iconId: 'gemini', ctx: 1_000_000, caps: CAPS_MID,      displayName: 'Gemini 2.0 Flash Lite' },
      { match: /gemini-2[.-]0-flash/,          iconId: 'gemini', ctx: 1_000_000, caps: CAPS_MID,      displayName: 'Gemini 2.0 Flash' },
      { match: /gemini-1[.-]5-pro/,            iconId: 'gemini', ctx: 2_000_000, caps: CAPS_MID,      displayName: 'Gemini 1.5 Pro' },
      { match: /gemini-1[.-]5-flash-8b/,       iconId: 'gemini', ctx: 1_000_000, caps: CAPS_MID,      displayName: 'Gemini 1.5 Flash-8B' },
      { match: /gemini-1[.-]5-flash/,          iconId: 'gemini', ctx: 1_000_000, caps: CAPS_MID,      displayName: 'Gemini 1.5 Flash' },
      { match: 'gemini',                       iconId: 'gemini', caps: CAPS_FRONTIER },
      { match: 'learnlm',                      iconId: 'gemini', caps: CAPS_MID,      displayName: 'LearnLM' },

      // Gemma open-weights (default 'google' icon, no override).
      { match: 'paligemma',      caps: CAPS_MID,  displayName: 'PaliGemma' },
      { match: 'codegemma',      caps: CAPS_CODE, displayName: 'CodeGemma' },
      { match: 'recurrentgemma', caps: CAPS_TEXT, displayName: 'RecurrentGemma' },
      { match: 'gemma',          caps: CAPS_MID },
    ],
    embed: [
      { match: 'gemini-embedding',   iconId: 'gemini', displayName: 'Gemini Embedding' },
      { match: 'embedding-001',      iconId: 'gemini', displayName: 'Gemini Embedding 001' },
      { match: 'text-embedding-004', iconId: 'gemini', displayName: 'Gemini text-embedding-004' },
      { match: 'embeddinggemma',     displayName: 'EmbeddingGemma' },
    ],
    image: [
      { match: 'gemini-3-pro-image', iconId: 'gemini', displayName: 'Gemini 3 Pro Image' },
    ],
  },

  // ━━━ Meta (Llama + community Llama-base finetunes) ━━━━━━━━━━━━━━━━
  meta: {
    iconId: 'meta',
    text: [
      { match: 'llama-4-maverick', ctx: 1_000_000,  caps: CAPS_FRONTIER, displayName: 'Llama 4 Maverick' },
      { match: 'llama-4-scout',    ctx: 10_000_000, caps: CAPS_FRONTIER, displayName: 'Llama 4 Scout' },
      { match: 'llama-4',          caps: CAPS_MID,  displayName: 'Llama 4' },
      { match: ['llama-3.3', 'llama-3-3'],                       ctx: 128_000, caps: CAPS_MID,  displayName: 'Llama 3.3' },
      { match: ['llama-3.2-90b-vision', 'llama-3-2-90b-vision'], ctx: 128_000, caps: CAPS_MID,  displayName: 'Llama 3.2 90B Vision' },
      { match: ['llama-3.2-11b-vision', 'llama-3-2-11b-vision'], ctx: 128_000, caps: CAPS_MID,  displayName: 'Llama 3.2 11B Vision' },
      { match: ['llama-3.2', 'llama-3-2'],                       ctx: 128_000, caps: CAPS_TEXT, displayName: 'Llama 3.2' },
      { match: ['llama-3.1-405b', 'llama-3-1-405b'],             ctx: 128_000, caps: CAPS_MID,  displayName: 'Llama 3.1 405B' },
      { match: ['llama-3.1-70b',  'llama-3-1-70b'],              ctx: 128_000, caps: CAPS_MID,  displayName: 'Llama 3.1 70B' },
      { match: ['llama-3.1-8b',   'llama-3-1-8b'],               ctx: 128_000, caps: CAPS_TEXT, displayName: 'Llama 3.1 8B' },
      { match: ['llama-3.1', 'llama-3-1'],                       ctx: 128_000, caps: CAPS_TEXT, displayName: 'Llama 3.1' },
      { match: 'llama-3-70b',  ctx: 8_192, caps: CAPS_TEXT, displayName: 'Llama 3 70B' },
      { match: 'llama-3-8b',   ctx: 8_192, caps: CAPS_TEXT, displayName: 'Llama 3 8B' },
      { match: 'llama-3',      caps: CAPS_TEXT, displayName: 'Llama 3' },
      { match: 'llama-2',      caps: CAPS_TEXT, displayName: 'Llama 2' },
      { match: 'codellama',    caps: CAPS_CODE, displayName: 'Code Llama' },
      { match: 'llama-guard',  caps: CAPS_TEXT, displayName: 'Llama Guard' },
      // Catch-all for community Llama-base finetunes (Hermes, Wayfarer,
      // Anubis, Euryale, Magnum, Dolphin, Lumimaid, …) — keeps the
      // Meta icon since the base weights are Meta's.
      { match: 'llama',        caps: CAPS_TEXT },
    ],
  },

  // ━━━ Mistral AI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mistral: {
    iconId: 'mistral',
    text: [
      { match: 'pixtral-large',  ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'Pixtral Large' },
      { match: 'pixtral',        ctx: 128_000, caps: CAPS_MID,      displayName: 'Pixtral' },
      { match: 'magistral-small', ctx: 32_768, caps: CAPS_REASON,   displayName: 'Magistral Small' },
      { match: 'magistral',      caps: CAPS_REASON, displayName: 'Magistral' },
      { match: 'mistral-large-3', ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Mistral Large 3' },
      { match: 'mistral-large',  ctx: 128_000, caps: CAPS_TEXT,     displayName: 'Mistral Large' },
      { match: /mistral-medium-3[.-]5/, ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Mistral Medium 3.5' },
      { match: /mistral-medium-3[.-]1/, ctx: 131_072, caps: CAPS_MID,      displayName: 'Mistral Medium 3.1' },
      { match: 'mistral-medium-3', ctx: 131_072, caps: CAPS_MID,    displayName: 'Mistral Medium 3' },
      { match: 'mistral-medium', ctx: 128_000, caps: CAPS_TEXT,     displayName: 'Mistral Medium' },
      { match: 'mistral-small-4', ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Mistral Small 4' },
      { match: /mistral-small-3[.-]2/, ctx: 128_000, caps: CAPS_MID, displayName: 'Mistral Small 3.2' },
      { match: /mistral-small-3[.-]1/, ctx: 128_000, caps: CAPS_MID, displayName: 'Mistral Small 3.1' },
      { match: 'mistral-small',  ctx: 32_000,  caps: CAPS_TEXT,     displayName: 'Mistral Small' },
      { match: 'mistral-saba',   ctx: 32_000,  caps: CAPS_TEXT,     displayName: 'Mistral Saba' },
      { match: 'mistral-nemo',   ctx: 128_000, caps: CAPS_TEXT,     displayName: 'Mistral Nemo' },
      { match: 'mistral-tiny',   ctx: 32_000,  caps: CAPS_TEXT,     displayName: 'Mistral Tiny' },
      { match: 'mixtral-8x22b',  ctx: 64_000,  caps: CAPS_TEXT,     displayName: 'Mixtral 8x22B' },
      { match: 'mixtral-8x7b',   ctx: 32_000,  caps: CAPS_TEXT,     displayName: 'Mixtral 8x7B' },
      { match: 'mixtral',        caps: CAPS_TEXT, displayName: 'Mixtral' },
      { match: 'devstral-small', ctx: 32_000,  caps: CAPS_CODE,     displayName: 'Devstral Small' },
      { match: 'devstral',       ctx: 262_144, caps: CAPS_CODE,     displayName: 'Devstral' },
      { match: 'codestral-mamba', ctx: 256_000, caps: CAPS_CODE,    displayName: 'Codestral Mamba' },
      { match: 'codestral',      ctx: 256_000, caps: CAPS_CODE,     displayName: 'Codestral' },
      { match: 'ministral-14b',  ctx: 262_144, caps: CAPS_MID,      displayName: 'Ministral 14B' },
      { match: 'ministral-8b',   ctx: 262_144, caps: CAPS_MID,      displayName: 'Ministral 8B' },
      { match: 'ministral-3b',   ctx: 131_072, caps: CAPS_MID,      displayName: 'Ministral 3B' },
      { match: 'mistral-7b',     ctx: 32_000,  caps: CAPS_TEXT,     displayName: 'Mistral 7B' },
      { match: 'mistral',        caps: CAPS_TEXT },
    ],
    embed: [
      { match: 'mistral-embed', displayName: 'Mistral Embed' },
    ],
  },

  // ━━━ DeepSeek ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  deepseek: {
    iconId: 'deepseek',
    text: [
      { match: 'deepseek-v4-flash',         ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V4 Flash' },
      { match: 'deepseek-v4-pro',           ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V4 Pro' },
      { match: 'deepseek-v4',               ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V4' },
      { match: /deepseek-v3[.-]2-speciale/, ctx: 163_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V3.2 Speciale' },
      { match: /deepseek-v3[.-]2-exp/,      ctx: 163_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V3.2 Exp' },
      { match: /deepseek-v3[.-]2/,          ctx: 163_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V3.2' },
      { match: /deepseek-v3[.-]1-terminus/, ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V3.1 Terminus' },
      { match: /deepseek-v3[.-]1/,          ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'DeepSeek V3.1' },
      { match: 'deepseek-v3',               ctx: 128_000, caps: CAPS_TEXT,     displayName: 'DeepSeek V3' },
      { match: /deepseek-v2[.-]5/,          ctx: 128_000, caps: CAPS_TEXT,     displayName: 'DeepSeek V2.5' },
      { match: 'deepseek-v2',               ctx: 128_000, caps: CAPS_TEXT,     displayName: 'DeepSeek V2' },
      { match: 'deepseek-r1',               ctx: 128_000, caps: CAPS_REASON,   displayName: 'DeepSeek R1' },
      { match: 'deepseek-coder-v2',         caps: CAPS_CODE,   displayName: 'DeepSeek Coder V2' },
      { match: 'deepseek-coder',            caps: CAPS_CODE,   displayName: 'DeepSeek Coder' },
      { match: 'deepseek-prover',           caps: CAPS_REASON, displayName: 'DeepSeek Prover' },
      { match: 'deepseek-math',             caps: CAPS_REASON, displayName: 'DeepSeek Math' },
      { match: 'deepseek-chat',             caps: CAPS_TEXT,   displayName: 'DeepSeek Chat' },
      { match: 'deepseek-reasoner',         caps: CAPS_REASON, displayName: 'DeepSeek Reasoner' },
      { match: 'deepclaude',                caps: CAPS_REASON, displayName: 'DeepClaude' },
      { match: 'deepseek',                  caps: CAPS_TEXT },
    ],
  },

  // ━━━ Qwen / Alibaba ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  qwen: {
    iconId: 'qwen',
    text: [
      // Qwen 3.6
      { match: /qwen3[.-]6-plus/,    ctx: 991_800, caps: CAPS_FRONTIER, displayName: 'Qwen 3.6 Plus' },
      { match: /qwen3[.-]6-max/,     ctx: 245_800, caps: CAPS_FRONTIER, displayName: 'Qwen 3.6 Max' },
      { match: /qwen3[.-]6-flash/,   ctx: 991_800, caps: CAPS_FRONTIER, displayName: 'Qwen 3.6 Flash' },
      { match: /qwen3[.-]6-35b-a3b/, ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Qwen 3.6 35B A3B' },
      { match: /qwen3[.-]6-27b/,     ctx: 260_100, caps: CAPS_FRONTIER, displayName: 'Qwen 3.6 27B' },
      { match: /qwen3[.-]6/,         caps: CAPS_FRONTIER, displayName: 'Qwen 3.6' },

      // Qwen 3.5
      { match: /qwen3[.-]5-flash/,        ctx: 991_800, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 Flash' },
      { match: /qwen3[.-]5-plus/,         ctx: 983_600, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 Plus' },
      { match: /qwen3[.-]5-omni-flash/,   ctx: 49_200,  caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 Omni Flash' },
      { match: /qwen3[.-]5-omni-plus/,    ctx: 983_600, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 Omni Plus' },
      { match: /qwen3[.-]5-122b-a10b/,    ctx: 260_100, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 122B A10B' },
      { match: /qwen3[.-]5-397b-a17b/,    ctx: 258_000, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 397B A17B' },
      { match: /qwen3[.-]5-35b-a3b/,      ctx: 260_100, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 35B A3B' },
      { match: /qwen3[.-]5-27b/,          ctx: 260_100, caps: CAPS_FRONTIER, displayName: 'Qwen 3.5 27B' },
      { match: /qwen3[.-]5-9b/,           ctx: 256_000, caps: CAPS_MID,      displayName: 'Qwen 3.5 9B' },
      { match: /qwen3[.-]5/,              caps: CAPS_FRONTIER, displayName: 'Qwen 3.5' },

      // QwQ / QvQ reasoning models
      { match: 'qvq-max', ctx: 128_000, caps: CAPS_REASON, displayName: 'QvQ Max' },
      { match: 'qvq',     caps: CAPS_REASON, displayName: 'QvQ' },
      { match: 'qwq-32b', ctx: 128_000, caps: CAPS_REASON, displayName: 'QwQ 32B' },
      { match: 'qwq',     ctx: 128_000, caps: CAPS_REASON, displayName: 'QwQ' },

      // Qwen 3.x
      { match: 'qwenlong-l1',       ctx: 128_000, caps: CAPS_REASON,   displayName: 'QwenLong L1' },
      { match: 'qwen3-vl',          caps: CAPS_FRONTIER, displayName: 'Qwen3 VL' },
      { match: 'qwen3-coder-next',  ctx: 262_144, caps: CAPS_CODE, displayName: 'Qwen3 Coder Next' },
      { match: 'qwen3-coder-flash', ctx: 128_000, caps: CAPS_CODE, displayName: 'Qwen3 Coder Flash' },
      { match: 'qwen3-coder-plus',  ctx: 128_000, caps: CAPS_CODE, displayName: 'Qwen3 Coder Plus' },
      { match: 'qwen3-coder-30b',   ctx: 128_000, caps: CAPS_CODE, displayName: 'Qwen3 Coder 30B A3B' },
      { match: 'qwen3-coder-480b',  ctx: 262_000, caps: CAPS_CODE, displayName: 'Qwen3 Coder 480B' },
      { match: 'qwen3-coder',       caps: CAPS_CODE, displayName: 'Qwen3 Coder' },
      { match: 'qwen3-next-80b',    ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Qwen3 Next 80B A3B' },
      { match: 'qwen3-max',         ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Qwen3 Max' },
      { match: 'qwen3-30b-a3b',     ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Qwen3 30B A3B' },
      { match: 'qwen3-235b-a22b',   ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Qwen3 235B A22B' },
      { match: 'qwen3-32b',         ctx: 41_000,  caps: CAPS_FRONTIER, displayName: 'Qwen3 32B' },
      { match: 'qwen3-14b',         ctx: 41_000,  caps: CAPS_FRONTIER, displayName: 'Qwen3 14B' },
      { match: 'qwen3-8b',          ctx: 41_000,  caps: CAPS_FRONTIER, displayName: 'Qwen3 8B' },
      { match: ['qwen-3', 'qwen3'], ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'Qwen 3' },

      // Qwen 2.x
      { match: /qwen2[.-]5-coder/, caps: CAPS_CODE,   displayName: 'Qwen 2.5 Coder' },
      { match: /qwen2[.-]5-vl/,    caps: CAPS_MID,    displayName: 'Qwen 2.5 VL' },
      { match: /qwen2[.-]5-math/,  caps: CAPS_REASON, displayName: 'Qwen 2.5 Math' },
      { match: /qwen2[.-]5-72b/,   ctx: 131_072, caps: CAPS_MID, displayName: 'Qwen 2.5 72B' },
      { match: /qwen2[.-]5-max/,   ctx: 32_000,  caps: CAPS_MID, displayName: 'Qwen 2.5 Max' },
      { match: /qwen2[.-]5/,       caps: CAPS_MID,    displayName: 'Qwen 2.5' },
      { match: 'qwen25',           caps: CAPS_MID,    displayName: 'Qwen 2.5' },
      { match: 'qwen2-vl',         caps: CAPS_MID,    displayName: 'Qwen 2 VL' },
      { match: 'qwen2',            caps: CAPS_TEXT,   displayName: 'Qwen 2' },

      // Qwen commercial tiers
      { match: 'qwen-plus',  ctx: 995_900,    caps: CAPS_MID,  displayName: 'Qwen Plus' },
      { match: 'qwen-turbo', ctx: 1_000_000,  caps: CAPS_TEXT, displayName: 'Qwen Turbo' },
      { match: 'qwen-long',  ctx: 10_000_000, caps: CAPS_TEXT, displayName: 'Qwen Long' },
      { match: 'qwen-vl',    caps: CAPS_MID,  displayName: 'Qwen VL' },
      { match: 'qwerky',     caps: CAPS_TEXT, displayName: 'Qwerky 72B' },
      { match: 'qwen',       caps: CAPS_TEXT },
    ],
    embed: [
      { match: ['qwen3-embedding', 'qwen-embedding'], displayName: 'Qwen Embedding' },
      { match: ['qwen3-reranker',  'qwen-reranker'],  displayName: 'Qwen Reranker' },
    ],
  },

  // ━━━ xAI — Grok ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  xai: {
    iconId: 'grok',
    text: [
      { match: /grok-4[.-]3/,      ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Grok 4.3' },
      { match: /grok-4[.-]20/,     ctx: 2_000_000, caps: CAPS_FRONTIER, displayName: 'Grok 4.20' },
      { match: /grok-4[.-]1-fast/, ctx: 2_000_000, caps: CAPS_FRONTIER, displayName: 'Grok 4.1 Fast' },
      { match: /grok-4[.-]1/,      ctx: 2_000_000, caps: CAPS_FRONTIER, displayName: 'Grok 4.1' },
      { match: 'grok-4-fast',      ctx: 2_000_000, caps: CAPS_FRONTIER, displayName: 'Grok 4 Fast' },
      { match: 'grok-4',           ctx: 256_000,   caps: CAPS_FRONTIER, displayName: 'Grok 4' },
      { match: 'grok-3-mini',      ctx: 131_072,   caps: CAPS_REASON,   displayName: 'Grok 3 mini' },
      { match: 'grok-3-fast',      ctx: 131_072,   caps: CAPS_FRONTIER, displayName: 'Grok 3 Fast' },
      { match: 'grok-3',           ctx: 131_072,   caps: CAPS_FRONTIER, displayName: 'Grok 3' },
      { match: 'grok-code-fast',   ctx: 256_000,   caps: CAPS_CODE,     displayName: 'Grok Code Fast' },
      { match: 'grok-2-vision',    ctx: 131_072,   caps: CAPS_MID,      displayName: 'Grok 2 Vision' },
      { match: 'grok-2',           ctx: 131_072,   caps: CAPS_MID,      displayName: 'Grok 2' },
      { match: 'grok',             caps: CAPS_TEXT },
    ],
  },

  // ━━━ Cohere — Command ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cohere: {
    iconId: 'cohere',
    text: [
      { match: 'command-a',       ctx: 256_000, caps: CAPS_REASON, displayName: 'Command A' },
      { match: 'command-r-plus',  ctx: 128_000, caps: CAPS_TEXT,   displayName: 'Command R+' },
      { match: 'command-r',       ctx: 128_000, caps: CAPS_TEXT,   displayName: 'Command R' },
      { match: 'command-light',   ctx: 4_096,   caps: CAPS_TEXT,   displayName: 'Command Light' },
      { match: 'command-nightly', caps: CAPS_TEXT, displayName: 'Command Nightly' },
      { match: 'command',         caps: CAPS_TEXT, displayName: 'Command' },
      { match: 'cohere',          caps: CAPS_TEXT },
    ],
    embed: [
      { match: 'embed-english',      displayName: 'Cohere Embed English' },
      { match: 'embed-multilingual', displayName: 'Cohere Embed Multilingual' },
    ],
  },

  // ━━━ Perplexity / Sonar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  perplexity: {
    iconId: 'perplexity',
    text: [
      { match: 'sonar-deep-research',  caps: CAPS_SEARCH_R, displayName: 'Sonar Deep Research' },
      { match: 'sonar-reasoning-pro',  caps: CAPS_SEARCH_R, displayName: 'Sonar Reasoning Pro' },
      { match: 'sonar-reasoning',      caps: CAPS_SEARCH_R, displayName: 'Sonar Reasoning' },
      { match: 'sonar-pro',            caps: CAPS_SEARCH,   displayName: 'Sonar Pro' },
      { match: 'sonar',                caps: CAPS_SEARCH,   displayName: 'Sonar' },
      { match: 'perplexity-deep-research', caps: CAPS_SEARCH_R, displayName: 'Perplexity Deep Research' },
      { match: 'perplexity',           caps: CAPS_SEARCH },
      { match: 'pplx',                 caps: ['search', 'tools'] },
    ],
  },

  // ━━━ Zhipu / Z.AI / GLM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // V suffix marks vision variants. Plain GLM 4.7 / 5 / 5.1 are
  // text-only reasoning models — no vision capability.
  zhipu: {
    iconId: 'zhipu',
    text: [
      { match: /glm-5[.-]1/,         ctx: 200_000, caps: CAPS_REASON, displayName: 'GLM 5.1' },
      { match: 'glm-5v-turbo',       ctx: 202_800, caps: CAPS_MID,    displayName: 'GLM 5V Turbo' },
      { match: 'glm-5-turbo',        ctx: 202_800, caps: CAPS_REASON, displayName: 'GLM 5 Turbo' },
      { match: 'glm-5',              ctx: 200_000, caps: CAPS_REASON, displayName: 'GLM 5' },
      { match: /glm-4[.-]7-flash/,   ctx: 200_000, caps: CAPS_REASON, displayName: 'GLM 4.7 Flash' },
      { match: /glm-4[.-]7/,         ctx: 200_000, caps: CAPS_REASON, displayName: 'GLM 4.7' },
      { match: /glm-4[.-]6v-flash/,  ctx: 128_000, caps: CAPS_MID,    displayName: 'GLM 4.6V Flash' },
      { match: /glm-4[.-]6v/,        ctx: 128_000, caps: CAPS_MID,    displayName: 'GLM 4.6V' },
      { match: /glm-4[.-]6-turbo/,   ctx: 200_000, caps: CAPS_REASON, displayName: 'GLM 4.6 Turbo' },
      { match: /glm-4[.-]6/,         ctx: 256_000, caps: CAPS_REASON, displayName: 'GLM 4.6' },
      { match: /glm-4[.-]5v/,        ctx: 64_000,  caps: CAPS_MID,    displayName: 'GLM 4.5V' },
      { match: /glm-4[.-]5-air/,     ctx: 128_000, caps: CAPS_REASON, displayName: 'GLM 4.5 Air' },
      { match: /glm-4[.-]5/,         ctx: 128_000, caps: CAPS_REASON, displayName: 'GLM 4.5' },
      { match: /glm-4[.-]1v/,        ctx: 64_000,  caps: CAPS_MID,    displayName: 'GLM 4.1V' },
      { match: 'glm-4-plus',         ctx: 128_000, caps: CAPS_MID,    displayName: 'GLM-4 Plus' },
      { match: 'glm-4-air',          ctx: 128_000, caps: CAPS_TEXT,   displayName: 'GLM-4 Air' },
      { match: 'glm-4-flash',        ctx: 128_000, caps: CAPS_TEXT,   displayName: 'GLM-4 Flash' },
      { match: 'glm-4-long',         ctx: 1_000_000, caps: CAPS_TEXT, displayName: 'GLM-4 Long' },
      { match: 'glm-4v',             caps: CAPS_MID,    displayName: 'GLM-4V' },
      { match: 'glm-4',              caps: CAPS_TEXT,   displayName: 'GLM-4' },
      { match: 'glm-z1',             ctx: 32_000,  caps: CAPS_REASON, displayName: 'GLM Z1' },
      { match: 'glm-zero',           caps: CAPS_REASON, displayName: 'GLM Zero' },
      { match: 'glm-',               caps: CAPS_TEXT },
      { match: 'chatglm',            caps: CAPS_TEXT,   displayName: 'ChatGLM' },
    ],
  },

  // ━━━ Moonshot — Kimi ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  moonshot: {
    iconId: '',
    text: [
      { match: /kimi-k2[.-]6/,       ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Kimi K2.6' },
      { match: /kimi-k2[.-]5/,       ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Kimi K2.5' },
      { match: 'kimi-k2-thinking',   ctx: 256_000, caps: CAPS_REASON,   displayName: 'Kimi K2 Thinking' },
      { match: 'kimi-k2-instruct',   ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Kimi K2 Instruct' },
      { match: 'kimi-k2',            ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Kimi K2' },
      { match: 'kimi-thinking',      ctx: 128_000, caps: CAPS_REASON,   displayName: 'Kimi Thinking' },
      { match: 'kimi',               caps: CAPS_FRONTIER, displayName: 'Kimi' },
      { match: 'moonshot',           caps: CAPS_TEXT,     displayName: 'Moonshot' },
    ],
  },

  // ━━━ Microsoft — Phi ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  microsoft: {
    iconId: '',
    text: [
      { match: 'phi-4-multimodal', ctx: 128_000, caps: CAPS_MID,  displayName: 'Phi-4 Multimodal' },
      { match: 'phi-4-mini',       ctx: 128_000, caps: CAPS_TEXT, displayName: 'Phi-4 mini' },
      { match: 'phi-4',            ctx: 128_000, caps: CAPS_TEXT, displayName: 'Phi-4' },
      { match: 'phi-3.5',          ctx: 128_000, caps: CAPS_TEXT, displayName: 'Phi-3.5' },
      { match: 'phi-3',            ctx: 128_000, caps: CAPS_TEXT, displayName: 'Phi-3' },
      { match: 'phi-2',            caps: CAPS_TEXT, displayName: 'Phi-2' },
      { match: 'wizardlm',         caps: CAPS_TEXT, displayName: 'WizardLM' },
    ],
  },

  // ━━━ 01.AI — Yi ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  '01ai': {
    iconId: '',
    text: [
      { match: /yi-1[.-]5/,    caps: CAPS_TEXT, displayName: 'Yi 1.5' },
      { match: 'yi-coder',     caps: CAPS_CODE, displayName: 'Yi Coder' },
      { match: 'yi-large',     ctx: 32_000,  caps: CAPS_TEXT, displayName: 'Yi Large' },
      { match: 'yi-lightning', ctx: 12_000,  caps: CAPS_TEXT, displayName: 'Yi Lightning' },
      { match: 'yi-medium',    ctx: 200_000, caps: CAPS_TEXT, displayName: 'Yi Medium' },
    ],
  },

  // ━━━ Amazon — Nova ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  amazon: {
    iconId: '',
    text: [
      { match: 'nova-2-lite', ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'Amazon Nova 2 Lite' },
      { match: 'nova-pro',    ctx: 300_000,   caps: CAPS_MID,      displayName: 'Amazon Nova Pro' },
      { match: 'nova-lite',   ctx: 300_000,   caps: CAPS_MID,      displayName: 'Amazon Nova Lite' },
      { match: 'nova-micro',  ctx: 128_000,   caps: CAPS_TEXT,     displayName: 'Amazon Nova Micro' },
      { match: 'nova',        caps: CAPS_MID, displayName: 'Amazon Nova' },
    ],
  },

  // ━━━ ByteDance — Doubao / Seed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bytedance: {
    iconId: '',
    text: [
      { match: 'doubao-seed-2.0-pro',  ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Doubao Seed 2.0 Pro' },
      { match: 'doubao-seed-2.0-mini', ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Doubao Seed 2.0 Mini' },
      { match: 'doubao-seed-2.0-lite', ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Doubao Seed 2.0 Lite' },
      { match: 'doubao-seed-2.0-code', ctx: 256_000, caps: CAPS_CODE,     displayName: 'Doubao Seed 2.0 Code' },
      { match: 'doubao-seed-2.0',      ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Doubao Seed 2.0' },
      { match: 'doubao-seed-1.8',      ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'Doubao Seed 1.8' },
      { match: 'doubao-seed-1.6',      ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Doubao Seed 1.6' },
      { match: 'doubao-1.5-thinking-vision', ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'Doubao 1.5 Thinking Vision Pro' },
      { match: 'doubao-1.5-thinking',  ctx: 128_000, caps: CAPS_REASON, displayName: 'Doubao 1.5 Thinking Pro' },
      { match: 'doubao-1.5-vision',    ctx: 32_000,  caps: CAPS_MID,    displayName: 'Doubao 1.5 Vision Pro' },
      { match: 'doubao-1.5-pro-256k',  ctx: 256_000, caps: CAPS_TEXT,   displayName: 'Doubao 1.5 Pro 256k' },
      { match: 'doubao-1.5-pro',       ctx: 32_000,  caps: CAPS_TEXT,   displayName: 'Doubao 1.5 Pro' },
      { match: 'doubao',               caps: CAPS_TEXT, displayName: 'Doubao' },
    ],
  },

  // ━━━ Baidu — ERNIE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  baidu: {
    iconId: '',
    text: [
      { match: /ernie-5[.-]0/,          ctx: 128_000, caps: CAPS_REASON, displayName: 'ERNIE 5.0' },
      { match: /ernie-x1[.-]1/,         ctx: 64_000,  caps: CAPS_REASON, displayName: 'ERNIE X1.1' },
      { match: 'ernie-x1-turbo',        ctx: 32_000,  caps: CAPS_REASON, displayName: 'ERNIE X1 Turbo' },
      { match: 'ernie-x1',              ctx: 32_000,  caps: CAPS_REASON, displayName: 'ERNIE X1' },
      { match: /ernie-4[.-]5-vl/,       ctx: 32_768,  caps: CAPS_MID,    displayName: 'ERNIE 4.5 VL' },
      { match: /ernie-4[.-]5-turbo-vl/, ctx: 32_000,  caps: CAPS_MID,    displayName: 'ERNIE 4.5 Turbo VL' },
      { match: /ernie-4[.-]5-turbo/,    ctx: 128_000, caps: CAPS_MID,    displayName: 'ERNIE 4.5 Turbo' },
      { match: /ernie-4[.-]5-300b/,     ctx: 131_072, caps: CAPS_MID,    displayName: 'ERNIE 4.5 300B' },
      { match: /ernie-4[.-]5/,          ctx: 8_000,   caps: CAPS_MID,    displayName: 'ERNIE 4.5' },
      { match: 'ernie',                 caps: CAPS_MID, displayName: 'ERNIE' },
    ],
  },

  // ━━━ Tencent — Hunyuan / Hy ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  tencent: {
    iconId: '',
    text: [
      { match: 'hy3',             ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Hy3' },
      { match: 'hunyuan-mt',      ctx: 8_192,   caps: CAPS_TEXT,     displayName: 'Hunyuan MT' },
      { match: 'hunyuan-turbo-s', ctx: 24_000,  caps: CAPS_REASON,   displayName: 'Hunyuan Turbo S' },
      { match: 'hunyuan',         caps: CAPS_TEXT, displayName: 'Hunyuan' },
    ],
  },

  // ━━━ Baichuan ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  baichuan: {
    iconId: '',
    text: [
      { match: 'baichuan-m2',      ctx: 32_768,  caps: CAPS_REASON,   displayName: 'Baichuan M2 32B' },
      { match: 'baichuan-4-turbo', ctx: 128_000, caps: CAPS_FRONTIER, displayName: 'Baichuan 4 Turbo' },
      { match: 'baichuan-4-air',   ctx: 32_768,  caps: CAPS_TEXT,     displayName: 'Baichuan 4 Air' },
      { match: 'baichuan',         caps: CAPS_TEXT, displayName: 'Baichuan' },
    ],
  },

  // ━━━ StepFun ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  stepfun: {
    iconId: '',
    text: [
      { match: 'step-r1-v',      ctx: 128_000, caps: CAPS_REASON,   displayName: 'Step R1 V' },
      { match: 'step-3.5-flash', ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Step 3.5 Flash' },
      { match: 'step-3',         ctx: 65_536,  caps: CAPS_FRONTIER, displayName: 'Step-3' },
      { match: 'step-2-mini',    ctx: 8_000,   caps: CAPS_TEXT,     displayName: 'Step-2 Mini' },
      { match: 'step-2',         ctx: 16_000,  caps: CAPS_TEXT,     displayName: 'Step-2' },
    ],
  },

  // ━━━ AI21 — Jamba ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ai21: {
    iconId: '',
    text: [
      { match: 'jamba-large', ctx: 256_000, caps: CAPS_TEXT, displayName: 'Jamba Large' },
      { match: 'jamba-mini',  ctx: 256_000, caps: CAPS_TEXT, displayName: 'Jamba Mini' },
      { match: 'jamba',       caps: CAPS_TEXT, displayName: 'Jamba' },
    ],
  },

  // ━━━ Inflection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inflection: {
    iconId: '',
    text: [
      { match: 'inflection-3-pi', ctx: 8_000, caps: CAPS_TEXT, displayName: 'Inflection 3 Pi' },
      { match: 'inflection-3',    ctx: 8_000, caps: CAPS_TEXT, displayName: 'Inflection 3 Productivity' },
    ],
  },

  // ━━━ Liquid AI — LFM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  liquidai: {
    iconId: '',
    text: [
      { match: 'lfm2', ctx: 32_768, caps: CAPS_TEXT, displayName: 'LFM2 24B A2B' },
      { match: 'lfm',  caps: CAPS_TEXT, displayName: 'LFM' },
    ],
  },

  // ━━━ MiniMax ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  minimax: {
    iconId: '',
    text: [
      { match: /minimax-m2[.-]7/, ctx: 204_800,   caps: CAPS_FRONTIER, displayName: 'MiniMax M2.7' },
      { match: /minimax-m2[.-]5/, ctx: 204_800,   caps: CAPS_FRONTIER, displayName: 'MiniMax M2.5' },
      { match: /minimax-m2[.-]1/, ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'MiniMax M2.1' },
      { match: 'minimax-m2-her',  ctx: 65_536,    caps: CAPS_TEXT,     displayName: 'MiniMax M2-her' },
      { match: 'minimax-m2',      ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'MiniMax M2' },
      { match: 'minimax-m1',      ctx: 1_000_000, caps: CAPS_REASON,   displayName: 'MiniMax M1' },
      { match: 'minimax-01',      ctx: 1_000_000, caps: CAPS_TEXT,     displayName: 'MiniMax 01' },
      { match: 'minimax',         caps: CAPS_FRONTIER, displayName: 'MiniMax' },
    ],
  },

  // ━━━ Xiaomi — MiMo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  xiaomi: {
    iconId: '',
    text: [
      { match: /mimo-v2[.-]5-pro/, ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'MiMo V2.5 Pro' },
      { match: /mimo-v2[.-]5/,     ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'MiMo V2.5' },
      { match: 'mimo-v2-pro',      ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'MiMo V2 Pro' },
      { match: 'mimo-v2-omni',     ctx: 262_144,   caps: CAPS_FRONTIER, displayName: 'MiMo V2 Omni' },
      { match: 'mimo-v2-flash',    ctx: 256_000,   caps: CAPS_REASON,   displayName: 'MiMo V2 Flash' },
      { match: 'mimo',             caps: CAPS_REASON, displayName: 'MiMo' },
    ],
  },

  // ━━━ Nvidia — Nemotron ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  nvidia: {
    iconId: '',
    text: [
      { match: 'nemotron-3-nano-omni',   ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Nemotron 3 Nano Omni' },
      { match: 'nemotron-3-nano',        ctx: 256_000, caps: CAPS_FRONTIER, displayName: 'Nemotron 3 Nano' },
      { match: 'nemotron-3-super',       ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Nemotron 3 Super' },
      { match: 'nemotron-nano',          ctx: 128_000, caps: CAPS_TEXT,     displayName: 'Nemotron Nano' },
      { match: 'nemotron-super',         ctx: 128_000, caps: CAPS_REASON,   displayName: 'Nemotron Super' },
      { match: 'nemotron',               caps: CAPS_TEXT, displayName: 'Nemotron' },
      { match: 'openreasoning-nemotron', caps: CAPS_REASON, displayName: 'OpenReasoning-Nemotron' },
    ],
  },

  // ━━━ IBM — Granite ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ibm: {
    iconId: '',
    text: [
      { match: /granite-4[.-]1/, ctx: 131_072, caps: CAPS_TEXT, displayName: 'Granite 4.1 8B' },
      { match: 'granite',        caps: CAPS_TEXT, displayName: 'Granite' },
    ],
    embed: [
      { match: 'granite-embedding', displayName: 'Granite Embedding' },
    ],
  },

  // ━━━ Allen AI — Olmo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  allenai: {
    iconId: '',
    text: [
      { match: /olmo-3[.-]1/,      ctx: 65_536,  caps: CAPS_TEXT,   displayName: 'Olmo 3.1 32B' },
      { match: 'olmo-3-32b-think', ctx: 128_000, caps: CAPS_REASON, displayName: 'Olmo 3 32B Think' },
      { match: 'olmo',             caps: CAPS_TEXT, displayName: 'Olmo' },
    ],
  },

  // ━━━ Upstage — Solar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  upstage: {
    iconId: '',
    text: [
      { match: 'solar-pro-3', ctx: 128_000, caps: CAPS_TEXT, displayName: 'Solar Pro 3' },
      { match: 'solar',       caps: CAPS_TEXT, displayName: 'Solar' },
    ],
  },

  // ━━━ Inception — Mercury ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inception: {
    iconId: '',
    text: [
      { match: 'mercury-2',     ctx: 128_000, caps: CAPS_REASON, displayName: 'Mercury 2' },
      { match: 'mercury-coder', ctx: 32_768,  caps: CAPS_CODE,   displayName: 'Mercury Coder' },
      { match: 'mercury',       caps: CAPS_REASON, displayName: 'Mercury' },
    ],
  },

  // ━━━ Vercel — v0 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  vercel: {
    iconId: '',
    text: [
      { match: /v0-1[.-]5-lg/, ctx: 1_000_000, caps: CAPS_FRONTIER, displayName: 'v0 1.5 LG' },
      { match: /v0-1[.-]5-md/, ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'v0 1.5 MD' },
      { match: /v0-1[.-]0-md/, ctx: 200_000,   caps: CAPS_FRONTIER, displayName: 'v0 1.0 MD' },
      { match: 'v0-',          caps: CAPS_FRONTIER, displayName: 'v0' },
    ],
  },

  // ━━━ Arcee — Trinity ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  arcee: {
    iconId: '',
    text: [
      { match: 'trinity-large', ctx: 262_144, caps: CAPS_REASON, displayName: 'Trinity Large' },
      { match: 'trinity-mini',  ctx: 131_072, caps: CAPS_TEXT,   displayName: 'Trinity Mini' },
      { match: 'trinity',       caps: CAPS_REASON, displayName: 'Trinity' },
    ],
  },

  // ━━━ Salesforce — xLAM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  salesforce: {
    iconId: '',
    text: [
      { match: 'xlam', ctx: 128_000, caps: CAPS_TEXT, displayName: 'xLAM' },
    ],
  },

  // ━━━ Tongyi Lab ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  tongyi: {
    iconId: '',
    text: [
      { match: 'tongyi-deepresearch', ctx: 128_000, caps: CAPS_SEARCH_R, displayName: 'Tongyi DeepResearch' },
    ],
  },

  // ━━━ inclusionAI — Ling ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inclusionai: {
    iconId: '',
    text: [
      { match: /ling-2[.-]6-1t/,    ctx: 262_144, caps: CAPS_FRONTIER, displayName: 'Ling 2.6 1T' },
      { match: /ling-2[.-]6-flash/, ctx: 262_144, caps: CAPS_TEXT,     displayName: 'Ling 2.6 Flash' },
      { match: 'ling-',             caps: CAPS_TEXT, displayName: 'Ling' },
    ],
  },

  // ━━━ Nous Research ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Hermes is a Llama-base finetune but Nous publishes under their own brand.
  nous: {
    iconId: '',
    text: [
      { match: 'hermes-4-large',  ctx: 128_000, caps: CAPS_REASON, displayName: 'Hermes 4 Large' },
      { match: 'hermes-4-medium', ctx: 128_000, caps: CAPS_REASON, displayName: 'Hermes 4 Medium' },
      { match: 'hermes-4',        ctx: 128_000, caps: CAPS_REASON, displayName: 'Hermes 4' },
      { match: 'hermes-3',        ctx: 65_536,  caps: CAPS_TEXT,   displayName: 'Hermes 3' },
      { match: 'deephermes',      ctx: 128_000, caps: CAPS_TEXT,   displayName: 'DeepHermes' },
      { match: 'hermes',          caps: CAPS_TEXT, displayName: 'Hermes' },
    ],
  },

  // ━━━ Aion Labs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  aionlabs: {
    iconId: '',
    text: [
      { match: /aion-2[.-]5/,      ctx: 131_072, caps: CAPS_REASON, displayName: 'Aion-2.5' },
      { match: /aion-2[.-]0/,      ctx: 131_072, caps: CAPS_REASON, displayName: 'Aion-2.0' },
      { match: /aion-1[.-]0-mini/, ctx: 131_072, caps: CAPS_REASON, displayName: 'Aion 1.0 mini' },
      { match: /aion-1[.-]0/,      ctx: 65_536,  caps: CAPS_REASON, displayName: 'Aion 1.0' },
      { match: 'aion',             caps: CAPS_REASON, displayName: 'Aion' },
    ],
  },

  // ━━━ Reka ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  reka: {
    iconId: '',
    text: [
      { match: 'reka-flash', caps: CAPS_MID, displayName: 'Reka Flash' },
      { match: 'reka-core',  caps: CAPS_MID, displayName: 'Reka Core' },
      { match: 'reka',       caps: CAPS_MID, displayName: 'Reka' },
    ],
  },

  // ━━━ Hugging Face — community open-weights ━━━━━━━━━━━━━━━━━━━━━━━
  // Catch-all for community embedding/voice/tts/image models that
  // aren't authored by a specific lab tracked above. Lab is "Hugging
  // Face" because that's where they ship from.
  huggingface: {
    iconId: 'huggingface',
    embed: [
      { match: 'minilm',                 displayName: 'MiniLM' },
      { match: 'all-mpnet',              displayName: 'all-MPNet' },
      { match: 'bge-large',              displayName: 'BGE Large' },
      { match: 'bge-base',               displayName: 'BGE Base' },
      { match: 'bge-small',              displayName: 'BGE Small' },
      { match: 'bge-m3',                 displayName: 'BGE-M3' },
      { match: 'bge-' },
      { match: 'nomic-embed',            displayName: 'Nomic Embed' },
      { match: 'mxbai-embed',            displayName: 'MixedBread Embed' },
      { match: 'jina-embed',             displayName: 'Jina Embed' },
      { match: 'jina-embeddings',        displayName: 'Jina Embeddings' },
      { match: 'jina-code-embedding',    displayName: 'Jina Code Embedding' },
      { match: 'e5-large',               displayName: 'E5 Large' },
      { match: 'e5-base',                displayName: 'E5 Base' },
      { match: 'e5-small',               displayName: 'E5 Small' },
      { match: 'instructor-',            displayName: 'Instructor' },
      { match: 'snowflake-arctic-embed', displayName: 'Arctic Embed' },
      // Generic catch-alls for any model whose id contains these markers.
      { match: 'embedding' },
      { match: 'reranker' },
    ],
    voice: [
      { match: 'distil-whisper', displayName: 'Distil-Whisper' },
      { match: 'wav2vec' },
      { match: 'parakeet',       displayName: 'Parakeet' },
    ],
    tts: [
      { match: 'piper',  displayName: 'Piper TTS' },
      { match: 'xtts',   displayName: 'XTTS' },
      { match: 'kokoro', displayName: 'Kokoro TTS' },
      { match: 'bark',   displayName: 'Bark' },
    ],
    image: [
      { match: 'flux',             displayName: 'FLUX' },
      { match: 'stable-diffusion', displayName: 'Stable Diffusion' },
      { match: 'sdxl',             displayName: 'SDXL' },
      { match: 'sd3',              displayName: 'Stable Diffusion 3' },
      { match: 'sd-' },
    ],
  },

};

// ─── Lookup ─────────────────────────────────────────────────────────

export type RegistryHit = {
  lab:           ModelLab;
  labLabel:      string;
  iconId:        string;        // '' if no icon registered for the lab
  modality:      Modality;
  capabilities?: Capability[];
  contextLength?: number;
  displayName?:  string;
};

// Length of the longest substring/regex match between `id` and the entry's
// `match` field. Returns 0 if nothing matches.
function matchLength(id: string, m: EntryMatch): number {
  const arr = Array.isArray(m) ? m : [m];
  let best = 0;
  for (const item of arr) {
    if (typeof item === 'string') {
      if (id.includes(item) && item.length > best) best = item.length;
    } else {
      const r = item.exec(id);
      if (r && r[0].length > best) best = r[0].length;
    }
  }
  return best;
}

// Normalises a remoteId for matching:
//   - strips directory prefix (gguf paths share noisy folder roots)
//   - strips .gguf suffix
//   - strips provider routing prefix (e.g., "openrouter/openai/gpt-5")
//   - lowercases
function normalize(remoteId: string): string {
  if (!remoteId) return '';
  const slash = remoteId.lastIndexOf('/');
  const base = slash >= 0 ? remoteId.slice(slash + 1) : remoteId;
  return base.replace(/\.gguf$/i, '').toLowerCase();
}

export function lookupModel(remoteId: string): RegistryHit | null {
  if (!remoteId) return null;
  // Match on basename (handles local gguf paths and 'provider/model'
  // routing ids), then fall back to the raw lowercased id in case the
  // prefix itself contains the family marker.
  const basename = normalize(remoteId);
  const raw = remoteId.toLowerCase();

  type Best = {
    lab: ModelLab;
    modality: Modality;
    def: ModelDef;
    bucketIcon: string;
    matchLen: number;
  };
  let best: Best | null = null;

  for (const [labKey, bucket] of Object.entries(REGISTRY)) {
    if (!bucket) continue;
    const lab = labKey as ModelLab;
    for (const modality of ALL_MODALITIES) {
      const defs = bucket[modality];
      if (!defs) continue;
      for (const def of defs) {
        const len = Math.max(matchLength(basename, def.match), matchLength(raw, def.match));
        if (len > 0 && (!best || len > best.matchLen)) {
          best = { lab, modality, def, bucketIcon: bucket.iconId, matchLen: len };
        }
      }
    }
  }

  if (!best) return null;

  return {
    lab:           best.lab,
    labLabel:      LAB_LABEL[best.lab],
    iconId:        best.def.iconId || best.bucketIcon || LAB_DEFAULT_ICON[best.lab] || '',
    modality:      best.modality,
    capabilities:  best.def.caps,
    contextLength: best.def.ctx,
    displayName:   best.def.displayName,
  };
}
