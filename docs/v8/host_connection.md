# V8 useHost and useConnection pipeline

This is the end-to-end path for long-lived host-owned and outbound channels in
the V8 runtime.

```text
React hook
  -> stable JS id
  -> globalThis.__domain_op(...)
  -> V8 binding registry entry
  -> nonblocking Zig server/client/process state
  -> v8_app.zig per-frame tickDrain()
  -> __ffiEmit("domain:event:<id>", payload)
  -> runtime/ffi.ts setTimeout(0) listener dispatch
  -> hook callback/ref/state update
```

The important split:

- `useHost(...)` is for things the cart owns: HTTP server, WebSocket server,
  child process.
- `useConnection(...)` is for outbound or persistent channels the cart connects
  to: WebSocket, TCP, UDP, Tor, SOCKS5 config, streaming HTTP/SSE, RCON, A2S.
- One-shot outbound HTTP belongs to `fetch()` / `runtime/hooks/http.ts`, not
  `useConnection`, unless the response is a stream.

## Source map

- `runtime/hooks/useHost.ts` defines inbound/owned hook specs and handles.
- `runtime/hooks/useConnection.ts` defines outbound hook specs and handles.
- `runtime/ffi.ts` provides `callHost`, `subscribe`, and `__ffiEmit`.
- `framework/v8_bindings_httpserver.zig` backs `useHost({kind:'http'})`.
- `framework/v8_bindings_wsserver.zig` backs `useHost({kind:'ws'})`.
- `framework/v8_bindings_process.zig` backs `useHost({kind:'process'})`.
- `framework/v8_bindings_websocket.zig` backs `useConnection({kind:'ws'})`.
- `framework/v8_bindings_net.zig` backs TCP, UDP, and SOCKS5 registration.
- `framework/v8_bindings_tor.zig` backs Tor.
- `framework/v8_bindings_sdk.zig` backs streaming HTTP/SSE via
  `__http_stream_open`.
- `framework/v8_bindings_gameserver.zig` backs RCON and A2S.
- `framework/net/httpserver.zig`, `wsserver.zig`, `tcp.zig`, `udp.zig`,
  `websocket.zig`, `tor.zig`, `socks5.zig`, `rcon.zig`, and `a2s.zig` own the
  protocol implementations.
- `v8_app.zig` source-gates optional binding modules and calls their
  `tickDrain()` functions once per frame.

## Shared event model

Both hooks use the same event bridge:

```text
Zig binding emits:
  v8_runtime.callGlobal2Str("__ffiEmit", channel, payload)

runtime/ffi.ts receives:
  globalThis.__ffiEmit = (channel, payload) => {
    setTimeout(() => dispatchListeners(channel, payload), 0);
  };
```

Events are intentionally delivered on a later JS timer tick, not synchronously
inside native `tickDrain()`. This avoids React state updates re-entering the
frame that is currently draining host events.

Every hook instance gets a stable integer id from a JS module-level counter.
Channels include that id:

```text
httpsrv:request:<id>
wssrv:message:<id>
proc:stdout:<pid>
ws:message:<id>
tcp:data:<id>
http-stream:<cId>
rcon:response:<id>
```

## Build and registration

`v8_app.zig` has optional binding ingredients. `scripts/ship` reads the
esbuild metafile through `scripts/ship-metafile-gate.js`, then
`sdk/dependency-registry.json` maps shipped hook files to build flags.

Relevant gates:

| Shipped source | Build flags | Registers |
| --- | --- | --- |
| `runtime/hooks/useHost.ts` | `has-process`, `has-httpsrv`, `has-wssrv`, `has-net` | Process, HTTP server, WS server, TCP/UDP/SOCKS5 bindings. |
| `runtime/hooks/useConnection.ts` | `has-net`, `has-tor`, `has-websocket` | TCP/UDP/SOCKS5, Tor, WS client. RCON/A2S ride the `has-net` gate in `v8_app.zig`. |
| `runtime/hooks/http.ts` or `browser_page.ts` | `has-sdk` | HTTP/fetch SDK functions, including `__http_stream_open`. |
| `runtime/hooks/websocket.ts` | `has-websocket` | Browser-shaped WebSocket shim over `__ws_*`. |

The hooks call host functions through `callHost`, so a missing binding usually
degrades into no-op behavior rather than throwing. That is useful for UI work,
but it also means a missing source-gated binding can look like an optimistic
`open`/`running` state with no native events.

## useHost API

`useHost` accepts three spec families:

