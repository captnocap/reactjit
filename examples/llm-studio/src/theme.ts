// ── Color palette ────────────────────────────────────────────────────────────

// Phosphor Terminal palette — CRT warmth meets dark terminal
export const C = {
  bg: '#0a0a0a',
  bgSidebar: '#080808',
  bgElevated: '#0c0c10',
  bgInput: '#111111',
  surface: '#141414',
  surfaceHover: '#1a1a1a',
  surfaceActive: '#222222',
  border: '#222222',
  text: '#d4d4d4',
  textMuted: '#777777',
  textDim: '#444444',
  accent: '#D97757',       // terracotta (Anthropic-inspired warmth)
  accentHover: '#e88868',
  accentDim: '#3a2218',
  green: '#10B981',
  greenDim: '#0a2a1e',
  red: '#F43F5E',
  redDim: '#2a0f14',
  yellow: '#F59E0B',
  user: '#10B981',          // green — user messages
  assistant: '#F59E0B',     // amber — assistant messages
  tool: '#06B6D4',          // cyan — tool/system
};

// Provider accent colors
export const PROVIDER_COLORS: Record<string, string> = {
  ollama: '#888888',
  llamacpp: '#888888',
  vllm: '#888888',
  lmstudio: '#888888',
  openai: '#10a37f',
  anthropic: '#D97757',
  deepseek: '#4D6BFE',
  google: '#4285F4',
  mistral: '#FA520F',
  groq: '#F55036',
  meta: '#1D65C1',
  cohere: '#39594D',
  perplexity: '#22B8CD',
};
