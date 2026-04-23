// =============================================================================
// useLlmStudioSession — per-column state for the LLM Studio compare surface
// =============================================================================
// Holds an array of columns, a shared prompt, a shared system prompt, and
// exposes mutators that fan-out or operate on one column. Each column carries
// its own AIConfig + conversation + live stream state + timing stats so the
// panel can render N independent side-by-side runs from a single shared
// prompt.
//
// Module-scope store + subscribe so multiple subcomponents (ModelColumn,
// ComparisonView, StatsRow) see the same state. Persists the column list +
// shared prompts via __store_* so reopening the panel brings back your
// comparison lineup.
// =============================================================================

import type { AIConfig, Message } from '../../../lib/ai/types';
import type { StreamHandle } from '../../../lib/ai/stream';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const K = 'sweatshop.llm-studio.';

function sget<T>(path: string, fallback: T): T {
  try {
    const raw = storeGet(K + path);
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof fallback === 'object') { try { return JSON.parse(String(raw)); } catch { return fallback; } }
    return String(raw) as any;
  } catch { return fallback; }
}
function sset(path: string, value: any) {
  try { storeSet(K + path, typeof value === 'object' ? JSON.stringify(value) : String(value)); } catch {}
}

export interface ColumnStats {
  tokensIn: number;     // estimated — prompt+history chars / 4
  tokensOut: number;    // estimated — response chars / 4
  tokensPerSec: number;
  ttftMs: number;       // time to first content byte
  elapsedMs: number;
  costEstUsd: number;   // tokensIn*inRate + tokensOut*outRate
}

export interface LlmColumn {
  id: string;
  config: AIConfig;          // provider / model / temp / maxTokens
  messages: Message[];       // conversation so far
  streaming: boolean;
  streamedText: string;      // partial content during streaming
  error: string | null;
  stats: ColumnStats;
  startedAt: number;
  firstByteAt: number;
  // not persisted — live handle for cancellation
  handle: StreamHandle | null;
}

export interface LlmStudioSession {
  prompt: string;
  systemPrompt: string;
  systemPromptEnabled: boolean;
  columns: LlmColumn[];
}

const EMPTY_STATS: ColumnStats = {
  tokensIn: 0, tokensOut: 0, tokensPerSec: 0, ttftMs: 0, elapsedMs: 0, costEstUsd: 0,
};

function defaultConfig(): AIConfig {
  return { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 1024 };
}

function loadColumns(): LlmColumn[] {
  const saved: Array<{ id: string; config: AIConfig }> = sget('columns', [] as any);
  if (!Array.isArray(saved) || saved.length === 0) {
    return [freshColumn(defaultConfig()), freshColumn({ ...defaultConfig(), provider: 'anthropic', model: 'claude-haiku-4-5' })];
  }
  return saved.map((s) => freshColumn(s.config, s.id));
}

function freshColumn(config: AIConfig, idOverride?: string): LlmColumn {
  return {
    id: idOverride || ('col-' + Math.random().toString(36).slice(2, 9)),
    config,
    messages: [],
    streaming: false,
    streamedText: '',
    error: null,
    stats: { ...EMPTY_STATS },
    startedAt: 0,
    firstByteAt: 0,
    handle: null,
  };
}

const state: LlmStudioSession = {
  prompt: sget('prompt', ''),
  systemPrompt: sget('systemPrompt', 'You are a helpful assistant.'),
  systemPromptEnabled: sget('systemPromptEnabled', false) === 'true' || sget('systemPromptEnabled', false) === true,
  columns: loadColumns(),
};

const listeners = new Set<() => void>();
export function emit() { listeners.forEach((fn) => { try { fn(); } catch {} }); }

function persistColumns() {
  sset('columns', state.columns.map((c) => ({ id: c.id, config: c.config })));
}

// ── Mutators ────────────────────────────────────────────────────────────────

export function setPrompt(v: string)              { state.prompt = v;              sset('prompt', v);              emit(); }
export function setSystemPrompt(v: string)        { state.systemPrompt = v;        sset('systemPrompt', v);        emit(); }
export function setSystemPromptEnabled(v: boolean){ state.systemPromptEnabled = v; sset('systemPromptEnabled', v); emit(); }

export function addColumn(config?: AIConfig) {
  state.columns.push(freshColumn(config || defaultConfig()));
  persistColumns();
  emit();
}
export function removeColumn(id: string) {
  const c = state.columns.find((x) => x.id === id);
  if (c && c.handle) { try { c.handle.stop(); } catch {} }
  state.columns = state.columns.filter((x) => x.id !== id);
  persistColumns();
  emit();
}
export function updateColumnConfig(id: string, patch: Partial<AIConfig>) {
  const c = state.columns.find((x) => x.id === id);
  if (!c) return;
  c.config = { ...c.config, ...patch };
  persistColumns();
  emit();
}
export function patchColumn(id: string, patch: Partial<LlmColumn>) {
  const c = state.columns.find((x) => x.id === id);
  if (!c) return;
  Object.assign(c, patch);
  emit();
}
export function resetColumn(id: string) {
  const c = state.columns.find((x) => x.id === id);
  if (!c) return;
  if (c.handle) { try { c.handle.stop(); } catch {} }
  c.messages = [];
  c.streamedText = '';
  c.streaming = false;
  c.error = null;
  c.stats = { ...EMPTY_STATS };
  c.handle = null;
  emit();
}

export function getSession(): LlmStudioSession { return state; }

export function useLlmStudioSession(): LlmStudioSession {
  const [, setTick] = (require('react') as any).useState(0);
  (require('react') as any).useEffect(() => {
    const fn = () => setTick((t: number) => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return state;
}