```ts
useHost({
  kind: 'http',
  port: 8500,
  routes: [{ path: '/', kind: 'handler' }],
  onRequest: (req, res) => res.send(200, 'text/plain', 'ok'),
});

useHost({
  kind: 'ws',
  port: 8501,
  onMessage: (clientId, data) => ws.send(clientId, data),
});

useHost({
  kind: 'process',
  cmd: '/bin/echo',
  args: ['hello'],
  onStdout: (line) => {},
  onExit: ({ code }) => {},
});
```

Common host handle fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable JS id, except process handles expose the child pid. |
| `kind` | Discriminator. |
| `state` | `starting`, `running`, `stopped`, or `error`. |
| `error` | Last hook-level error string. |
| `stop()` | Calls the matching close/kill host function. |

Callbacks are kept in refs. Changing callback identity does not restart the
host. HTTP route shape, process args/cwd/env/stdin, port, kind, and `viaKey`
are dependency keys that can restart a host.

## useHost HTTP server

JS path:

```text
useHost({kind:'http'})
  -> __httpsrv_listen(id, port, JSON.stringify(routes), viaJson)
  -> subscribe("httpsrv:request:<id>")
  -> subscribe("httpsrv:error:<id>")
```

Native path:

```text
hostListen
  -> parse up to 16 route specs
  -> heap-allocate httpserver.HttpServer
  -> listen on 0.0.0.0:<port>
  -> store in g_servers

tickDrain
  -> server.update(...)
  -> emit httpsrv:request:<id>
```

Request payload:

```json
{"clientId":1,"method":"GET","path":"/health","body":""}
```

Response path:

```text
res.send(status, contentType, body)
  -> __httpsrv_respond(id, clientId, status, contentType, body)
  -> server.respond(...)
  -> HTTP/1.1 response with Content-Length and Connection: close
```

Route behavior:

- Routes are prefix matches: path equals route path or continues with `/`.
- `kind: 'handler'` emits a JS request event.
- `kind: 'static'` serves files from `root` in Zig and does not emit JS events.
- Missing route returns 404 from Zig.
- Any path containing `..` returns 403.
- Request body capture is capped by `framework/net/httpserver.zig`'s fixed
  request buffer.

Current caveats:

- `useHost` passes `viaJson`, but `__httpsrv_listen` currently reads only id,
  port, and routes. Server exposure through `via: tor` is not wired here.
- `useHost` sets state to `running` optimistically after `listen`. A listen
  failure emits `httpsrv:error:<id>`.
- The binding comment says `__httpsrv_listen` returns `1/0`, but current V8
  implementation does not set a return value. The hook ignores the return.

## useHost WebSocket server

JS path:

```text
useHost({kind:'ws'})
  -> __wssrv_listen(id, port, viaJson)
  -> subscribe wssrv:open/message/close/error:<id>
```

Native path:

```text
hostListen
  -> heap-allocate wsserver.WsServer
  -> listen on 0.0.0.0:<port>
  -> store in g_servers

tickDrain
  -> accept clients
  -> finish RFC 6455 handshakes
  -> read text/binary frames
  -> emit JS events
```

Events:

| Channel | Payload |
| --- | --- |
| `wssrv:open:<id>` | `{"clientId":N}` |
| `wssrv:message:<id>` | `{"clientId":N,"data":"..."}` |
| `wssrv:close:<id>` | `{"clientId":N}` |
| `wssrv:error:<id>` | `{"error":"..."}` |

Handle methods:

```text
send(clientId, data) -> __wssrv_send(id, clientId, data)
broadcast(data)      -> __wssrv_broadcast(id, data)
stop()               -> __wssrv_close(id)
```

Current caveats:

- `viaJson` is passed but ignored by `__wssrv_listen`.
- Payloads cross V8 as strings. Binary protocols need explicit encoding at the
  JS layer.
- The server supports up to 64 clients and message buffers are fixed-size.

## useHost process

JS path:

```text
useHost({kind:'process'})
  -> __proc_spawn(specJson)
  -> subscribe proc:stdout:<pid>
  -> subscribe proc:stderr:<pid>
  -> subscribe proc:exit:<pid>
```

Spec JSON:

```json
{"cmd":"/bin/echo","args":["hi"],"cwd":"/tmp","env":{},"stdin":"pipe"}
```

Native path:

```text
hostSpawn
  -> parse cmd, args, cwd, stdin
  -> process.spawnPiped(...)
  -> store Entry by pid

tickDrain
  -> nonblocking read stdout/stderr
  -> emit complete lines
  -> alive() reaps exited child
  -> emit proc:exit:<pid>
```

Handle methods:

