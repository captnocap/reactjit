/**
 * useLocalChat — local chat generation, backed by framework/local_ai_runtime.zig.
 *
 * Mirrors the shape of useEmbed: a single shared model loaded into VRAM at
 * mount, freed on unmount. Generation runs through the same libllama_ffi.so
 * the embed pipeline uses; n_gpu_layers defaults to 99 in the Zig runtime so
 * the model lands on the GPU without any cart-side knob.
 *
 *   const { phase, lastStatus, ask } = useLocalChat({
 *     model: '/path/to/model.gguf',
 *   });
 *
 *   const reply = await ask('does line 5 say "import heapq"?');
 *
 * Lifecycle phases the cart can render:
 *   'init'        — not even started (host bindings missing or pre-mount)
 *   'loading'     — Zig session created; model is being read into VRAM
 *   'loaded'      — first 'system' event fired; ready for ask()
 *   'generating'  — currently inside an ask(), receiving assistant_part events
 *   'idle'        — generation done; sitting waiting for next ask()
 *
 * `lastStatus` mirrors the most recent 'system' or 'status' event text from
 * the runtime (e.g. "loaded model" / "tokenizing" / "decoding"). `pulse`
 * increments every poll tick so the UI can show a heartbeat dot to prove
 * the loop is running, even when no ask is in flight.
 *
 * Host bindings (registered unconditionally in v8_bindings_sdk.zig):
 *   __localai_init(cwd, modelPath, sessionId?) → bool
 *   __localai_send(text) → bool
 *   __localai_poll() → { kind, text?, is_error, ... } | undefined
 *   __localai_close() → void
 */

import { useEffect, useRef, useState } from 'react';
import { callHost, hasHost } from '../ffi';

export type LocalChatPhase = 'init' | 'loading' | 'loaded' | 'generating' | 'idle' | 'failed';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, any>; required?: string[] };
  execute: (args: any) => any | Promise<any>;
}

export interface UseLocalChatOpts {
  model: string;
  sessionId?: string;
  cwd?: string;
  /** Context window size in tokens. Default 2048. Smaller = less KV-cache VRAM. */
  nCtx?: number;
  /** Background poll interval (ms) for load-progress + heartbeat. Default 100. */
  pollMs?: number;
  /** When true, leaves the session alive across cart unmount (dev hot-reload
   *  friendly — avoids re-loading the model on every edit). Default true. */
  persistAcrossUnmount?: boolean;
  /** Tool schemas + executors. Re-registers automatically when the array
   *  identity changes — so cart code that builds the array inside the
   *  component should useMemo it. Tools persist across asks until cleared. */
  tools?: ToolDefinition[];
}

export interface AskOpts {
  pollMs?: number;
  timeoutMs?: number;
}

export interface ToolCallEvent {
  id: string;
  name: string;
  args: any;
}

