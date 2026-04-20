/**
 * websocket — client-side WebSocket backed by framework/net/ (pure-Zig WS).
 *
 * Matches the browser WebSocket API shape (open/message/close/error events)
 * so copy-pasted code that uses `new WebSocket(url)` just works after
 * installing the shim.
 *
 * Registration (Zig side):
 *
 *   qjs_runtime.registerHostFn("__ws_open", @ptrCast(&ws_open), 2);
 *   qjs_runtime.registerHostFn("__ws_send", @ptrCast(&ws_send), 2);
 *   qjs_runtime.registerHostFn("__ws_close", @ptrCast(&ws_close), 1);
 *
 * Events fire via __ffiEmit:
 *   __ffiEmit('ws:open:<id>', {})
 *   __ffiEmit('ws:message:<id>', dataString)
 *   __ffiEmit('ws:close:<id>', { code, reason })
 *   __ffiEmit('ws:error:<id>', errorMessage)
 */

import { callHost, subscribe } from '../ffi';

type Handler = (ev: any) => void;

let _idSeq = 1;

export class ReactjitWebSocket {
  readonly id: number;
  readonly url: string;
  onopen: Handler | null = null;
  onmessage: Handler | null = null;
  onclose: Handler | null = null;
  onerror: Handler | null = null;
  private _unsubs: Array<() => void> = [];

  constructor(url: string) {
    this.id = _idSeq++;
    this.url = url;
    this._unsubs.push(subscribe(`ws:open:${this.id}`, () => { this.onopen?.({}); }));
    this._unsubs.push(subscribe(`ws:message:${this.id}`, (data) => { this.onmessage?.({ data }); }));
    this._unsubs.push(subscribe(`ws:close:${this.id}`, (p) => { this.onclose?.(p); this._cleanup(); }));
    this._unsubs.push(subscribe(`ws:error:${this.id}`, (msg) => { this.onerror?.({ message: msg }); }));
    callHost<void>('__ws_open', undefined as any, this.id, url);
  }

  send(data: string): void {
    callHost<void>('__ws_send', undefined as any, this.id, data);
  }

  close(code?: number, reason?: string): void {
    callHost<void>('__ws_close', undefined as any, this.id);
    this._cleanup();
  }

  private _cleanup(): void {
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }
}

/** Install as `globalThis.WebSocket` so copy-pasted browser code works. */
export function installWebSocketShim(): void {
  (globalThis as any).WebSocket = ReactjitWebSocket;
}
