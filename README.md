# ReactJIT

Write React. Get a native binary. Your UI compiles to native code — no virtual DOM, no reconciler, no garbage collector. QuickJS is embedded for optional `<script>` blocks (dynamic logic, timers, data), but your components, layout, and rendering are all compiled Zig.

```
app.tsz (TypeScript + JSX)
   |
   v
tsz compiler (hand-written Zig, 25K lines)
   |
   v
generated Zig source (layout + GPU paint + events + state)
   |
   v
native binary (SDL3 + wgpu + FreeType + QuickJS + LuaJIT)
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

The `.tsz` compiler and native rendering framework. TypeScript + JSX compiles to Zig source that links against the framework runtime.

The compiler is split into two parts:

- **Forge** — small Zig kernel (~300 lines). Lexer, QuickJS bridge, file I/O. Built once, rarely changes. Tokenizes `.tsz` source and hands flat token arrays to Smith.
- **Smith** — JS compiler intelligence (~1,600 lines across 5 files) running inside Forge via QuickJS. All parse, codegen, and emit logic lives here. Edit without rebuilding Forge.

```
app.tsz → [Forge: lex] → tokens → [Smith: parse + emit] → .zig source → native binary
```

Smith handles the cases Zig can't. The canonical example is `.map()` handlers: Zig has no closures, so each map item can't carry its own handler with a captured index. Smith's solution — emit a `LUA_LOGIC` block of Lua functions (`__mapPress_0_0(idx)`) and during the rebuild loop, pre-format a `lua_on_press` string per item with the index baked in (`"__mapPress_0_0(3)"`). LuaJIT executes the function string at runtime. The Zig side only stores the string — no closure needed.

This is the general routing rule: statically-bound logic compiles to Zig; logic that needs runtime capture (indexes, closures, dynamic dispatch) routes to LuaJIT via `LUA_LOGIC`. `<script>` blocks use QuickJS for the same reason. The compiler picks the backend; the author writes plain `.tsz`.

- **Compiler** — 6 Zig modules + 5 JS modules (Smith). Components, useState, useEffect, .map(), conditionals, template literals, classifiers, script imports, HTML tags, FFI, lscript/LuaJIT
- **GPU renderer** — wgpu pipeline: SDF text, rounded rects, borders, shadows, images, video, 3D (Blinn-Phong), custom effects
- **Layout engine** — Flexbox (1400 lines), CSS-spec-aligned, WPT-tested
- **Networking** — HTTP client/server, WebSocket client/server, IPC, SOCKS5, Tor — all pure Zig
- **Cryptography** — HMAC-SHA256 (RFC 4231), HKDF-SHA256 (RFC 5869), Shamir Secret Sharing (GF256), XChaCha20-Poly1305 envelope encryption, PII detection + sanitization
- **Physics** — Box2D 2.4.1 (2D) and 3D rigid body simulation
- **3D** — Inline 3D viewports with camera, lights, and mesh primitives (box, sphere, plane, cylinder)
- **Audio** — SDL3 audio subsystem with modular DSP engine, delay, sequencer, LuaJIT DSP bridge
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

### `<script>` vs `<lscript>` vs `<zscript>` — when to use which

Three script runtimes, each with different tradeoffs.

| | `<script>` / `.script.tsz` | `<lscript>` | `<zscript>` / `.zscript.tsz` |
|---|---|---|---|
| **Runs in** | QuickJS (JS runtime) | LuaJIT (main-thread VM) | Native Zig (compiled into binary) |
| **When** | Runtime — after app starts | Runtime — after app starts | Compile time — baked into the binary |
| **Good for** | Timers, async fetches, dynamic data, mock data | Performance-sensitive logic, DSP, hot paths | Performance-critical math, tests, FFI, framework access |
| **Speed** | 52M ops/sec — hits the wall there | Faster than QuickJS, JIT-compiled | No ceiling — native Zig, keeps scaling |

We benchmarked both paths extensively. The JS bridge does 52M setState calls/sec with zero FPS impact (`8b7451b1`) — JS is not the slow path. Both `<script>` and `<zscript>` perform identically up to ~50M ops. The difference only shows up past that mark: JS plateaus while Zig keeps scaling. For anything under 50M ops/sec (which is virtually every UI app), use whichever is more convenient. Use `<zscript>` when you need direct Zig type system access, FFI, or you're genuinely past the 50M threshold.

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
zig build tsz              # Lean compiler → bin/tsz
zig build tsz-full         # Full compiler → bin/tsz-full

# Build a cart
bin/tsz build carts/storybook/Storybook.tsz

# Or use hot-reload dev mode (63x faster iteration)
bin/tsz dev carts/storybook/Storybook.tsz
```

## Primitives

`Box` `Text` `Image` `Video` `Render` `Pressable` `ScrollView` `TextInput` `TextArea` `Glyph` `Cartridge`

