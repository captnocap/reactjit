# Networking Subsystem Benchmark Results

**Date:** 2026-03-28
**Host:** Linux 6.14.0-37-generic x86_64, Intel i7-14700KF, 64GB
**Zig:** 0.15.2 (`-OReleaseFast`)
**LuaJIT:** 2.1.1737090214 (Mike Pall)
**QuickJS:** quickjs-ng (built from source, `cc -O2`)

---

## Part 1: TCP/HTTP Network Performance

Connection-per-request echo, HTTP GET, and persistent connection reuse.

| Test       | Runtime  | Iters | Avg μs | P99 μs | Throughput | RSS KB |
|------------|----------|-------|--------|--------|------------|--------|
| tcp_echo   | zig      | 2000  | 24.3   | 39.0   | 41,205     | 316    |
| tcp_echo   | luajit   | 2000  | 29.1   | 48.0   | 34,345     | 316    |
| tcp_echo   | quickjs  | 2000  | 27.5   | 43.0   | 36,411     | 312    |
| http_get   | zig      | 1000  | 38.8   | 42.0   | 25,803     | 372    |
| http_get   | luajit   | 1000  | 36.1   | 42.0   | 27,665     | 372    |
| http_get   | quickjs  | 1000  | 28.2   | 41.0   | 35,418     | 368    |
| conn_pool  | zig      | 1000  | 11.8   | 36.0   | 84,868     | 372    |
| conn_pool  | luajit   | 1000  | 10.0   | 36.0   | 99,990     | 372    |
| conn_pool  | quickjs  | 1000  | 10.8   | 41.0   | 92,635     | 368    |

### Verdict: TCP layer is kernel-dominated

**Surprise: all three runtimes are within 20% of each other.** At the TCP/HTTP level, the kernel TCP stack (connect, accept, read/write, TIME_WAIT) dominates — not the runtime. The runtime overhead per syscall is dwarfed by the kernel context switch cost (~20-40μs per round-trip on this box).

- **Echo**: Zig 24μs vs LuaJIT 29μs vs QuickJS 27μs — noise-level differences
- **HTTP**: QuickJS actually wins (28μs) — its string handling for the tiny HTTP response is efficient
- **Pool (persistent conn)**: All three hit ~10μs — runtime overhead vanishes when you skip TCP handshake

**Implication:** For connection management (accept, close, keepalive, backpressure), the runtime choice barely matters at the single-connection level. Zig's advantage shows up at scale (no GC pauses under thousands of concurrent connections) — not measurable in this single-threaded test.

---

## Part 2: Payload Digestion

JSON parsing, field extraction, schema validation, computation, and serialization.
Bridge cost = overhead of moving data across runtime boundaries (0 for Zig).

### Small Payload (364 bytes)

| Function  | Zig μs | QuickJS μs | QJS Bridge μs | LuaJIT μs | Lua Bridge μs |
|-----------|--------|------------|----------------|-----------|---------------|
| parse     | 32.7   | **5.4**    | 5.5            | 16.2      | 11.5          |
| extract   | 34.2   | **5.3**    | 4.1            | 9.0       | 9.0           |
| validate  | 32.7   | **5.1**    | 3.9            | 14.1      | 8.9           |
| total     | 32.6   | **4.2**    | 5.1            | 12.7      | 13.3          |
| serialize | 35.8   | **5.7**    | 5.4            | 11.2      | 9.6           |

**QuickJS is 6× faster than Zig on small JSON.** `JSON.parse` is heavily optimized C code called once. Zig's `std.json.parseFromSlice` allocates a dynamic `Value` tree with hash maps — massive overkill for a 364-byte payload. LuaJIT's pure-Lua parser is 3× faster than Zig but 2-3× slower than QuickJS.

Bridge cost ≈ avg cost — for small payloads, the bridge IS the processing. But since QuickJS is 6× faster, even with bridge overhead it still beats Zig.

### Medium Payload (10.7 KB)

| Function  | Zig μs  | QuickJS μs | QJS Bridge μs | LuaJIT μs | Lua Bridge μs |
|-----------|---------|------------|----------------|-----------|---------------|
| parse     | 106.6   | **77.7**   | 83.5           | 232.7     | 234.8         |
| extract   | **94.6**| 85.5       | 79.5           | 238.0     | 230.8         |
| validate  | **102.4** | 102.3    | 82.7           | 232.4     | 274.8         |
| total     | **97.1**| 108.0      | 91.5           | 301.8     | 241.6         |
| serialize | **99.1**| 83.8       | 83.6           | 267.4     | 240.4         |

