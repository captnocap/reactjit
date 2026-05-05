
import type { CompletionOptions, CompletionResult } from '../../lib/ai/types';
import { streamChat, type StreamHandle } from '../../lib/ai/stream';
import { getKeyForProvider } from '../../lib/ai/keys';

// Single-shot completion. Sends one user message and returns the
// assembled assistant reply. Streams by default; set no options to get
// the accumulated final string out of `completion`.

export function useCompletion(opts: CompletionOptions = {} as any): CompletionResult {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<StreamHandle | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) streamRef.current.stop();
    streamRef.current = null;
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  const complete = useCallback(async (prompt: string): Promise<string> => {
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setCompletion('');

    const provider = opts.provider || 'openai';
    const storedKey = getKeyForProvider(provider);
    const config: any = {
      provider,
      model: opts.model || storedKey?.models?.[0] || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini'),
      apiKey: opts.apiKey || storedKey?.apiKey,
      baseURL: opts.baseURL || storedKey?.baseURL,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    };

    const messages: any[] = [];
    if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
    messages.push({ role: 'user', content: prompt });

    let accumulated = '';
    try {
      const handle = streamChat(config, messages, {
        onDelta: (d) => {
          if (d.content) {
            accumulated += d.content;
            setCompletion(accumulated);
            if (opts.onChunk) opts.onChunk(d.content);
          }
        },
      });
      streamRef.current = handle;
      const final = await handle.done;
      streamRef.current = null;
      const text = typeof final.content === 'string' ? final.content : accumulated;
      setCompletion(text);
      return text;
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      if (opts.onError) opts.onError(err);
      throw err;
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      streamRef.current = null;
    }
  }, [opts]);

  return { completion, complete, isLoading, isStreaming, stop, error };
}
