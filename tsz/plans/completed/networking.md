# Networking Stack — HTTP, HTTPS, WebSocket, SOCKS5, Tor

## What We're Porting

The Love2D networking stack is ~2,800 lines of Lua across 7 files. It provides HTTP client/server, WebSocket client/server, SOCKS5 proxy tunneling, and Tor hidden service management. All non-blocking, all polled per frame.

## Architecture Decision

| Component | Lua uses | tsz will use | Why |
|-----------|----------|-------------|-----|
| HTTP/HTTPS | LuaSocket + love.thread | **libcurl** via `@cImport` + `std.Thread` | libcurl handles TLS, redirects, proxy, cookies — Zig stdlib has no TLS in 0.15 |
| WebSocket | Pure Lua (LuaSocket TCP) | **Pure Zig** (`std.net`) | RFC 6455 framing is simple, no external dep needed |
| SOCKS5 | Pure Lua state machine | **Pure Zig** state machine | Direct port, ~300 lines |
| TCP | LuaSocket | `std.net.Stream` | Zig stdlib |
| Threading | love.thread + channels | `std.Thread` + ring buffer | No built-in channels in Zig, ring buffer is better for poll-based arch |
| Tor | `os.execute` subprocess | `std.process.Child` | Zig's process API is cleaner |

**Key difference from Lua:** Love2D uses `love.thread.getChannel()` for worker↔main communication. Zig has no channel primitive. We use a **thread-safe ring buffer** (mutex + fixed array) that the main loop drains each frame — same poll pattern, different primitive.

## Love2D Reference Files

| File | Lines | What it does | Key functions |
|------|-------|-------------|---------------|
| `love2d/lua/http.lua` | 481 | Thread pool HTTP, SOCKS5 proxy, streaming | `Http.request()`, `Http.streamRequest()`, `Http.poll()` |
| `love2d/lua/websocket.lua` | 275 | WS client, RFC 6455, non-blocking | `ws:update()`, `ws:send()`, callbacks |
| `love2d/lua/network.lua` | 346 | Connection registry, reconnect, .onion | `Network.connect()`, `Network.poll()`, `Network.send()` |
| `love2d/lua/socks5.lua` | 324 | Blocking + async SOCKS5 tunnel | `socks5.connect()`, `Tunnel:update()` |
| `love2d/lua/wsserver.lua` | 402 | WS server, multi-client, broadcast | `server:update()`, `server:broadcast()` |
| `love2d/lua/httpserver.lua` | 780 | Static files, dynamic routes, MIME | `server:update()`, `_M.pollAll()` |
| `love2d/lua/tor.lua` | 264 | Tor subprocess, torrc, hidden service | `Tor.start()`, `Tor.getHostname()` |

---

## Phase 1: Thread-Safe Ring Buffer

**New file: `tsz/runtime/net/ring_buffer.zig`**

Replaces `love.thread.getChannel()`. Fixed-size queue protected by a mutex. Main thread drains it each frame (poll pattern).

```zig
pub fn RingBuffer(comptime T: type, comptime N: usize) type {
    return struct {
        items: [N]T = undefined,
        head: usize = 0,
        tail: usize = 0,
        count: usize = 0,
        mutex: std.Thread.Mutex = .{},

        pub fn push(self: *@This(), item: T) bool;  // returns false if full
        pub fn pop(self: *@This()) ?T;               // returns null if empty
        pub fn drain(self: *@This(), out: []T) usize; // drain all into slice
    };
}
```

Reference: `love2d/lua/http.lua:43-44` — `requestChannel` and `responseChannel` are the Lua equivalent.

**No external dependencies. Pure Zig.**

---

## Phase 2: HTTP/HTTPS Client (libcurl)

**New file: `tsz/runtime/net/http.zig`**

### Architecture

Same as `love2d/lua/http.lua` — thread pool with workers that block on requests, main loop polls for responses.

```
Main thread:                    Worker threads (4):
  http.request(id, opts)  →     [ring buffer] → worker picks up
  http.poll()             ←     [ring buffer] ← worker pushes response
```

