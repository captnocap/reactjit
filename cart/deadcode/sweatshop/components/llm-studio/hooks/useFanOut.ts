// =============================================================================
// useFanOut — broadcast the shared prompt to every column in parallel
// =============================================================================
// Wraps streamChat() from P9's AI stack. Each column gets its own
// StreamHandle — one slow model never blocks another. onDelta writes into
// the column's streamedText live; completion promotes the accumulated text
// into a real assistant Message on the column's history. Stats (TTFT,
// tokens/s, estimated cost) are measured per column from real request
// timestamps — no synthetic numbers.
// =============================================================================

import { streamChat, type StreamHandle } from '../../../lib/ai/stream';
import type { AIConfig, Message } from '../../../lib/ai/types';
import { getKeyForProvider } from '../../../lib/ai/keys';
import {
  emit, getSession, patchColumn, useLlmStudioSession,
  type LlmColumn,
} from './useLlmStudioSession';

// Rough cost table (USD per 1M tokens). Covers the default picks the panel
// ships with; unknown models fall back to (0, 0) so the column shows $0.00
// rather than a misleading estimate.
const COST_PER_MTOK: Record<string, [number, number]> = {
  'gpt-4o':             [2.5, 10.0],
  'gpt-4o-mini':        [0.15, 0.6],
  'gpt-4.1':            [2.0, 8.0],
  'gpt-4.1-mini':       [0.4, 1.6],
  'o1-mini':            [1.1, 4.4],
  'claude-opus-4-7':    [15.0, 75.0],
  'claude-opus-4-6':    [15.0, 75.0],
  'claude-sonnet-4-6':  [3.0, 15.0],
  'claude-sonnet-4-5':  [3.0, 15.0],
  'claude-haiku-4-5':   [1.0, 5.0],
};

function estTokens(text: string): number {
  // Cheap English estimate: ~4 chars/token. Labelled "est" in UI.
  return Math.ceil((text || '').length / 4);
}

function estCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = COST_PER_MTOK[model];
  if (!rates) return 0;
  return (tokensIn * rates[0] + tokensOut * rates[1]) / 1_000_000;
}

function resolveConfigForColumn(config: AIConfig): AIConfig {
  const key = getKeyForProvider(config.provider);
  return {
    ...config,
    apiKey:  config.apiKey  || (key && key.apiKey)  || undefined,
    baseURL: config.baseURL || (key && key.baseURL) || undefined,
  };
}

function buildHistory(column: LlmColumn, prompt: string, systemPrompt: string | null): Message[] {
  const sys: Message[] = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];
  return sys.concat(column.messages).concat({ role: 'user', content: prompt });
}

async function runOne(columnId: string, prompt: string, systemPrompt: string | null) {
  const session = getSession();
  const col = session.columns.find((c) => c.id === columnId);
  if (!col) return;
  if (col.streaming && col.handle) { try { col.handle.stop(); } catch {} }

  const config = resolveConfigForColumn(col.config);
  const history = buildHistory(col, prompt, systemPrompt);
  const tokensInEst = estTokens(history.map((m) => typeof m.content === 'string' ? m.content : '').join(' '));

  const startedAt = Date.now();
  patchColumn(columnId, {
    streaming: true,
    streamedText: '',
    error: null,
    startedAt,
    firstByteAt: 0,
    stats: { tokensIn: tokensInEst, tokensOut: 0, tokensPerSec: 0, ttftMs: 0, elapsedMs: 0, costEstUsd: 0 },
  });

  let accText = '';
  let firstByteAt = 0;
  const handle: StreamHandle = streamChat(config, history, {
    onDelta: (delta) => {
      if (delta.content) {
        if (firstByteAt === 0) {
          firstByteAt = Date.now();
          patchColumn(columnId, { firstByteAt });
        }
        accText += delta.content;
        const elapsedMs = Date.now() - startedAt;
        const tokensOut = estTokens(accText);
        const tokensPerSec = elapsedMs > 0 ? (tokensOut * 1000) / elapsedMs : 0;
        patchColumn(columnId, {
          streamedText: accText,
          stats: {
            tokensIn: tokensInEst,
            tokensOut,
            tokensPerSec,
            ttftMs: firstByteAt > 0 ? firstByteAt - startedAt : 0,
            elapsedMs,
            costEstUsd: estCost(col.config.model, tokensInEst, tokensOut),
          },
        });
      }
    },
  });

  patchColumn(columnId, { handle });

  try {
    const finalMsg = await handle.done;
    const finalText = typeof finalMsg.content === 'string' ? finalMsg.content : accText;
    const elapsedMs = Date.now() - startedAt;
    const tokensOut = estTokens(finalText);
    const tokensPerSec = elapsedMs > 0 ? (tokensOut * 1000) / elapsedMs : 0;
    const nextMessages = col.messages.concat(
      { role: 'user', content: prompt },
      { role: 'assistant', content: finalText },
    );
    patchColumn(columnId, {
      streaming: false,
      streamedText: '',
      messages: nextMessages,
      handle: null,
      stats: {
        tokensIn: tokensInEst,
        tokensOut,
        tokensPerSec,
        ttftMs: firstByteAt > 0 ? firstByteAt - startedAt : 0,
        elapsedMs,
        costEstUsd: estCost(col.config.model, tokensInEst, tokensOut),
      },
    });
  } catch (err: any) {
    patchColumn(columnId, {
      streaming: false, streamedText: '', handle: null,
      error: (err && err.message) ? err.message : String(err),
    });
  }
}

export function fanOut(prompt: string) {
  const session = getSession();
  if (!prompt || prompt.trim().length === 0 || session.columns.length === 0) return;
  const sys = session.systemPromptEnabled && session.systemPrompt.trim()
    ? session.systemPrompt
    : null;
  // Fire all column runs in parallel. Each manages its own stream + state.
  for (const col of session.columns) { void runOne(col.id, prompt, sys); }
  emit();
}

export function stopAll() {
  const session = getSession();
  for (const col of session.columns) {
    if (col.handle) { try { col.handle.stop(); } catch {} }
    if (col.streaming) {
      patchColumn(col.id, { streaming: false, streamedText: '', handle: null });
    }
  }
}

export function regenerateColumn(columnId: string) {
  const session = getSession();
  const col = session.columns.find((c) => c.id === columnId);
  if (!col) return;
  // Pop the last user+assistant pair if present; replay the user prompt.
  const history = col.messages.slice();
  let prompt = '';
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      prompt = typeof history[i].content === 'string' ? history[i].content as string : '';
      // Trim from this user message onward so the replay appends fresh.
      patchColumn(columnId, { messages: history.slice(0, i) });
      break;
    }
  }
  if (!prompt) return;
  const sys = session.systemPromptEnabled && session.systemPrompt.trim()
    ? session.systemPrompt
    : null;
  void runOne(columnId, prompt, sys);
}

export function useFanOut() {
  useLlmStudioSession(); // subscribe so consumer re-renders on session change
  return { fanOut, stopAll, regenerateColumn };
}