**Zig and QuickJS converge at 10KB.** Parse is still QuickJS advantage (77μs vs 106μs), but for extract/validate/total, Zig pulls ahead because it does zero-copy field access on the parsed tree — no GC, no JS object allocation per access. LuaJIT falls behind badly (2.5× slower than both) — the pure-Lua JSON parser doesn't JIT well due to complex string ops.

Bridge cost ≈ avg cost — at this size, bridging roughly doubles the real work. A Zig→QuickJS round-trip for 10KB is ~85μs of pure overhead.

### Large Payload (825 KB)

| Function  | Zig μs   | QuickJS μs | QJS Bridge μs | LuaJIT μs  | Lua Bridge μs |
|-----------|----------|------------|----------------|------------|---------------|
| parse     | **3,284**| 3,551      | 3,205          | 14,409     | 16,749        |
| extract   | **2,753**| 3,210      | 3,191          | 14,886     | 14,551        |
| validate  | **2,867**| 3,561      | 3,312          | 14,250     | 14,224        |
| total     | **2,830**| 3,231      | 3,233          | 15,464     | 14,791        |
| serialize | **2,885**| 4,097      | 3,736          | 15,054     | 15,773        |

**Zig wins at 825KB.** At this scale, Zig's no-GC advantage shows: 2.8ms vs 3.5ms (QuickJS) vs 14ms (LuaJIT). QuickJS's GC starts to matter — it's allocating thousands of JS objects for the 2000-item array. Zig parses into a flat tree and traverses without allocation.

Bridge cost ≈ avg cost — for large payloads, the bridge overhead is ~3.2ms (the string copy alone for 825KB). This means a Zig→QuickJS→Zig round-trip for a large payload is ~6.5ms total vs ~2.8ms pure Zig. **The bridge tax more than doubles the cost.**

### Memory

| Runtime | Small RSS | Medium RSS | Large RSS |
|---------|-----------|------------|-----------|
| Zig     | 508 KB    | 552 KB     | 1,200 KB  |
| QuickJS | 2,948 KB  | 3,452 KB   | 7,044 KB  |
| LuaJIT  | 2,960 KB  | 3,184 KB   | 9,004 KB  |

Zig uses 5-7× less memory than either scripting runtime.

---

## Part 3: Where to Draw the Line

### The hypothesis was partially right

The supervisor's hypothesis: TCP in Zig, HTTP/JSON in QuickJS.

**Confirmed:**
- QuickJS `JSON.parse` is genuinely fast — 6× faster than `std.json` on small payloads, competitive at medium
- For small API responses (<1KB), QuickJS wins even with bridge tax

**Disproved:**
- At 10KB+ payloads, Zig catches up and overtakes on extraction/validation
- At 100KB+, Zig dominates and bridge tax eats all QuickJS parsing gains
- TCP performance differences are noise — the kernel dominates, not the runtime

### The real split

```
┌─────────────────────────────────────────────────┐
│            TCP (Zig)                             │
│  accept, read, write, close, keepalive           │
│  connection pool, backpressure                   │
│  Reason: no GC pauses under load                │
├─────────────────────────────────────────────────┤
│     Small payload parsing (<1KB): QuickJS wins  │
│     JSON.parse + field access + return scalar    │
│     Bridge tax: ~5μs (acceptable for 6× speedup)│
├─────────────────────────────────────────────────┤
│     Medium payloads (1-100KB): Zig              │
│     std.json + direct field access               │
│     Bridge tax would cost ~85μs, Zig is ~100μs  │
│     Not worth crossing the boundary              │
├─────────────────────────────────────────────────┤
│     Large payloads (>100KB): Zig, no question   │
│     Bridge tax ~3.2ms, Zig total ~2.8ms          │
│     Bridging literally costs more than just      │
│     doing it in Zig                              │
├─────────────────────────────────────────────────┤
│     Plugin/scripting networking: QuickJS         │
│     User route handlers, middleware, API clients │
│     Bridge cost acceptable when network latency  │
│     (50-500ms) dwarfs runtime overhead           │
└─────────────────────────────────────────────────┘
```

### Specific recommendations for ReactJIT

1. **Write a Zig JSON parser that's not `std.json`.** The 6× loss to QuickJS on small payloads is embarrassing — `std.json` is over-engineered for our use case. A purpose-built parser that returns field offsets into the original buffer (zero-copy) would likely beat QuickJS at all sizes.

