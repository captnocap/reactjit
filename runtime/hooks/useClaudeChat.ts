/**
 * useClaudeChat — Claude session-backed chat hook.
 *
 * Mirrors useLocalChat's public shape so the call sites are interchangeable
 * — `useAssistantChat` in cart/app/chat/ branches on Connection.kind and
 * picks one or the other.
 *
 *   const { phase, lastStatus, ask } = useClaudeChat({
 *     model: 'claude-opus-4-7',
 *     configDir: '~/.claude/',  // for claude-code-cli connections
 *   });
 *
 *   const reply = await ask('say hi in five words', {
 *     onPart: (partial) => updateTurnBody(turnId, partial),
 *   });
 *
 * Lifecycle phases the cart can render:
 *   'init'        — pre-mount or host bindings missing
 *   'loading'     — __claude_init returned true; waiting for first 'system' event
 *   'loaded'      — session is ready (first 'system' event arrived)
 *   'generating'  — inside an ask(), receiving 'assistant' chunks
 *   'idle'        — last ask resolved; ready for the next
 *   'failed'      — init returned false or an unrecoverable error came back
 *
 * `streaming` holds the accumulated assistant text for the in-flight ask;
 * `pulse` increments every poll tick (heartbeat). `lastStatus` mirrors the
 * most recent informational status (model name from the system event).
 *
 * Concurrency note: the Zig session is a single global (g_claude_session
 * in framework/v8_bindings_sdk.zig). One ask at a time — the second call
 * rejects with "ask already in flight" until the first resolves.
 *
 * Host bindings (registered in v8_bindings_sdk.zig:1713+):
 *   __claude_init(cwd, model?, resumeSession?, configDir?) → bool
 *   __claude_send(text) → bool
 *   __claude_poll() → { type, ... } | undefined
 *   __claude_close() → void
 *
 * Poll message shapes (v8_bindings_sdk.zig:277+):
 *   { type: 'system',    session_id, model, cwd, tools[] }
 *   { type: 'assistant', text, thinking?, content[], stop_reason, ... }
 *   { type: 'user',      session_id, content_json }
 *   { type: 'result',    subtype, session_id, result, is_error, ... }
 */

import { useEffect, useRef, useState } from 'react';
import { callHost, hasHost } from '../ffi';

export type ClaudeChatPhase = 'init' | 'loading' | 'loaded' | 'generating' | 'idle' | 'failed';

export interface UseClaudeChatOpts {
  cwd?: string;
  model?: string;
  resumeSession?: string;
  configDir?: string;
  pollMs?: number;
  /** When true (default), leaves the Zig session alive across cart unmount
   *  so dev hot-reload doesn't drop the subprocess. */
  persistAcrossUnmount?: boolean;
}

export interface ClaudeAskOpts {
  onPart?: (partial: string) => void;
}

