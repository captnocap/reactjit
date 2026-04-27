/**
 * http — HTTP client bindings backed by framework/net/ (libcurl linked).
 *
 * Offers three tiers:
 *   - Sync calls (get/post/request) — blocking, simplest. Fine for small
 *     payloads + fast endpoints during dev/scripts.
 *   - Async via promises (getAsync/postAsync) — resolves when the Zig side
 *     fires __ffiEmit('http:<reqId>', response). Doesn't block the frame.
 *   - `fetch` shim — standards-shaped wrapper over getAsync/postAsync so
 *     copy-pasted browser code that uses fetch() mostly works.
 *
 * Registration (Zig side):
 *
 *   qjs_runtime.registerHostFn("__http_request_sync", @ptrCast(&http_request_sync), 1);
 *   qjs_runtime.registerHostFn("__http_request_async", @ptrCast(&http_request_async), 2);
 *
 * Sync takes a JSON request spec, returns a JSON response.
 * Async takes (spec, reqId), fires __ffiEmit('http:<reqId>', responseJson) when done.
 */

import { callHostJson, callHost, subscribe } from '../ffi';
import type { TransportHandle } from './useConnection';

export interface HttpRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Route this request through a transport handle (tor/socks5/wireguard/...). */
  via?: TransportHandle;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

// ── Sync ───────────────────────────────────────────────────────────

export function request(req: HttpRequest): HttpResponse {
  return callHostJson<HttpResponse>(
    '__http_request_sync',
    { status: 0, headers: {}, body: '', error: 'http not wired' },
    JSON.stringify(req),
  );
}

export function get(url: string, headers?: Record<string, string>): HttpResponse {
  return request({ method: 'GET', url, headers });
}

export function post(url: string, body: string, headers?: Record<string, string>): HttpResponse {
  return request({ method: 'POST', url, body, headers });
}

// ── Async (promise-wrapped) ────────────────────────────────────────

let _reqIdSeq = 1;

export function requestAsync(req: HttpRequest): Promise<HttpResponse> {
  const reqId = `req${_reqIdSeq++}`;
  return new Promise<HttpResponse>((resolve) => {
    const unsub = subscribe(`http:${reqId}`, (payload) => {
      unsub();
      resolve(typeof payload === 'string' ? JSON.parse(payload) : payload);
    });
    callHost<void>('__http_request_async', undefined as any, JSON.stringify(req), reqId);
  });
}

export function getAsync(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
  return requestAsync({ method: 'GET', url, headers });
}

export function postAsync(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse> {
  return requestAsync({ method: 'POST', url, body, headers });
}

// ── Streaming download ─────────────────────────────────────────────
// Lower-level than `useConnection({kind:'http'})` — for non-React contexts
// (effects, scripts, the EventSource shim). Each chunk arrives via onChunk;
// onComplete fires once at the end with the final HTTP status, or onError
// fires once with a libcurl message.

export interface StreamingHttpRequest extends HttpRequest {}

export interface StreamingHttpHandle {
  /** Free the rid mapping. Cannot abort an in-flight perform. */
  close(): void;
}

export interface StreamingHttpCallbacks {
  onChunk?: (data: string) => void;
  onComplete?: (info: { status: number }) => void;
  onError?: (msg: string) => void;
}

let _streamSeq = 1;

export function requestStream(req: StreamingHttpRequest, cb: StreamingHttpCallbacks): StreamingHttpHandle {
  const rid = `s${_streamSeq++}`;
  const unsubChunk = subscribe(`http-stream:${rid}`, (data) => {
    const s = typeof data === 'string' ? data : String(data);
    cb.onChunk?.(s);
  });
  const unsubEnd = subscribe(`http-stream-end:${rid}`, (raw) => {
    let obj: any = {};
    try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {}
    unsubChunk();
    unsubEnd();
    if (typeof obj.error === 'string') cb.onError?.(obj.error);
    else cb.onComplete?.({ status: obj.status ?? 0 });
  });
  callHost<void>('__http_stream_open', undefined as any, JSON.stringify(req), rid);
  return {
    close: () => {
      unsubChunk();
      unsubEnd();
      callHost<void>('__http_stream_close', undefined as any, rid);
    },
  };
}

// ── fetch() shim ───────────────────────────────────────────────────
// Enough of the Fetch API surface that `await fetch(url).then(r => r.json())`
// works in copy-pasted React components.

export function installFetchShim(): void {
  (globalThis as any).fetch = async (url: string, init: any = {}): Promise<any> => {
    const r = await requestAsync({
      method: (init.method || 'GET').toUpperCase(),
      url,
      headers: init.headers,
      body: init.body,
      via: init.via,
    });
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: '',
      headers: { get: (k: string) => r.headers[k.toLowerCase()] || null },
      text: async () => r.body,
      json: async () => JSON.parse(r.body),
      blob: async () => { throw new Error('fetch shim: blob() not supported'); },
      arrayBuffer: async () => { throw new Error('fetch shim: arrayBuffer() not supported'); },
    };
  };
}