| Method | Host call |
| --- | --- |
| `stdin(data)` | `__proc_stdin_write(pid, data)` |
| `stdinClose()` | `__proc_stdin_close(pid)` |
| `kill(signal)` | `__proc_kill(pid, 'SIGTERM' | 'SIGKILL')` |
| `stop()` | `__proc_kill(pid, 'SIGTERM')` |

Current caveats:

- `env` is in the TypeScript spec but the V8 binding currently drops nested env
  parsing. Child processes inherit the parent env plus no per-process additions
  from this hook.
- `stdin: 'pipe'` controls whether stdin is piped; stdout and stderr are always
  piped by this binding.
- Stdout/stderr events are line-buffered. A full line buffer without newline is
  flushed as-is so the UI keeps moving.
- Unmount cleanup sends SIGTERM to the live pid.

## useConnection API

`useConnection` is the outbound/persistent side:

```ts
const tcp = useConnection({
  kind: 'tcp',
  host: '127.0.0.1',
  port: 8400,
  onData: (s) => {},
});

const sse = useConnection({
  kind: 'sse',
  url,
  headers,
  onEvent: (ev) => {},
});
```

Common handle fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable JS id. |
| `state` | `connecting`, `open`, `closed`, or `error`. |
| `error` | Last hook-level error string. |
| `close()` | Calls the matching close host function. |

Declared kinds:

| Kind | Status |
| --- | --- |
| `ws` | Wired for `ws://` client connections. |
| `tcp` | Wired, including `via: tor` and `via: socks5`. |
| `udp` | Wired direct UDP client socket. |
| `tor` | Wired as a shared Tor process/hidden-service helper. |
| `socks5` | Wired as a config holder for later TCP `via`. |
| `http` | Wired through streaming HTTP. |
| `sse` | Wired through streaming HTTP plus JS SSE parser. |
| `rcon` | Wired through Source RCON binding. |
| `a2s` | Wired through Source Query UDP binding. |
| `wireguard` | TS shape only; reports error. |
| `stun` | TS shape only; reports error. |
| `peer` | TS shape only; reports error/no-op send. |

## WebSocket client

JS path:

```text
useConnection({kind:'ws'})
  -> __ws_open(id, url, viaJson)
  -> subscribe ws:open/message/close/error:<id>
```

Native path:

```text
hostWsOpen
  -> parse ws:// URL
  -> tcpConnectToHost
  -> websocket.WebSocket.init(...)
  -> store in g_conns

tickDrain
  -> ws.update()
  -> emit open/message/close/error
```

Handle:

```text
send(data) -> __ws_send(id, data)
close()    -> __ws_close(id)
```

Current caveats:

- Only `ws://` is parsed. `wss://` is not supported here.
- `viaJson` is passed by the hook but ignored by the binding.
- `runtime/hooks/websocket.ts` also installs a browser-shaped
  `globalThis.WebSocket` shim over the same `__ws_*` functions.

## TCP, UDP, and SOCKS5

TCP:

```text
useConnection({kind:'tcp'})
  -> __tcp_connect(id, host, port, viaJson)
  -> tcp:open is subscribed but native does not currently emit it
  -> hook sets state open optimistically
  -> tcp:data/error/close events arrive from tickDrain
```

TCP handle:

```text
send(data) -> __tcp_send(id, data)
close()    -> __tcp_close(id)
```

TCP `via` support is implemented for:

| `via.kind` | Behavior |
| --- | --- |
| `tor` | Uses `tor.getProxyPort()` and SOCKS5-connects through local Tor. |
| `socks5` | Looks up registered SOCKS5 host/port/auth and tunnels through it. |

SOCKS5:

```text
useConnection({kind:'socks5', host, port, username, password})
  -> __socks5_register(id, host, port, username, password)
  -> state = open
```

SOCKS5 opens no socket by itself. It is a registry entry used by later TCP
connections.

UDP:

```text
useConnection({kind:'udp'})
  -> __udp_open(id, host, port, viaJson)
  -> state = open
  -> udp:packet/error events arrive from tickDrain
```

UDP handle:

```text
send(data) -> __udp_send(id, data)
close()    -> __udp_close(id)
```

Current caveats:

- UDP `viaJson` is passed but ignored.
- TCP and UDP payloads cross as V8 strings. Non-UTF-8 protocols should encode
  bytes explicitly.
- TCP open is optimistic; no native `tcp:open` event is emitted today.

## Tor

JS path:

```text
useConnection({kind:'tor', socksPort?})
  -> __tor_start(id, optsJson)
  -> subscribe tor:open/error:<id>
```