Reference: `love2d/lua/http.lua:43-46` (thread pool), `love2d/lua/http.lua:51-325` (WORKER_CODE)

### libcurl integration

```zig
const curl = @cImport({ @cInclude("curl/curl.h"); });
```

Worker thread function:
1. `curl_easy_init()`
2. Set URL, method, headers, body via `curl_easy_setopt()`
3. `curl_easy_perform()` (blocks)
4. Read status, response headers, body
5. Push response to ring buffer
6. Loop

Reference: `love2d/lua/http.lua:163-324` (worker main loop — same logic, different library)

### Public API (matches Lua)

```zig
pub fn init() void;                           // spawn 4 worker threads
pub fn request(id: u32, opts: RequestOpts) void;  // queue request
pub fn poll(out: []Response) usize;           // drain responses (non-blocking)
pub fn destroy() void;                        // join all threads
```

Reference: `love2d/lua/http.lua:327` (init), `love2d/lua/http.lua:346` (request), `love2d/lua/http.lua:431` (poll)

### RequestOpts / Response

```zig
pub const RequestOpts = struct {
    url: []const u8,
    method: enum { GET, POST, PUT, DELETE } = .GET,
    headers: ?[]const [2][]const u8 = null,  // key-value pairs
    body: ?[]const u8 = null,
    proxy: ?[]const u8 = null,               // SOCKS5 or HTTP proxy URL
};

pub const Response = struct {
    id: u32,
    status: u16,
    body: [MAX_BODY]u8,
    body_len: usize,
    response_type: enum { complete, chunk, progress, error },
    error_msg: [256]u8,
    error_len: usize,
};
```

Reference: `love2d/lua/http.lua:15-20` (response format), `love2d/lua/http.lua:27` (request options)

### Proxy support

libcurl handles SOCKS5 and HTTP proxy natively via `CURLOPT_PROXY`:
```zig
curl.curl_easy_setopt(handle, curl.CURLOPT_PROXY, "socks5h://127.0.0.1:9050");
```

This replaces the 60+ lines of manual SOCKS5 tunneling in the Lua worker code (`love2d/lua/http.lua:58-124`). libcurl does it for us.

### Environment proxy resolution

Check `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` env vars.
Reference: `love2d/lua/http.lua:126-160` (proxy resolution logic)

```zig
fn resolveProxy(url: []const u8) ?[]const u8 {
    // Check NO_PROXY first
    // Then HTTPS_PROXY / HTTP_PROXY based on scheme
    // Fallback to ALL_PROXY
    return std.posix.getenv("ALL_PROXY");
}
```

### Streaming / SSE

For streaming responses, use `CURLOPT_WRITEFUNCTION` callback that pushes chunks to the ring buffer immediately instead of buffering.

Reference: `love2d/lua/http.lua:234-273` (streaming ltn12 sink that pushes chunks to channel)

### Build integration

In `build.zig`, link libcurl:
```zig
exe.linkSystemLibrary("curl");
```

**Dependency:** libcurl-dev on Linux (`sudo apt install libcurl4-openssl-dev`), Homebrew on macOS, prebuilt on Windows. Cross-platform — libcurl runs everywhere.

---

## Phase 3: WebSocket Client (Pure Zig)

**New file: `tsz/runtime/net/websocket.zig`**

Pure Zig implementation of RFC 6455. No external dependencies. Non-blocking TCP via `std.net`.

### Connection lifecycle

Reference: `love2d/lua/websocket.lua:62-94` (constructor), `love2d/lua/websocket.lua:204-260` (update/poll)

```
Status: CONNECTING → OPEN → CLOSING → CLOSED
         (TCP+Upgrade)  (frames)  (close handshake)
```

### Public API