export function useClaudeChat(opts: UseClaudeChatOpts = {}) {
  const [phase, setPhase] = useState<ClaudeChatPhase>('init');
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string>('');
  const [pulse, setPulse] = useState<number>(0);
  const [streaming, setStreaming] = useState<string>('');

  const initRef = useRef(false);
  const phaseRef = useRef<ClaudeChatPhase>('init');
  const askBufRef = useRef<{
    buf: string;
    resolve: ((s: string) => void) | null;
    reject: ((e: any) => void) | null;
    onPart: ((s: string) => void) | null;
  }>({ buf: '', resolve: null, reject: null, onPart: null });
  // A send queued before the session reached 'loaded' — the SDK's
  // claude_send fails (returns false) if the CLI subprocess hasn't yet
  // accepted stdin, which happens for the first ~half-second after
  // __claude_init. We hold the request here and dispatch it from the
  // poll loop on the system→loaded transition.
  const pendingRef = useRef<{
    text: string;
    resolve: (s: string) => void;
    reject: (e: any) => void;
    onPart: ((s: string) => void) | null;
  } | null>(null);

  useEffect(() => {
    // First time only: spawn the session. Subsequent re-runs (when opts
    // re-resolve as Settings/Connection load asynchronously) skip the
    // init block but MUST still re-arm the poll interval — the previous
    // run's cleanup cleared it. Without this, the session is alive but
    // events are never drained and phase stays at 'loading' forever.
    if (!initRef.current) {
      if (!hasHost('__claude_init')) {
        setError('claude host bindings not registered (framework/v8_bindings_sdk.zig)');
        phaseRef.current = 'failed';
        setPhase('failed');
        return;
      }
      const cwd = opts.cwd ?? '';
      const model = opts.model ?? 'claude-opus-4-7';
      const sid = opts.resumeSession ?? '';
      const cfg = opts.configDir ?? '';
      const ok = callHost<boolean>('__claude_init', false, cwd, model, sid, cfg);
      if (!ok) {
        setError('claude_init returned false (cwd / config / spawn failure)');
        phaseRef.current = 'failed';
        setPhase('failed');
        return;
      }
      initRef.current = true;
      phaseRef.current = 'loading';
      setPhase('loading');
    }

    const interval = opts.pollMs ?? 100;
    const id = setInterval(() => {
      setPulse((p) => p + 1);
      while (true) {
        const evt = callHost<any>('__claude_poll', undefined);
        if (!evt) break;
        const ab = askBufRef.current;
        if (evt.type === 'system') {
          if (typeof evt.model === 'string') {
            setLastStatus(`session: ${evt.model}`);
          }
          if (phaseRef.current === 'loading' || phaseRef.current === 'init') {
            phaseRef.current = 'loaded';
            setPhase('loaded');
            // Session is hot — drain any send queued during loading.
            if (pendingRef.current) {
              const p = pendingRef.current;
              pendingRef.current = null;
              askBufRef.current = { buf: '', resolve: p.resolve, reject: p.reject, onPart: p.onPart };
              setStreaming('');
              const sent = callHost<boolean>('__claude_send', false, p.text);
              if (!sent) {
                askBufRef.current = { buf: '', resolve: null, reject: null, onPart: null };
                p.reject(new Error('claude_send returned false (post-load)'));
              } else {
                phaseRef.current = 'generating';
                setPhase('generating');
              }
            }
          }
        } else if (evt.type === 'assistant') {
          if (typeof evt.text === 'string' && evt.text.length > 0) {
            ab.buf += evt.text;
            setStreaming(ab.buf);
            if (ab.onPart) ab.onPart(ab.buf);
          }
          if (phaseRef.current !== 'generating') {
            phaseRef.current = 'generating';
            setPhase('generating');
          }
        } else if (evt.type === 'result') {
          const out = ab.buf.length > 0
            ? ab.buf
            : (typeof evt.result === 'string' ? evt.result : '');
          if (evt.is_error) {
            const errMsg = typeof evt.result === 'string' && evt.result.length > 0
              ? evt.result
              : 'claude returned is_error=true';
            if (ab.reject) ab.reject(new Error(errMsg));
            setError(errMsg);
          } else if (ab.resolve) {
            ab.resolve(out);
          }
          askBufRef.current = { buf: '', resolve: null, reject: null, onPart: null };
          setStreaming('');
          phaseRef.current = 'idle';
          setPhase('idle');
        }
        // 'user' echo messages and any other types we don't yet model are
        // intentionally dropped — they don't affect transcript state.
      }
    }, interval);

    return () => {
      clearInterval(id);
      if (!(opts.persistAcrossUnmount ?? true)) {
        callHost<void>('__claude_close', undefined as any);
        initRef.current = false;
        phaseRef.current = 'init';
      }
    };
  }, [opts.cwd, opts.model, opts.resumeSession, opts.configDir]);

  function ask(text: string, askOpts: ClaudeAskOpts = {}): Promise<string> {
    if (!hasHost('__claude_send')) {
      return Promise.reject(new Error('claude_send not registered'));
    }
    if (askBufRef.current.resolve !== null) {
      return Promise.reject(new Error('claude: ask() already in flight; await the previous one'));
    }
    if (pendingRef.current !== null) {
      return Promise.reject(new Error('claude: a previous send is queued; await it first'));
    }
    if (phaseRef.current === 'failed') {
      return Promise.reject(new Error('claude: session failed'));
    }
    return new Promise<string>((resolve, reject) => {
      const onPart = askOpts.onPart ?? null;
      // If the session hasn't reached 'loaded' yet, queue the send and
      // dispatch on the system→loaded transition (poll loop handles
      // that). Without this, the SDK's send() throws because the CLI
      // subprocess hasn't accepted stdin yet.
      if (phaseRef.current === 'init' || phaseRef.current === 'loading') {
        pendingRef.current = { text, resolve, reject, onPart };
        return;
      }
      askBufRef.current = { buf: '', resolve, reject, onPart };
      setStreaming('');
      const sent = callHost<boolean>('__claude_send', false, text);
      if (!sent) {
        askBufRef.current = { buf: '', resolve: null, reject: null, onPart: null };
        reject(new Error('claude_send returned false (session not ready?)'));
        return;
      }
      phaseRef.current = 'generating';
      setPhase('generating');
    });
  }

  function isAvailable(): boolean {
    return hasHost('__claude_init');
  }

  return {
    phase,
    error,
    lastStatus,
    pulse,
    streaming,
    ask,
    isAvailable,
    ready: phase === 'loaded' || phase === 'generating' || phase === 'idle',
  };
}