Native path:

```text
hostTorStart
  -> tor.start({identity, hidden_service_port, socks_port})
  -> add waiting handle id

tickDrain
  -> once tor.getHostname() exists:
       emit tor:open:<id> with socksPort, hostname, hsPort
```

Handle fields:

| Field | Meaning |
| --- | --- |
| `socksPort` | Local SOCKS proxy port. |
| `hostname` | Onion hostname once available. |
| `hsPort` | Hidden-service forwarded port. |

Tor is global. Multiple hook handles share one Tor process; the last
`__tor_stop(id)` stops it.

Current caveats:

- `useConnection` sends `identity` and `socksPort`, but not
  `hiddenServicePort`, so the binding defaults hidden service port to 80.
- `useHost(..., via: torHandle)` is declared in comments but the current HTTP
  and WS server bindings ignore `viaJson`.

## Streaming HTTP and SSE

`useConnection({kind:'http'})` and `useConnection({kind:'sse'})` are covered by
the fetch pipeline's streaming branch:

```text
rid = "c" + id
__http_stream_open(reqJson, rid)
http-stream:<rid>      -> chunks
http-stream-end:<rid>  -> status or error
```

HTTP stream handle:

| Field | Meaning |
| --- | --- |
| `status` | Final HTTP status after `http-stream-end`; `0` before close. |
| `close()` | Calls `__http_stream_close("c" + id)`. |

SSE behavior:

- Adds `Accept: text/event-stream`.
- Adds `Cache-Control: no-cache` when not provided.
- Defaults to POST when `body` is present, otherwise GET.
- Parses `event`, `data`, `id`, and `retry` lines in JS.

Current caveats:

- Closing removes the request-id mapping but does not abort libcurl.
- The hook does not include `via` in the HTTP stream JSON.
- SDK source-gating can matter for HTTP-only stream users. `useConnection.ts`
  itself does not gate `has-sdk`; importing `runtime/hooks/http.ts` or
  `browser_page.ts` does. The underlying stream functions live in
  `v8_bindings_sdk.zig`.

## RCON and A2S

RCON:

```text
useConnection({kind:'rcon'})
  -> __rcon_open(id, host, port, password)
  -> rcon:auth:<id>       {"ok":true|false}
  -> rcon:response:<id>   {"requestId":N,"body":"..."}
  -> rcon:close/error:<id>
```

Handle:

```text
authenticated
command(cmd) -> __rcon_command(id, jsReqId, cmd)
```

The hook returns a JS request id, but the current binding ignores that hint and
emits the protocol-side request id from `RconClient.command(...)`.

A2S:

```text
useConnection({kind:'a2s'})
  -> __a2s_open(id, host, port)
  -> queryInfo()    -> __a2s_query(id, "info")
  -> queryPlayers() -> __a2s_query(id, "players")
  -> queryRules()   -> __a2s_query(id, "rules")
```

Events:

| Channel | Payload |
| --- | --- |
| `a2s:info:<id>` | Parsed server info JSON. |
| `a2s:players:<id>` | Player array JSON. |
| `a2s:rules:<id>` | Rules object JSON. |
| `a2s:error:<id>` | Error message. |

RCON and A2S do binary protocol framing in Zig so V8 sees structured JSON or
UTF-8 text instead of raw packet bytes.

## Unwired specs

These TypeScript specs exist but intentionally do not have V8 backends in
`useConnection.ts` today:

| Kind | Hook behavior |
| --- | --- |
| `wireguard` | Sets error: backend not implemented. |
| `stun` | Sets error: backend not implemented. |
| `peer` | Sets error for open path; returned `send` is no-op. |

## Sharp edges

- `via` is only implemented for TCP through Tor/SOCKS5. HTTP server, WS server,
  WS client, UDP, and HTTP/SSE stream `via` are declared or passed around but
  not honored by current bindings.
- Several hooks set `running` or `open` optimistically because native open
  events are absent for that backend.
- Missing source-gated bindings can degrade silently through `callHost`
  fallbacks.
- Server and socket payloads are strings. Binary callers need base64 or another
  explicit encoding.
- HTTP server routes are parsed by a small hand-rolled parser; keep route specs
  simple.
- Process `env` is declared but not parsed by the V8 process binding.
- Process stdout/stderr are line-buffered and delivered on later JS ticks.
- Closing HTTP/SSE streams does not cancel curl work.
- `wss://` is not supported by the WebSocket client binding.
- `useHost({kind:'process'})` exposes `id` as `pid`; before spawn succeeds it
  is `0`.