```zig
pub const WebSocket = struct {
    pub fn connect(host: []const u8, port: u16, path: []const u8) !WebSocket;
    pub fn connectViaTunnel(socket: std.net.Stream, host: []const u8, path: []const u8) !WebSocket;
    pub fn send(self: *WebSocket, message: []const u8) !void;
    pub fn update(self: *WebSocket) ?Event;  // non-blocking poll
    pub fn close(self: *WebSocket) void;
};

pub const Event = union(enum) {
    open: void,
    message: []const u8,
    close: struct { code: u16, reason: []const u8 },
    err: []const u8,
};
```

Reference: `love2d/lua/websocket.lua:187-199` (send/ping/pong), callbacks at lines 51-54

### HTTP Upgrade Handshake

Reference: `love2d/lua/wsserver.lua:148-207` (server-side handshake — client side is the mirror)

```
GET /path HTTP/1.1
Host: host
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <base64 random 16 bytes>
Sec-WebSocket-Version: 13
```

Server responds with 101 + `Sec-WebSocket-Accept` = SHA1(key + magic GUID) base64.

Magic GUID: `258EAFA5-E914-47DA-95CA-5AB515859764` (RFC 6455 §4.2.2)

Reference: `love2d/lua/wsserver.lua:32` (MAGIC_GUID), `love2d/lua/wsserver.lua:188` (SHA1+base64 accept)

### Frame Encoding/Decoding

Reference: `love2d/lua/websocket.lua:101-135` (encode), `love2d/lua/websocket.lua:141-180` (decode)

Client→Server frames are masked (4-byte key, XOR payload).
Server→Client frames are unmasked.

Length encoding:
- 0-125: 1 byte inline
- 126-65535: 2 bytes extended
- >65535: 8 bytes extended

### Non-blocking pattern

Set socket to non-blocking. In `update()`:
- Try `socket.read()` — if would-block, return null
- If data available, parse frame, return event
- Called once per frame from main loop

Reference: `love2d/lua/websocket.lua:204-260` (update loop with non-blocking reads)

---

## Phase 4: SOCKS5 Tunnel (Pure Zig)

**New file: `tsz/runtime/net/socks5.zig`**

Direct port of `love2d/lua/socks5.lua`. Both blocking and async modes.

### State machine (async mode)

Reference: `love2d/lua/socks5.lua:109-304` (async state machine)

```
tcp_connect → greeting_send → greeting_recv →
  [if auth needed] auth_send → auth_recv →
  connect_send → connect_recv → addr_recv → done
```

### Public API

```zig
// Blocking
pub fn connect(proxy_host: []const u8, proxy_port: u16, target_host: []const u8, target_port: u16) !std.net.Stream;

// Async
pub const Tunnel = struct {
    pub fn start(proxy_host: []const u8, proxy_port: u16, target_host: []const u8, target_port: u16) Tunnel;
    pub fn update(self: *Tunnel) Status;  // advance state machine
    pub fn getSocket(self: *Tunnel) ?std.net.Stream;  // valid after done
    pub fn close(self: *Tunnel) void;
};

pub const Status = enum { pending, done, err };
```

Reference: `love2d/lua/socks5.lua:29-90` (blocking), `love2d/lua/socks5.lua:109-131` (async constructor)

### Protocol (RFC 1928 + 1929)

Reference: `love2d/lua/socks5.lua:176-243`

Greeting: `[05, 01, 00]` (version 5, 1 method, no-auth)
With auth: `[05, 02, 00, 02]` (version 5, 2 methods, no-auth + user/pass)
Auth (RFC 1929): `[01, ulen, user, plen, pass]`
CONNECT: `[05, 01, 00, 03, hostlen, host, port_hi, port_lo]` (domain name)

Error codes: `love2d/lua/socks5.lua:100-104`

### Timeout

60 seconds total for handshake. Reference: `love2d/lua/socks5.lua:127`

---

## Phase 5: Network Manager

**New file: `tsz/runtime/net/manager.zig`**

Connection registry with auto-reconnect and .onion routing. Direct port of `love2d/lua/network.lua`.

### Public API

```zig
pub fn connect(id: u32, url: []const u8, opts: ConnectOpts) void;
pub fn send(id: u32, data: []const u8) void;
pub fn close(id: u32) void;
pub fn poll(out: []NetEvent) usize;  // drain events
pub fn destroy() void;
```

