/**
 * Core AI hooks: useChat, useCompletion, useModels.
 *
 * useChat handles conversational AI with streaming, message history,
 * and full agentic tool execution loops.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  AIConfig, AIProviderType, Message, ToolCall, StreamDelta,
  ChatOptions, ChatResult, CompletionOptions, CompletionResult,
  ModelsResult, ModelInfo, ProviderModule,
} from './types';
import { useAIConfig } from './context';
import { SSEParser, startStream } from './stream';
import { openai } from './providers/openai';
import { anthropic } from './providers/anthropic';
import { executeToolCalls, formatToolResults, shouldContinueLoop } from './tools';

// ── Provider registry ───────────────────────────────────

export function getProvider(providerType: AIProviderType): ProviderModule {
  switch (providerType) {
    case 'openai': return openai;
    case 'anthropic': return anthropic;
    case 'custom': return openai; // custom uses OpenAI-compatible format by default
    default: return openai;
  }
}

function resolveConfig(options: Partial<AIConfig>, contextConfig: AIConfig | null): AIConfig {
  const base = contextConfig || { provider: 'openai' as const, model: 'gpt-4' };
  return { ...base, ...options } as AIConfig;
}

// ── useChat ─────────────────────────────────────────────

/**
 * Conversational AI with streaming and tool execution.
 *
 * @example
 * // Simple chat
 * const { messages, send } = useChat({ model: 'gpt-4' });
 * await send('Hello!');
 *
 * @example
 * // Agent with tools
 * const { messages, send } = useChat({
 *   model: 'gpt-4',
 *   tools: [{ name: 'calc', description: '...', parameters: {}, execute: async (args) => eval(args.expr) }],
 * });
 */
export function useChat(options: ChatOptions = {}): ChatResult {
  const contextConfig = useAIConfig();
  const config = resolveConfig(options, contextConfig);
  const provider = getProvider(config.provider);

  const [messages, setMessages] = useState<Message[]>(options.initialMessages || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  /**
   * Run a single LLM call with streaming. Returns the complete assistant message.
   */
  const streamRound = useCallback((
    roundMessages: Message[],
    onAssistantUpdate: (partial: Message) => void,
  ): Promise<Message> => {
    return new Promise((resolve, reject) => {
      const req = provider.formatRequest(roundMessages, config, optionsRef.current.tools, true);
      const parser = new SSEParser();

      let content = '';
      const toolCalls: ToolCall[] = [];
      const pendingToolCalls: Map<number, Partial<ToolCall>> = new Map();

      startStream(
        req.url,
        { method: req.method, headers: req.headers, body: req.body, proxy: config.proxy },
        // onChunk
        (chunk: string) => {
          if (abortRef.current) return;

          const events = parser.feed(chunk);
          for (const evt of events) {
            const delta = provider.parseStreamChunk(evt.data, evt.event);
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
              if (optionsRef.current.onChunk) optionsRef.current.onChunk(delta.content);
              onAssistantUpdate({ role: 'assistant', content, toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined });
            }

            if (delta.toolCalls) {
              for (const tc of delta.toolCalls) {
                if (tc.id) {
                  // New tool call or complete tool call
                  const existing = [...pendingToolCalls.values()].find(p => p.id === tc.id);
                  if (existing) {
                    if (tc.arguments) existing.arguments = (existing.arguments || '') + tc.arguments;
                    if (tc.name) existing.name = tc.name;
                  } else {
                    const idx = pendingToolCalls.size;
                    pendingToolCalls.set(idx, { id: tc.id, name: tc.name || '', arguments: tc.arguments || '' });
                  }

                  // Check if this is a complete tool call (has id, name, and arguments)
                  const full = pendingToolCalls.get([...pendingToolCalls.keys()].find(k => pendingToolCalls.get(k)?.id === tc.id)!);
                  if (full && full.id && full.name && full.arguments) {
                    const complete: ToolCall = { id: full.id, name: full.name, arguments: full.arguments };
                    if (!toolCalls.find(t => t.id === complete.id)) {
                      toolCalls.push(complete);
                      if (optionsRef.current.onToolCall) optionsRef.current.onToolCall(complete);
                    }
                  }
                } else if (tc.arguments) {
                  // Incremental arguments for the last pending tool call
                  const lastKey = [...pendingToolCalls.keys()].pop();
                  if (lastKey != null) {
                    const pending = pendingToolCalls.get(lastKey)!;
                    pending.arguments = (pending.arguments || '') + tc.arguments;
                  }
                }
              }
            }
          }
        },
        // onDone
        (_status: number) => {
          // Finalize any pending tool calls
          for (const [, pending] of pendingToolCalls) {
            if (pending.id && pending.name && !toolCalls.find(t => t.id === pending.id)) {
              toolCalls.push({ id: pending.id, name: pending.name, arguments: pending.arguments || '{}' });
            }
          }

          const msg: Message = {
            role: 'assistant',
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          };
          resolve(msg);
        },
        // onError
        (err: string) => {
          reject(new Error(err));
        },
      );
    });
  }, [provider, config]);

  const send = useCallback(async (content: string) => {
    if (isLoading) return;

    abortRef.current = false;
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);

    // Append user message
    const userMessage: Message = { role: 'user', content };
    const withSystem = config.systemPrompt
      ? [{ role: 'system' as const, content: config.systemPrompt }, ...messagesRef.current]
      : messagesRef.current;
    let roundMessages = [...withSystem, userMessage];

    setMessages(prev => [...prev, userMessage]);

    try {
      let round = 0;
      const maxRounds = optionsRef.current.maxToolRounds ?? 10;

      while (!abortRef.current) {
        // Stream one LLM round
        let assistantPlaceholderIdx = -1;

        const assistantMsg = await streamRound(
          roundMessages,
          (partial) => {
            setMessages(prev => {
              const next = [...prev];
              if (assistantPlaceholderIdx === -1) {
                assistantPlaceholderIdx = next.length;
                next.push(partial);
              } else {
                next[assistantPlaceholderIdx] = partial;
              }
              return next;
            });
          },
        );

        // Finalize assistant message
        setMessages(prev => {
          const next = [...prev];
          if (assistantPlaceholderIdx >= 0 && assistantPlaceholderIdx < next.length) {
            next[assistantPlaceholderIdx] = assistantMsg;
          } else {
            next.push(assistantMsg);
          }
          return next;
        });

        roundMessages = [...roundMessages, assistantMsg];
        round++;

        // Check if we need to execute tools
        if (!shouldContinueLoop(assistantMsg, round, maxRounds) || !optionsRef.current.tools) {
          break;
        }

        // Execute tool calls
        setIsStreaming(false);
        const results = await executeToolCalls(assistantMsg.toolCalls!, optionsRef.current.tools);
        const toolMessages = formatToolResults(provider, results);

        // Append tool results to messages
        setMessages(prev => [...prev, ...toolMessages]);
        roundMessages = [...roundMessages, ...toolMessages];

        // Continue to next round (model sees tool results)
        setIsStreaming(true);
        assistantPlaceholderIdx = -1;
      }
    } catch (err: any) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      if (optionsRef.current.onError) optionsRef.current.onError(e);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, config, streamRound, provider]);

  return { messages, send, isLoading, isStreaming, stop, error, setMessages };
}

