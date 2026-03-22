# ReactJIT

Write React. Get a native binary. No runtime, no interpreter, no garbage collector.

```
app.tsz (TypeScript + JSX)
   |
   v
tsz compiler (hand-written Zig, 19K lines)
   |
   v
generated Zig source (layout + GPU paint + events + state)
   |
   v
native binary (SDL2 + wgpu + FreeType + QuickJS)
```

```tsx
// ── State — standard React useState, lives at the top level ──
const [count, setCount] = useState(0);
const [fps, setFps] = useState(0);

// ── useEffect — same as React, but compiles to native Zig ──
useEffect(() => {
  setCount(count + 1);
});

// ── <script> — inline JS that runs in QuickJS at runtime ──
<script>
setInterval(function() {
  setFps(getFps());
}, 250);
</script>

// ── <zscript> — inline Zig emitted directly into the binary ──
<zscript>
fn computeHeavy(n: i64) i64 {
    var sum: i64 = 0;
    var i: i64 = 0;
    while (i < n) : (i += 1) sum += i;
    return sum;
}
</zscript>

// ── JSX — your UI, same syntax as React ──
function App() {
  return (
    <Box style={{ padding: 32, gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Text fontSize={12} color="#8b949e">{`${fps} fps`}</Text>
      <Pressable onPress={() => { setCount(count + 1) }}
        style={{ padding: 16, backgroundColor: '#4ec9b0', borderRadius: 8 }}>
        <Text fontSize={16} color="#ffffff">+ Increment</Text>
      </Pressable>
    </Box>
  );
}
```

That's one file. State, effects, JS scripting, native Zig, and JSX — all compile to a single native binary.

---

## Three Pillars

### `tsz/` — Compiler + Framework (active)

The `.tsz` compiler and native rendering framework. A hand-written lexer, parser, and multi-phase codegen in pure Zig compiles TypeScript + JSX into Zig source that links against the framework runtime.

- **Compiler** — 23 modules, ~19K lines. Components, useState, useEffect, .map(), conditionals, template literals, classifiers, script imports, HTML tags, FFI
- **GPU renderer** — wgpu pipeline: SDF text, rounded rects, borders, shadows, images, video, 3D (Blinn-Phong), custom effects
- **Layout engine** — Flexbox (1400 lines), CSS-spec-aligned, WPT-tested
- **Networking** — HTTP client/server, WebSocket client/server, IPC, SOCKS5, Tor — all pure Zig
- **Cryptography** — HMAC-SHA256 (RFC 4231), HKDF-SHA256 (RFC 5869), Shamir Secret Sharing (GF256), XChaCha20-Poly1305 envelope encryption, PII detection + sanitization
- **Physics** — Box2D 2.4.1 integration for 2D rigid body simulation
- **3D** — Inline 3D viewports with camera, lights, and mesh primitives (box, sphere, plane, cylinder)
- **Terminal** — PTY terminal emulator with cell-grid rendering, scrollback, text selection, copy/paste (Ctrl+Shift+C/V), semantic classifiers
- **Canvas** — Infinite canvas with zoom/pan/drift, SVG path nodes, graph visualization
- **Inspector** — Built-in devtools: element tree, style inspector, performance profiler, constraint graph
- **Transitions** — CSS-style animations with timing and spring physics
- **Themes** — 19 built-in themes: Dracula, Catppuccin, Nord, Gruvbox, Solarized, Tokyo Night, One Dark, Monokai, GitHub, Rosé Pine, Everforest, Kanagawa, Ayu, Synthwave, Palenight, Material, Night Owl + custom BIOS and Win95 themes

### `love2d/` — Lua Reference Stack

The original proof of concept. React reconciler → QuickJS → Lua layout → Love2D painter. Mature, full-featured: 30+ packages, storybook, HMR, test runner, CLI with `rjit convert`, theme system, 3D, audio, terminal emulator. The native engine ports features from here.

### `os/` — CartridgeOS + Exodia (future)

Operating system shell and app distribution layer. CartridgeOS manages windows, permissions, and app lifecycle. Exodia is the network layer for cart distribution and discovery.

---

## What Are .tsz Files?

`.tsz` is TypeScript + JSX that compiles to native code. No bundler, no transpiler chain — one compiler, one output.

| Extension | What | Example |
|-----------|------|---------|
| `.tsz` | App entry point | `Counter.tsz` |
| `.c.tsz` | Component | `Button.c.tsz` |
| `.mod.tsz` | Runtime module → `.gen.zig` | `state.mod.tsz` |
| `.cmod.tsz` | Component module | `Badge.cmod.tsz` |
| `.script.tsz` | QuickJS runtime script | `data.script.tsz` |
| `.zscript.tsz` | JS script that compiles to Zig | `logic.zscript.tsz` |
| `.cls.tsz` | Shared styles/classifiers | `styles.cls.tsz` |

### `<script>` vs `<zscript>` — when to use which

Both let you drop out of JSX into imperative code. The difference is where it runs.

| | `<script>` / `.script.tsz` | `<zscript>` / `.zscript.tsz` |
|---|---|---|
| **Runs in** | QuickJS (JS runtime) | Native Zig (compiled into binary) |
| **When** | Runtime — after app starts | Compile time — baked into the binary |
| **Good for** | Timers, async fetches, dynamic data, mock data | Performance-critical math, tests, FFI, framework access |
| **Speed** | Fast enough for UI logic | 57M ops/sec on the bridge (`8b7451b1`) |

