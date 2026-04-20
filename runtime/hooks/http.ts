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

export interface HttpRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
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