// ── useCompletion ───────────────────────────────────────

/**
 * Single-shot text completion with streaming.
 *
 * @example
 * const { completion, complete } = useCompletion({ model: 'gpt-4' });
 * const result = await complete('Write a haiku about React');
 */
export function useCompletion(options: CompletionOptions = {}): CompletionResult {
  const contextConfig = useAIConfig();
  const config = resolveConfig(options, contextConfig);
  const provider = getProvider(config.provider);

  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  const complete = useCallback(async (prompt: string): Promise<string> => {
    abortRef.current = false;
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    setCompletion('');

    const messages: Message[] = [];
    if (config.systemPrompt) {
      messages.push({ role: 'system', content: config.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return new Promise((resolve, reject) => {
      const req = provider.formatRequest(messages, config, undefined, true);
      const parser = new SSEParser();
      let result = '';

      startStream(
        req.url,
        { method: req.method, headers: req.headers, body: req.body, proxy: config.proxy },
        (chunk: string) => {
          if (abortRef.current) return;
          const events = parser.feed(chunk);
          for (const evt of events) {
            const delta = provider.parseStreamChunk(evt.data, evt.event);
            if (delta?.content) {
              result += delta.content;
              setCompletion(result);
              if (optionsRef.current.onChunk) optionsRef.current.onChunk(delta.content);
            }
          }
        },
        () => {
          setIsLoading(false);
          setIsStreaming(false);
          resolve(result);
        },
        (err: string) => {
          const e = new Error(err);
          setError(e);
          setIsLoading(false);
          setIsStreaming(false);
          if (optionsRef.current.onError) optionsRef.current.onError(e);
          reject(e);
        },
      );
    });
  }, [config, provider]);

  return { completion, complete, isLoading, isStreaming, stop, error };
}

// ── useModels ───────────────────────────────────────────

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
];

/**
 * Fetch available models from the provider.
 *
 * @example
 * const { models, loading } = useModels({ provider: 'openai', apiKey: 'sk-...' });
 */
export function useModels(options: Partial<AIConfig> = {}): ModelsResult {
  const contextConfig = useAIConfig();
  const config = resolveConfig(options, contextConfig);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (config.provider === 'anthropic') {
        // Anthropic doesn't have a models list endpoint
        setModels(ANTHROPIC_MODELS);
      } else {
        // OpenAI-compatible: GET /v1/models
        const baseURL = (config.baseURL || 'https://api.openai.com').replace(/\/$/, '');
        const res = await fetch(`${baseURL}/v1/models`, {
          headers: { 'authorization': `Bearer ${config.apiKey || ''}` },
        } as any);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const list: ModelInfo[] = (json.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: config.provider,
        }));

        // Sort by name
        list.sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
        setModels(list);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [config.provider, config.baseURL, config.apiKey, version]);

  // Auto-fetch when config changes
  useState(() => { fetchModels(); });

  const refetch = useCallback(() => {
    setVersion(v => v + 1);
    fetchModels();
  }, [fetchModels]);

  return { models, loading, error, refetch };
}