export function useLocalChat(opts: UseLocalChatOpts) {
  const [phase, setPhase] = useState<LocalChatPhase>('init');
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string>('');
  const [pulse, setPulse] = useState<number>(0);
  const [streaming, setStreaming] = useState<string>('');

  const initRef = useRef(false);
  const phaseRef = useRef<LocalChatPhase>('init');
  const askBufRef = useRef<{ buf: string; resolve: ((s: string) => void) | null; reject: ((e: any) => void) | null }>({
    buf: '',
    resolve: null,
    reject: null,
  });
  // Live tool registry — kept on a ref so the poll loop sees the latest
  // executors without resubscribing every render. Synced with opts.tools
  // via the useEffect below.
  const toolsRef = useRef<Record<string, ToolDefinition>>({});
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);

  useEffect(() => {
    if (initRef.current) return;
    // Empty model = inert. Lets useAssistantChat always call this hook
    // unconditionally and only spawn the worker when local-runtime is
    // the picked connection (rules of hooks: can't conditionally call).
    if (!opts.model || opts.model.length === 0) return;
    if (!hasHost('__localai_init')) {
      setError('local_ai host bindings not registered (framework/v8_bindings_sdk.zig)');
      return;
    }
    const cwd = opts.cwd ?? '';
    const sid = opts.sessionId ?? '';
    const nCtx = opts.nCtx ?? 2048;
    const ok = callHost<boolean>('__localai_init', false, cwd, opts.model, sid, nCtx);
    if (!ok) {
      setError('local_ai init returned false (model path or session)');
      return;
    }
    initRef.current = true;
    phaseRef.current = 'loading';
    setPhase('loading');

    // Background poll loop: drains every event, advances phase, surfaces
    // status text, increments pulse for the UI heartbeat.
    const interval = opts.pollMs ?? 100;
    const id = setInterval(() => {
      setPulse((p) => p + 1);
      while (true) {
        const evt = callHost<any>('__localai_poll', undefined);
        if (!evt) break;
        const ab = askBufRef.current;
        if (evt.is_error) {
          if (ab.reject) {
            ab.reject(new Error(`localai error: ${evt.text || '<no message>'}`));
            askBufRef.current = { buf: '', resolve: null, reject: null };
          }
          if (typeof evt.text === 'string') {
            setLastStatus(`error: ${evt.text}`);
            setError(evt.text);
          }
          // If we hit an error before the model finished loading, the session
          // is dead — go to 'failed' rather than pretending we're 'loaded'.
          // If the error came after a successful load (mid-generation), drop
          // back to idle so the next ask can try again.
          if (phaseRef.current === 'loading' || phaseRef.current === 'init') {
            phaseRef.current = 'failed';
            setPhase('failed');
          } else {
            phaseRef.current = 'idle';
            setPhase('idle');
          }
          continue;
        }
        if (evt.kind === 'system' || evt.kind === 'status') {
          if (typeof evt.text === 'string' && evt.text.length > 0) {
            setLastStatus(evt.text);
          }
          if (phaseRef.current === 'loading') {
            phaseRef.current = 'loaded';
            setPhase('loaded');
          }
        } else if (evt.kind === 'assistant_part') {
          if (typeof evt.text === 'string' && evt.text.length > 0) {
            ab.buf += evt.text;
            setStreaming(ab.buf);
          }
          if (phaseRef.current !== 'generating') {
            phaseRef.current = 'generating';
            setPhase('generating');
          }
        } else if (evt.kind === 'tool_call') {
          // Worker has paused generation waiting for our reply. Run the
          // registered handler async — fire-and-forget; when it resolves
          // we ship the result back via __localai_send_tool_result and
          // the worker resumes streaming TOK lines.
          const id   = String(evt.id || '');
          const name = String(evt.name || '');
          let parsedArgs: any = {};
          try { parsedArgs = evt.args ? JSON.parse(evt.args) : {}; } catch { parsedArgs = { _raw: evt.args }; }
          setToolCalls((prev) => [...prev, { id, name, args: parsedArgs }]);

          const handler = toolsRef.current[name];
          const replyResult = (val: any) => {
            const body = (() => {
              if (typeof val === 'string') return val;
              try { return JSON.stringify(val); } catch { return String(val); }
            })();
            callHost<boolean>('__localai_send_tool_result', false, id, body);
          };
          const replyError = (err: any) => {
            replyResult({ error: err instanceof Error ? err.message : String(err) });
          };

          if (!handler) {
            replyError(`unknown tool: ${name}`);
          } else {
            try {
              const r = handler.execute(parsedArgs);
              if (r && typeof (r as any).then === 'function') {
                (r as Promise<any>).then(replyResult, replyError);
              } else {
                replyResult(r);
              }
            } catch (e: any) {
              replyError(e);
            }
          }
        } else if (evt.kind === 'result') {
          const out = typeof evt.text === 'string' && evt.text.length > 0 ? evt.text : ab.buf;
          if (ab.resolve) {
            ab.resolve(out);
          }
          askBufRef.current = { buf: '', resolve: null, reject: null };
          setStreaming('');
          phaseRef.current = 'idle';
          setPhase('idle');
        }
      }
    }, interval);

    return () => {
      clearInterval(id);
      // Always close on cleanup — the only thing that triggers cleanup
      // here is `opts.model` changing, in which case we MUST tear down
      // the session bound to the old model so the new one can load.
      // (The previous persistAcrossUnmount opt-out had no effect for
      // model swaps and just left the cart wedged on the old session.)
      callHost<void>('__localai_close', undefined as any);
      initRef.current = false;
      phaseRef.current = 'init';
      setPhase('init');
      setLastStatus('');
      setStreaming('');
      setError(null);
    };
  }, [opts.model]);

  // Sync the tool registry + push schemas into the worker whenever the
  // opts.tools array identity changes. The worker holds the schemas
  // sticky across asks until next set_tools or close.
  useEffect(() => {
    const map: Record<string, ToolDefinition> = {};
    if (opts.tools) for (const t of opts.tools) map[t.name] = t;
    toolsRef.current = map;
    if (!hasHost('__localai_set_tools')) return;
    if (!opts.tools || opts.tools.length === 0) {
      callHost<boolean>('__localai_set_tools', false, '[]');
      return;
    }
    const schema = opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    callHost<boolean>('__localai_set_tools', false, JSON.stringify(schema));
  }, [opts.tools]);

  function ask(text: string, _askOpts: AskOpts = {}): Promise<string> {
    if (!hasHost('__localai_send')) {
      return Promise.reject(new Error('localai_send not registered'));
    }
    if (askBufRef.current.resolve !== null) {
      return Promise.reject(new Error('ask() already in flight; await the previous one first'));
    }
    return new Promise<string>((resolve, reject) => {
      askBufRef.current = { buf: '', resolve, reject };
      setStreaming('');
      const sent = callHost<boolean>('__localai_send', false, text);
      if (!sent) {
        askBufRef.current = { buf: '', resolve: null, reject: null };
        reject(new Error('localai_send returned false (model still loading?)'));
        return;
      }
      phaseRef.current = 'generating';
      setPhase('generating');
    });
  }

  function isAvailable(): boolean {
    return hasHost('__localai_init');
  }

  return {
    phase,
    error,
    lastStatus,
    pulse,
    streaming,
    ask,
    isAvailable,
    /** Tool calls observed during the most recent / current ask. Reset
     *  here is the cart's responsibility (use clearToolCalls). */
    toolCalls,
    clearToolCalls: () => setToolCalls([]),
    /** Convenience: ready === phase past 'loading' and not erroring. */
    ready: phase === 'loaded' || phase === 'generating' || phase === 'idle',
  };
}