// ── EventSource shim ───────────────────────────────────────────────
// Drop-in for `new EventSource(url)` from copy-pasted browser code. Layered
// over requestStream + a tiny SSE parser.

type EsHandler = (ev: any) => void;

class ReactjitEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly url: string;
  readyState: number = ReactjitEventSource.CONNECTING;
  onopen: EsHandler | null = null;
  onmessage: EsHandler | null = null;
  onerror: EsHandler | null = null;

  private _handle: StreamingHttpHandle | null = null;
  private _named: Map<string, Set<EsHandler>> = new Map();
  private _leftover: string = '';
  private _evName: string = 'message';
  private _evData: string = '';
  private _evId: string | undefined;

  constructor(url: string, _init?: { withCredentials?: boolean }) {
    this.url = url;
    this._handle = requestStream(
      { method: 'GET', url, headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' } },
      {
        onChunk: (s) => {
          if (this.readyState === ReactjitEventSource.CONNECTING) {
            this.readyState = ReactjitEventSource.OPEN;
            this.onopen?.({ type: 'open' });
          }
          this._feed(s);
        },
        onComplete: () => {
          if (this._leftover !== '') this._feed('\n');
          this.readyState = ReactjitEventSource.CLOSED;
        },
        onError: (msg) => {
          this.readyState = ReactjitEventSource.CLOSED;
          this.onerror?.({ type: 'error', message: msg });
        },
      },
    );
  }

  addEventListener(name: string, handler: EsHandler): void {
    let set = this._named.get(name);
    if (!set) { set = new Set(); this._named.set(name, set); }
    set.add(handler);
  }

  removeEventListener(name: string, handler: EsHandler): void {
    this._named.get(name)?.delete(handler);
  }

  close(): void {
    this.readyState = ReactjitEventSource.CLOSED;
    this._handle?.close();
    this._handle = null;
  }

  private _feed(incoming: string): void {
    const buf = this._leftover + incoming;
    const lines = buf.split(/\r\n|\r|\n/);
    this._leftover = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') { this._dispatch(); continue; }
      if (line.startsWith(':')) continue;
      const sep = line.indexOf(':');
      const field = sep === -1 ? line : line.slice(0, sep);
      let value = sep === -1 ? '' : line.slice(sep + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') this._evName = value;
      else if (field === 'data') this._evData = this._evData === '' ? value : `${this._evData}\n${value}`;
      else if (field === 'id') this._evId = value;
    }
  }

  private _dispatch(): void {
    if (this._evData === '' && this._evName === 'message') {
      this._evName = 'message';
      this._evData = '';
      this._evId = undefined;
      return;
    }
    const ev: any = { type: this._evName, data: this._evData, lastEventId: this._evId ?? '' };
    if (this._evName === 'message') this.onmessage?.(ev);
    const named = this._named.get(this._evName);
    if (named) for (const h of named) h(ev);
    this._evName = 'message';
    this._evData = '';
    this._evId = undefined;
  }
}

export function installEventSourceShim(): void {
  (globalThis as any).EventSource = ReactjitEventSource;
}