We benchmarked both paths extensively. The JS bridge does 52M setState calls/sec before any FPS drop (`8b7451b1`). But for tight loops, FFI, and anything that needs direct access to Zig's type system, `<zscript>` compiles to zero-overhead native code — no bridge, no QuickJS, no serialization.

Key commits:
- `f662eb0d` — FFI option 1: JS host functions, proved the bridge works but showed overhead for tight FFI
- `8b7451b1` — Bridge benchmark: 52M calls/sec, proved JS→Zig bridge is not a bottleneck
- `3c7b6b78` — `<zscript>` inline Zig blocks, for when you need zero overhead
- `205e2505` — `_zscript.tsz` imperative mode, compiles TypeScript-like code directly to `.zig` modules

### `<script>` — JS at runtime (QuickJS)

Inline JavaScript that runs in the QuickJS runtime. Use for timers, async data, or anything dynamic.

```tsx
<script>
setInterval(function() {
  setFps(getFps());
  setLayoutUs(getLayoutUs());
  setPaintUs(getPaintUs());
}, 250);
</script>
```

### `.script.tsz` — JS as a file

Same as `<script>` but in its own file. Good for mock data, initialization logic, or separating runtime behavior from layout.

```js
// dashboard.script.tsz
var items = [
  { title: 'Customers', amount: '39,354', percentage: '-4%' },
  { title: 'Products', amount: '4,396', percentage: '+23%' },
];
setEarningData(items);
```

### `<zscript>` — Zig at compile time

Inline Zig code emitted directly into the generated source. Runs at native speed. Use for performance-critical logic, test functions, or direct framework access.

```tsx
<zscript>
fn test_counter_increments() !void {
    const state = @import("state.zig");
    state.setSlot(0, 42);
    try std.testing.expectEqual(@as(i64, 42), state.getSlot(0));
}
</zscript>
```

### `.zscript.tsz` — Zig as a file

Standalone imperative Zig module — no JSX, compiles TypeScript-like code directly to a `.zig` module. Use for utility modules, math, data processing, or anything that should be pure native Zig with no runtime overhead.

## Quick Start

```bash
cd tsz

# Build the compiler
zig build compiler

# Compile and build a cart
./zig-out/bin/zigos-compiler build carts/storybook/Storybook.tsz

# Run it
./zig-out/bin/Storybook
```

## Primitives

`Box` `Text` `Image` `Pressable` `ScrollView` `TextInput` `TextArea` `Graph`

Also accepts HTML tags: `div` `span` `p` `h1`-`h6` `button` `section` `nav` `header` `footer` `img` `input` — mapped to primitives automatically.

## Carts

Apps are called "carts." Each is a `.tsz` entry point with optional components, classifiers, and scripts.

```
carts/
  storybook/          Component catalog + infinite canvas + theme demo
  inspector/          Built-in devtools (element tree, styles, perf)
  dashboard/          Dashboard demo
  charts/             Chart library (area, bar, candlestick, pie, radar, graph, ...)
  browser/            In-app web content renderer
  terminal/           PTY terminal emulator with scrollback + selection
  crypto-test/        Cryptography test suite (HMAC, HKDF, Shamir, encryption, PII)
  scene3d-demo/       3D rendering demo
  constraint-graph/   Constraint graph visualization
  animations/         Animation and physics demos
  effects/            Visual effects demos
  effect-bench/       Stress tests (57M+ bridge calls/s, 5000+ node layout)
  conformance/        Compiler conformance suite (16 tests, SHA256-locked)
  wpt-flex/           W3C Web Platform Tests for flexbox (70 tests)
  autobahn-ws/        Autobahn WebSocket conformance (202/204 cases pass)
  http-conformance/   HTTP conformance test harness
  ws-conformance/     WebSocket conformance tests
  ipc-conformance/    IPC conformance tests
  socks5-conformance/ SOCKS5 conformance tests
```

## Framework Modules

51 modules in the framework runtime:

| Category | Modules |
|----------|---------|
| Core | engine, state, events, input, layout, text, geometry, math |
| Rendering | render_surfaces, render_surfaces_vm, effects, easing, transition, canvas, svg_path |
| UI | theme, classifier, selection, tooltip, router, query, windows |
| Terminal | pty, vterm, semantic |
| Networking | http, httpserver, websocket, wsserver, ipc, socks5, tor |
| Media | player, videos, recorder, capture |
| Data | fs, fswatch, sqlite, localstore, archive, crypto, privacy |
| Dev | devtools, devtools_state, telemetry, log, testharness, testdriver, testassert |
| System | process, child_engine, qjs_runtime, physics2d, filedrop, breakpoint |

## Conformance

| Suite | Score | What |
|-------|-------|------|
| Autobahn WebSocket | 202/204 | RFC 6455 compliance |
| WPT Flexbox | 70 | W3C CSS flex spec |
| Compiler | 16 | Real React app ports + destructive pattern tests |
| Crypto | 13/13 | HMAC, HKDF, Shamir, encryption, PII detection |

## Performance

At 4096 mapped items (5139 visible nodes):
- Layout: ~3.3ms
- Paint: ~260us
- Bridge: 57M setState calls/s with zero impact on layout

```
[telemetry] FPS: 258 | layout: 3268us | paint: 263us | visible: 5139 | bridge: 57671729/s
```

## `archive/` Purpose

`archive/` contains `tsz/` (v1) and `tsz-gen/` (v2) — earlier iterations of the compiler and runtime. These are frozen references, not active code. The v1 stack was a hand-written Zig runtime. The v2 stack added `.mod.tsz → .gen.zig` compilation. Both are superseded by the current `tsz/` (v3) which has the multi-phase compiler, QuickJS bridge, inspector, and full networking stack.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
