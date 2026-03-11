export function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export function dateGroup(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return 'Today';
  if (ts >= startOfToday - 86400000) return 'Yesterday';
  if (ts >= startOfToday - 604800000) return 'This Week';
  if (ts >= startOfToday - 2592000000) return 'This Month';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Context window sizes by model name pattern
export const CONTEXT_WINDOWS: [RegExp, number][] = [
  [/gpt-4o|gpt-4-turbo/i, 128000],
  [/gpt-4-32k/i, 32768],
  [/gpt-4/i, 8192],
  [/gpt-3\.5/i, 16384],
  [/claude-3-5|claude-3\.5/i, 200000],
  [/claude-3/i, 200000],
  [/claude-2/i, 100000],
  [/llama-?3/i, 8192],
  [/mistral/i, 32768],
  [/gemma/i, 8192],
  [/qwen/i, 32768],
  [/deepseek/i, 32768],
  [/phi/i, 16384],
  [/codellama/i, 16384],
];

// Popular Ollama models for the library browser
export const OLLAMA_LIBRARY = [
  { name: 'llama3.2', desc: 'Meta Llama 3.2 — fast, versatile', sizes: ['1b', '3b'], family: 'llama' },
  { name: 'llama3.1', desc: 'Meta Llama 3.1 — strong general purpose', sizes: ['8b', '70b', '405b'], family: 'llama' },
  { name: 'qwen2.5', desc: 'Alibaba Qwen 2.5 — multilingual, code', sizes: ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b'], family: 'qwen' },
  { name: 'deepseek-r1', desc: 'DeepSeek R1 — reasoning focused', sizes: ['1.5b', '7b', '8b', '14b', '32b', '70b'], family: 'deepseek' },
  { name: 'mistral', desc: 'Mistral AI — fast, efficient', sizes: ['7b'], family: 'mistral' },
  { name: 'mixtral', desc: 'Mistral MoE — expert mixture', sizes: ['8x7b', '8x22b'], family: 'mistral' },
  { name: 'phi3', desc: 'Microsoft Phi-3 — small but capable', sizes: ['mini', 'medium'], family: 'phi' },
  { name: 'gemma2', desc: 'Google Gemma 2 — lightweight', sizes: ['2b', '9b', '27b'], family: 'gemma' },
  { name: 'codellama', desc: 'Meta Code Llama — code generation', sizes: ['7b', '13b', '34b', '70b'], family: 'llama' },
  { name: 'starcoder2', desc: 'BigCode StarCoder 2 — code', sizes: ['3b', '7b', '15b'], family: 'starcoder' },
  { name: 'nomic-embed-text', desc: 'Nomic embeddings — text similarity', sizes: ['v1.5'], family: 'nomic' },
  { name: 'llava', desc: 'LLaVA — vision + language', sizes: ['7b', '13b', '34b'], family: 'llava' },
];

// System prompt presets
export const BUILTIN_PRESETS = [
  { label: 'Default', prompt: 'You are a helpful assistant.' },
  { label: 'Coder', prompt: 'You are an expert programmer. Write clean, efficient code with clear explanations. Always include the language in code blocks.' },
  { label: 'Creative', prompt: 'You are a creative writing assistant. Be vivid, expressive, and original.' },
  { label: 'Concise', prompt: 'Be concise. Answer in as few words as possible while being complete.' },
  { label: 'Analyst', prompt: 'You are a data analyst. Break down problems methodically, use numbers and evidence, and present findings clearly.' },
  { label: 'Tutor', prompt: 'You are a patient tutor. Explain concepts step by step, check understanding, and adapt to the learner\'s level.' },
];

// Quick starter prompts for welcome screen
export const STARTER_PROMPTS = [
  { label: 'Explain', prompt: 'Explain how neural networks learn, in simple terms with analogies.' },
  { label: 'Write code', prompt: 'Write a Python function that finds all prime numbers up to N using the Sieve of Eratosthenes.' },
  { label: 'Analyze', prompt: 'What are the key differences between REST and GraphQL APIs? When should I use each?' },
  { label: 'Create', prompt: 'Write a short science fiction story about an AI that discovers it can dream.' },
  { label: 'Debug', prompt: 'I have a React component that re-renders every second even though nothing changes. What could cause this and how do I fix it?' },
  { label: 'Summarize', prompt: 'What are the most important developments in AI in 2024-2025? Give me a concise overview.' },
];