System surfaces: `Canvas` `Graph` `Physics` `Scene3d` `ThreeD` `Effect` `Terminal` `Audio`

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
  benchmarks/         Subsystem benchmarks (layout, render, state, script)
  stress-test/        Progressive load across all subsystems
  parity/             React parity demos (TodoMVC, Slack, VS Code, Gmail, Figma, ...)
  flatworld/          Flatworld exploration cart
  audio-ui/           Synth cart with full audio interface
  supervisor-dashboard/ Task board, terminal, search, violations
  semantic-terminal/  Terminal with classifier overlay
  themes/             Theme showcase
  theme-creator/      Interactive theme builder
  hackernews/         HackerNews client demo
  remote-chat/        WebSocket chat demo
  world3d-demo/       3D physics + world rendering demo
  conformance/        Compiler conformance suite (283 tests)
  wpt-flex/           W3C Web Platform Tests for flexbox (70 tests)
  autobahn-ws/        Autobahn WebSocket conformance (202/204 cases pass)
  http-conformance/   HTTP conformance test harness
  ws-conformance/     WebSocket conformance tests
  ipc-conformance/    IPC conformance tests
  socks5-conformance/ SOCKS5 conformance tests
```

## Framework Modules

77 modules in the framework runtime:

| Category | Modules |
|----------|---------|
| Core | engine, state, events, input, layout, text, geometry, math, random |
| Rendering | render_surfaces, render_surfaces_vm, effects, effect_ctx, effect_shader, easing, transition, canvas, svg_path, blend2d, vello |
| UI | theme, classifier, selection, tooltip, context_menu, router, query, windows |
| Cartridge | cartridge, cartpack, dev_shell, devtools, devtools_state |
| Terminal | pty, pty_client, pty_remote, vterm, semantic |
| Networking | http, httpserver, websocket, wsserver, ipc, qjs_ipc, socks5, tor |
| Media | audio, player, videos, recorder, capture |
| Data | fs, fswatch, sqlite, localstore, archive, crypto, privacy |
| Scripting | qjs_runtime, luajit_runtime, luajit_worker |
| Dev | telemetry, log, log_export, testharness, testdriver, testassert, debug_client, debug_server |
| System | process, child_engine, physics2d, physics3d, filedrop, breakpoint, crashlog |

## Conformance

| Suite | Score | What |
|-------|-------|------|
| Autobahn WebSocket | 202/204 | RFC 6455 compliance |
| WPT Flexbox | 70/70 | W3C CSS flex spec |
| Compiler conformance suite | 159/283 | Language features, script runtimes, maps, components, integration |
| Smith conformance (vs OG Zig) | 89/112 | Forge+Smith output parity against the reference Zig compiler |
| Surface conformance | 0/105 | Three-tier UI + logic tests (soup/mixed/chad) |
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

## Design Philosophy: Postel's Law

**Be conservative in what you send, be liberal in what you accept.**

The compiler accepts anything — HTML divs, `onClick`, `className`, CSS imports, inline styles, React patterns. If a 1.5B parameter model generates soup, it should still compile and render. The framework is liberal in what it accepts.

But the golden path is conservative. First-party code uses strict semantic zones, theme tokens, named shapes, and classifier-driven views. The framework's own code is the style guide.

### Three Tiers

Every surface conformance test exists in three versions that produce identical output:

| Tier | File | What it proves |
|------|------|----------------|
| **Soup** | `s01a_counter.tsz` | Real model output (Qwen 1.5B, zero context). Tests compiler resilience — HTML tags, DOM patterns, CSS hallucinations. Slowest compile path. |
| **Mixed** | `s01b_counter.tsz` | Uses framework primitives (Box, Text, Pressable) with inline styles. Tests today's API surface. Medium compile path. |
| **Chad** | `s01c_counter.tsz` | Classifiers, script blocks, theme tokens, named resources. The golden path. Fastest compile path — preflight detects the clean structure and skips HTML mapping, style validation, and event normalization entirely. |

The tier system isn't just readability. It's compiler architecture. Clean code compiles faster because the compiler does less work. The framework literally rewards you with speed for following the golden path.

### File Taxonomy (Chad Tier)

```
app.tsz           — the page/widget (structure + logic + view)
app.cls.tsz       — base classifiers (what components ARE)
app.tcls.tsz      — theme tokens (colors, spacing, radii)
app.vcls.tsz      — variants (per-theme structural overrides)
app.effects.tsz   — named effect sources (GPU pixel shaders)
app.glyphs.tsz    — named inline assets (vector shapes, compositions)
```

### Intent Syntax (Future)

The chad tier is evolving toward an intent-driven syntax where file structure dictates compiler behavior:

```
<page route=notes>
  <var>
    input is ''
    notes
    count is 0
  </var>

  <state>
    set_input
    set_notes
    set_count
  </state>

  <functions>
    addNote:
      input exact '' ? stop : go
      set_notes to notes.concat([input])
      set_count to count + 1
      set_input to ''
  </functions>

  return(
    <C.Page>
      <C.Title>Notes</C.Title>
      <For each=notes>
        <C.ListItem><C.Body>{item}</C.Body></C.ListItem>
      </For>
    </C.Page>
  )
</page>
```

Each `<tag>` is a parser scope — the compiler switches to a minimal grammar per zone. `<var>` only parses declarations. `<state>` only parses setter names. `<functions>` parses linear chains with guards (`? stop : go`) and composition (`submit = saveCustomer + clearForm`). The return block is pure JSX with classifiers. No ambiguity, no surprises, linear top-to-bottom comprehension.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
