
import type { ChatOptions, ChatResult, Message, ToolCall, ToolDefinition } from '../../lib/ai/types';
import { streamChat, type StreamHandle } from '../../lib/ai/stream';
import { callProvider } from '../../lib/ai/providers';
import { executeToolCall } from '../../lib/ai/tools';
import { getKeyForProvider } from '../../lib/ai/keys';

// Full chat loop with streaming + tool round-tripping. The model can
// call tools; we execute them, append the results, and let the model
// respond. Capped by `maxToolRounds` (default 10).

function resolveConfig(opts: ChatOptions) {
  const provider = opts.provider || 'openai';
  const key = getKeyForProvider(provider);
  return {
    provider,
    model: opts.model || key?.models?.[0] || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini'),
    apiKey: opts.apiKey || key?.apiKey,
    baseURL: opts.baseURL || key?.baseURL,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    systemPrompt: opts.systemPrompt,
  };
}

export function useChat(opts: ChatOptions = { provider: 'openai', model: '' } as any): ChatResult {
  const [messages, setMessages] = useState<Message[]>(opts.initialMessages || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<StreamHandle | null>(null);
  const tools: ToolDefinition[] | undefined = opts.tools;
  const maxRounds = opts.maxToolRounds ?? 10;

  const stop = useCallback(() => {
    if (streamRef.current) streamRef.current.stop();
    streamRef.current = null;
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  const send = useCallback(async (content: string) => {
    setError(null);
    const config = resolveConfig(opts);
    const systemMsg: Message[] = config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : [];
    const baseHistory = systemMsg.concat(messages).concat({ role: 'user', content });
    setMessages((prev: Message[]) => prev.concat({ role: 'user', content }));
    setIsLoading(true);

    let working = baseHistory;
    try {
      for (let round = 0; round < maxRounds; round++) {
        setIsStreaming(true);
        const handle = streamChat(config as any, working, {
          tools,
          onDelta: (d) => {
            if (d.content && opts.onChunk) opts.onChunk(d.content);
          },
        });
        streamRef.current = handle;
        const finalMsg = await handle.done;
        streamRef.current = null;
        setIsStreaming(false);

        working = working.concat(finalMsg);
        setMessages((prev: Message[]) => prev.concat(finalMsg));

        const calls: ToolCall[] = finalMsg.toolCalls || [];
        if (!calls.length) break;

        for (const call of calls) {
          if (opts.onToolCall) opts.onToolCall(call);
          const result = await executeToolCall(call);
          const toolMsg: Message = { role: 'tool', toolCallId: call.id, content: result.ok ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result)) : ('error: ' + result.error) };
          working = working.concat(toolMsg);
          setMessages((prev: Message[]) => prev.concat(toolMsg));
        }
      }
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      if (opts.onError) opts.onError(err);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      streamRef.current = null;
    }
  }, [messages, opts, tools, maxRounds]);

  // Fallback non-streaming path (currently unused; streaming is default).
  const _nonStream = useCallback(async () => {
    return callProvider(resolveConfig(opts) as any, messages, tools);
  }, [messages, opts, tools]);

  return { messages, send, isLoading, isStreaming, stop, error, setMessages };
}
