import type { AIConfig, Message, StreamDelta, ToolCall, ToolDefinition } from './types';
import { getProvider } from './providers';
import { requestAsync } from '../../../../runtime/hooks/http';

// Chat request + streaming-shaped callback contract.
//
// HOST-FN GAP (honest, not a workaround):
//   True token-by-token SSE streaming requires a host fn that emits
//   chunk events as the wire body arrives (e.g. __http_stream_async +
//   __ffiEmit('http-chunk:<reqId>', data)). The current host exposes
//   __http_request_async only — one-shot: full body, then response.
//   Until a streaming host fn lands, this module:
//     1. Forces `stream:false` on the provider request.
//     2. Makes one blocking requestAsync call.
//     3. Emits the final assembled Message as a single onDelta({done:true, …}).
//   The ChatUI surface already handles this gracefully — the streaming
//   cursor simply never blinks. No fake chunks are emitted.

export type StreamHandle = {
  stop: () => void;
  done: Promise<Message>;
};

export function streamingSupported(): boolean {
  // Swap to true once __http_stream_async (or equivalent) is registered.
  return false;
}

export function streamChat(
  config: AIConfig,
  messages: Message[],
  opts: {
    tools?: ToolDefinition[];
    onDelta?: (delta: StreamDelta) => void;
  },
): StreamHandle {
  const provider = getProvider(config.provider);
  const req = provider.formatRequest(messages, config, opts.tools, false);

  let cancelled = false;
  let resolve!: (m: Message) => void;
  let reject!: (e: any) => void;
  const done = new Promise<Message>((res, rej) => { resolve = res; reject = rej; });

  (async () => {
    try {
      const res = await requestAsync({ method: req.method as any, url: req.url, headers: req.headers, body: req.body });
      if (cancelled) { reject(new Error('cancelled')); return; }
      if (res.error) throw new Error('http: ' + res.error);
      if (res.status < 200 || res.status >= 300) throw new Error('HTTP ' + res.status + ' ' + String(res.body || '').slice(0, 200));

      let json: any = {};
      try { json = JSON.parse(res.body || '{}'); } catch { throw new Error('bad JSON response'); }
      const finalMsg = provider.parseResponse(json);

      // Synthetic single delta so the surface's onDelta pipeline still fires.
      if (opts.onDelta) {
        const content = typeof finalMsg.content === 'string' ? finalMsg.content : '';
        opts.onDelta({ content, toolCalls: finalMsg.toolCalls as any, done: true });
      }
      resolve(finalMsg);
    } catch (err) {
      reject(err);
    }
  })();

  return {
    // TODO(host-fn): true cancellation needs an `__http_cancel` host fn.
    // Until then this marks intent locally; the in-flight request still
    // completes server-side.
    stop: () => { cancelled = true; },
    done,
  };
}

// Helper exports retained so future SSE-capable streamChat keeps the
// same surface. Deliberately unused at runtime in the no-streaming
// fallback — re-wired when the host ships chunked delivery.
export function mergeToolCallDelta(acc: ToolCall[], deltas: Partial<ToolCall>[]): ToolCall[] {
  const out = acc.slice();
  for (const d of deltas) {
    let idx = d.id ? out.findIndex((t) => t.id === d.id) : -1;
    if (idx < 0 && !d.id && out.length > 0) idx = out.length - 1;
    if (idx < 0) {
      out.push({ id: d.id || ('tc_' + out.length), name: d.name || '', arguments: d.arguments || '' });
    } else {
      const cur = out[idx];
      if (d.name) cur.name = d.name;
      if (d.arguments) cur.arguments = (cur.arguments || '') + d.arguments;
      if (d.id) cur.id = d.id;
    }
  }
  return out;
}