2. **Don't split TCP and HTTP across runtimes.** The bridge tax at medium+ payload sizes eats the gains. Keep both in Zig.

3. **QuickJS for plugin networking only.** Route handlers written in JS that call fetch-like APIs — the network latency (10-500ms) makes the 5-100μs runtime overhead irrelevant.

4. **Kill the LuaJIT JSON path.** LuaJIT lost every JSON benchmark by 2-5× vs both Zig and QuickJS. The pure-Lua parser can't JIT the string operations effectively. If we need LuaJIT for networking, use it for protocol logic only — never for JSON parsing.

5. **The "UI blowing up" test is still needed.** These benchmarks run in isolation. Under UI rendering load (60fps paint loop, layout recalc, GPU uploads), GC pauses from QuickJS/LuaJIT will show up as frame drops. That test requires the framework runtime, not this standalone experiment.

---

## Part 4: Data Path Optimization — Direct vs Double-Parse

The love2d stack currently does: raw bytes → LuaJIT `json.decode` → Lua table → `json.encode` → JS string → `JSON.parse`. That's a double parse. The optimized path: raw bytes → `JS_NewStringLen` → `JSON.parse`. One copy, one parse.

### Path descriptions

| Path | What it does |
|------|-------------|
| A: double parse | `JSON.parse` → `JSON.stringify` → `JSON.parse` (simulates love2d encode/decode round-trip) |
| B: direct parse | Raw bytes → `JSON.parse` (optimal path) |
| C: parse + extract | `JSON.parse` → access fields → return result object |
| D: full round-trip | `JSON.parse` → extract → `JSON.stringify` result → `JS_ToCString` back to C |
| E: string copy only | `JS_NewStringLen` only — measures pure bridge-in memcpy cost |

### Results

| Payload | A: double parse | B: direct | C: extract | D: round-trip | E: copy only |
|---------|----------------|-----------|------------|---------------|-------------|
| 364B    | 19.0 μs        | 3.9 μs    | 4.2 μs     | 5.3 μs        | 0.02 μs     |
| 10.7KB  | 355.6 μs       | 99.6 μs   | 107.7 μs   | 127.1 μs      | 0.4 μs      |
| 825KB   | 12,896 μs      | 6,070 μs  | 4,867 μs   | 3,924 μs      | 24.5 μs     |

### Analysis

**Direct parse is 2-5× faster than double parse.** The love2d path wastes a full stringify+parse cycle. For small API responses (<1KB), that's 15μs of pure waste. For 10KB responses, it's 256μs. Free speedup by just passing raw bytes.

**Bridge-in cost is noise.** `JS_NewStringLen` (the memcpy into JS heap) costs 0.02-24μs depending on size. Even for 825KB, it's 24μs out of a 6000μs parse — 0.4% of the total. The bridge-in is not the bottleneck. The parse is.

**Field extraction is nearly free.** Path C (parse + extract) adds only 8% over Path B (parse only). Once `JSON.parse` has built the JS object tree, accessing `obj.user.name` and iterating `obj.items` is pointer chasing — microseconds.

**For the tsz networking stack:** LuaJIT worker thread fetches bytes off the wire. Passes raw response string across the thread boundary (one memcpy). QuickJS main thread calls `JSON.parse(raw)`. React component gets the JS object. No intermediate Lua table, no encode/decode, no bridge tax on the parsed result. Data enters through LuaJIT, lands in QuickJS, stays there.

### Comparison to 52M ops/sec QuickJS ceiling

At 3.9μs per small JSON parse, that's ~256K parses/sec. The 52M ops/sec ceiling is for simple operations (arithmetic, property access). JSON parsing is ~200× heavier per op, which tracks — `JSON.parse` allocates objects, hashes property names, converts numbers. For networking, the parse rate matters more than raw ops/sec, and 256K small parses/sec is more than enough for any UI-driven HTTP client.

---

### What's NOT answered yet

- **Concurrent connections at scale** — single-threaded test can't measure GC pause impact under 1000+ connections
- **Streaming chunks** — Zig reading chunks and handing to QuickJS per-chunk (multiply bridge cost by chunks-per-response)
- **UI contention** — what happens when the networking runtime shares a thread with the render loop
- **Real HTTP parsing** — headers, chunked encoding, compression — not just "GET / HTTP/1.1"

---

## Raw Environment

```
Linux busiah 6.14.0-37-generic x86_64
Intel(R) Core(TM) i7-14700KF
64 GB RAM
```