Reference: `love2d/lua/network.lua:123` (connect), `love2d/lua/network.lua:186` (poll)

### Connection registry

```zig
const Connection = struct {
    ws: ?WebSocket,
    tunnel: ?socks5.Tunnel,
    url: [512]u8,
    status: enum { connecting, tunneling, open, reconnecting, closed },
    reconnect: bool,
    backoff_ms: u32,       // starts at 1000, doubles to max 30000
    next_retry: u32,       // SDL_GetTicks timestamp
};
```

Reference: `love2d/lua/network.lua:30` (connection registry), lines 101-105 (backoff)

### .onion detection

If host ends in `.onion`, route through SOCKS5 tunnel to Tor's proxy port.

Reference: `love2d/lua/network.lua:141` (.onion detection), `love2d/lua/network.lua:114` (start async tunnel)

### Auto-reconnect

On connection close, if `reconnect == true`:
1. Set status to `reconnecting`
2. Set `next_retry = SDL_GetTicks() + backoff_ms`
3. Double `backoff_ms` (max 30s)
4. In poll(), check if `SDL_GetTicks() >= next_retry`, attempt reconnect

Reference: `love2d/lua/network.lua:237-248` (reconnect scheduling)

---

## Phase 6: WebSocket Server (Pure Zig)

**New file: `tsz/runtime/net/wsserver.zig`**

Non-blocking WebSocket server. Multi-client. Broadcast + unicast.

### Public API

```zig
pub fn listen(port: u16) !WsServer;

pub const WsServer = struct {
    pub fn update(self: *WsServer) []ServerEvent;  // accept + process all clients
    pub fn send(self: *WsServer, client_id: u32, data: []const u8) void;
    pub fn broadcast(self: *WsServer, data: []const u8) void;
    pub fn close(self: *WsServer) void;
};
```

Reference: `love2d/lua/wsserver.lua:86-113` (server API)

### Client lifecycle

Reference: `love2d/lua/wsserver.lua:129` (client states), `love2d/lua/wsserver.lua:148-207` (handshake)

```
handshake → open → closed
```

Accept: non-blocking `accept()` on listener socket.
Handshake: parse HTTP upgrade, compute Sec-WebSocket-Accept, send 101.
Open: frame read/write loop.

---

## Phase 7: HTTP Server (Pure Zig)

**New file: `tsz/runtime/net/httpserver.zig`**

Static file server + dynamic route handling. Non-blocking.

### Public API

```zig
pub fn listen(port: u16, routes: []const Route) !HttpServer;

pub const HttpServer = struct {
    pub fn update(self: *HttpServer) []HttpEvent;  // accept + process
    pub fn respond(self: *HttpServer, client_id: u32, status: u16, body: []const u8) void;
    pub fn close(self: *HttpServer) void;
};
```

Reference: `love2d/lua/httpserver.lua:256-281` (server API)

### Route types

```zig
pub const Route = struct {
    path: []const u8,
    route_type: enum { static, handler },
    root: ?[]const u8,  // for static: filesystem root
};
```

Reference: `love2d/lua/httpserver.lua:272` (route types)

### Static file serving

Longest-prefix path match → serve file from disk.
MIME type detection by extension.
Path traversal prevention: reject `..` and null bytes.

Reference: `love2d/lua/httpserver.lua:87-142` (path matching), `love2d/lua/httpserver.lua:26-81` (MIME types), `love2d/lua/httpserver.lua:148-156` (security)

### Dynamic routes

Non-matched paths → emit `HttpEvent` with method, path, headers, body.
App responds via `httpserver.respond(client_id, status, body)`.

Reference: `love2d/lua/httpserver.lua:462-487` (parameterized routing)

---

## Phase 8: Tor Integration

**New file: `tsz/runtime/net/tor.zig`**

Subprocess manager for Tor. Generates torrc, starts process, polls for bootstrap.

### Public API

```zig
pub fn start(opts: TorOpts) !void;
pub fn getHostname() ?[]const u8;   // .onion address (null while bootstrapping)
pub fn getProxyPort() u16;          // SOCKS port
pub fn stop() void;
pub fn isRunning() bool;
```

Reference: `love2d/lua/tor.lua:89` (start), `love2d/lua/tor.lua:213` (getHostname), `love2d/lua/tor.lua:246` (stop)

### Startup flow

1. Find open SOCKS port starting from 9050
2. Find open hidden service port starting from 16667
3. Create config dir `~/.cache/reactjit-tor/<identity>/`
4. Generate torrc: `SocksPort`, `HiddenServiceDir`, `HiddenServicePort`, `DataDirectory`
5. Spawn: `tor -f torrc > tor.log 2>&1 &`
6. Save PID for cleanup

Reference: `love2d/lua/tor.lua:93-176` (port allocation, config generation, launch)

### Bootstrap polling

Poll `<hsDir>/hostname` file each frame. Returns null until Tor writes the .onion address (5-30 seconds).

Reference: `love2d/lua/tor.lua:213-229` (hostname polling)

### Process management

Use `std.process.Child` to spawn Tor. Track PID. Send SIGTERM on cleanup.

Reference: `love2d/lua/tor.lua:246-254` (shutdown), `love2d/lua/process_registry.lua` (PID tracking)

---

## Implementation Order

```
Phase 1: Ring buffer     → foundation, no deps
Phase 2: HTTP client     → needs ring buffer + libcurl
Phase 3: WS client       → needs ring buffer
Phase 4: SOCKS5          → standalone, needed by Phase 5
Phase 5: Network manager → needs WS client + SOCKS5
Phase 6: WS server       → standalone
Phase 7: HTTP server     → standalone
Phase 8: Tor             → needs SOCKS5 + process management
```

Phases 2 and 3 can run in parallel (both use ring buffer).
Phases 6 and 7 can run in parallel (independent servers).

### Agent split (4 agents)

| Agent | Phases | Files |
|-------|--------|-------|
| A | 1, 2 | ring_buffer.zig, http.zig |
| B | 3, 4 | websocket.zig, socks5.zig |
| C | 5, 8 | manager.zig, tor.zig |
| D | 6, 7 | wsserver.zig, httpserver.zig |

**A and B run first** (parallel). C runs after A+B (needs WS + SOCKS5). D runs anytime (independent).

### Dependency: useEffect must land first

The networking stack uses the poll pattern — `net.poll()` called every frame. This requires either:
- Generated code calling `net.poll()` in the main loop (compiler change)
- Or useEffect with the `every_frame` pattern: `useEffect(() => { processNetEvents() })`

The useEffect plan (`tsz/plans/use-effect.md`) covers this. Networking should be implemented after useEffect is working.

---

## Build Dependencies

| Platform | Package | Install |
|----------|---------|---------|
| Linux | libcurl-dev | `sudo apt install libcurl4-openssl-dev` |
| macOS | curl | Built-in (or `brew install curl`) |
| Windows | curl | Download from curl.se or vcpkg |

All other networking (WS, SOCKS5, TCP) is pure Zig — no external deps.

---

## Verification (per phase)

```bash
# Phase 1: ring buffer unit test
zig test tsz/runtime/net/ring_buffer.zig

# Phase 2: HTTP client
./zig-out/bin/tsz build tsz/examples/http-test.tsz
# Fetches httpbin.org/get and displays the response

# Phase 3: WebSocket
./zig-out/bin/tsz build tsz/examples/ws-test.tsz
# Connects to echo.websocket.org, sends message, displays echo

# Phase 4-5: SOCKS5 + Network manager
# Requires Tor running locally
./zig-out/bin/tsz build tsz/examples/onion-test.tsz

# Phase 6-7: Servers
./zig-out/bin/tsz build tsz/examples/server-test.tsz
# Opens localhost:8080, serves static files

# Phase 8: Tor
./zig-out/bin/tsz build tsz/examples/tor-test.tsz
# Starts Tor, creates hidden service, displays .onion address
```
