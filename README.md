# ReactJIT

Write React. Get a native binary. No runtime, no interpreter, no garbage collector.

```
app.tsz (TypeScript + JSX)
   |
   v
zigos-compiler (hand-written Zig, 17K lines)
   |
   v
generated Zig source (layout + GPU paint + events + state)
   |
   v
native binary (SDL2 + wgpu + FreeType + QuickJS)
```

```tsx
const [count, setCount] = useState(0);

function App() {
  return (
    <Box style={{ padding: 32, gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Pressable onPress={() => { setCount(count + 1) }}
        style={{ padding: 16, backgroundColor: '#4ec9b0', borderRadius: 8 }}>
        <Text fontSize={16} color="#ffffff">+ Increment</Text>
      </Pressable>
    </Box>
  );
}
```

That's the entire app. Compiles to a native binary.

---

## The Stack

### Compiler (`experiments/zigos/compiler/`)

Hand-written lexer + parser + codegen in pure Zig. 23 modules, ~17K lines. Compiles `.tsz` files (TypeScript + JSX) to Zig source that links against the framework.

```bash
cd experiments/zigos
zig build compiler                                  # Build the compiler
./zig-out/bin/zigos-compiler build cart.tsz          # Compile + build a cart
./zig-out/bin/zigos-compiler check cart.tsz          # Compile + validate only
```

Features:
- Components with props (`function Card(title, value) { ... }`)
- `useState` with reactive state slots
- `useEffect` with interval timers
- `.map()` on object arrays with item/index capture
- Conditional rendering (`{x == 1 && <Box>...</Box>}`)
- Template literals (`` {`${count} items`} ``)
- Classifiers (`.cls.tsz` — styled component shorthand)
- Script imports (`.script.tsz` — QuickJS for dynamic data)
- HTML tag support (`<div>`, `<span>`, `<p>`, `<h1>`-`<h6>` map to primitives)
- FFI via `@cImport` pragmas
- 1600-line-per-file enforced limit

### Framework (`experiments/zigos/framework/`)

41 Zig modules. The runtime that compiled apps link against.

- **GPU renderer** — wgpu-based pipeline: SDF text, rounded rects, borders, shadows, images, video
- **Layout engine** — Flexbox (1400 lines), CSS-spec-aligned, WPT-tested
- **Text** — FreeType rasterizer + SDF glyph atlas + text measurement
- **Events** — Hit testing, click/hover/scroll, keyboard input, text selection
- **State** — Compile-time reactive slots, dirty tracking
- **QuickJS bridge** — JS runtime for dynamic data (object arrays, setInterval, telemetry)
- **Networking** — HTTP client/server, WebSocket client/server, IPC, SOCKS5, Tor
- **Multi-window** — SDL2 multi-window, shared state
- **Inspector** — Built-in devtools (element tree, style inspector, performance profiler)
- **Canvas** — Graph/node rendering with SVG path support
- **Video** — libmpv integration via OpenGL render API

### Networking (`framework/net/`)

Full network stack, all pure Zig:

| Module | What |
|--------|------|
| `http.zig` | HTTP client |
| `httpserver.zig` | HTTP server |
| `websocket.zig` | WebSocket client (RFC 6455) |
| `wsserver.zig` | WebSocket server (multi-client, broadcast) |
| `ipc.zig` | Inter-process communication |
| `socks5.zig` | SOCKS5 proxy client |
| `tor.zig` | Tor integration |
| `manager.zig` | Connection manager |

### Love2D Stack (`love2d/`)

The original proof of concept. React reconciler → QuickJS → Lua layout → Love2D painter. Mature, full-featured: 30+ packages, storybook, HMR, test runner, CLI with `rjit convert` (HTML div-soup → ReactJIT converter), theme system, 3D, audio, terminal emulator, and more. The native engine ports features from here.

---

## Primitives

`Box` `Text` `Image` `Pressable` `ScrollView` `TextInput`

Also accepts HTML tags: `div` `span` `p` `h1`-`h6` `button` `section` `nav` `header` `footer` `img` `input` — mapped to the above primitives automatically.

## Carts

Apps are called "carts." Each is a `.tsz` entry point with optional component files (`_c.tsz`), classifiers (`_cls.tsz`), and scripts (`.script.tsz`).

```
carts/
  storybook/          Component catalog + theme demo
  inspector/          Built-in devtools (element tree, styles, perf)
  dashboard/          Dashboard demo
  charts/             Chart library (area, bar, candlestick, pie, radar, ...)
  effect-bench/       Stress tests (57M+ bridge calls/s, 5000+ node layout)
  conformance/        Compiler conformance suite (16 tests, SHA256-locked)
  wpt-flex/           W3C Web Platform Tests for flexbox (50 tests)
  autobahn-ws/        Autobahn WebSocket conformance harness
  pty-test/           Terminal emulator
  constraint-graph/   Constraint graph visualization
  video-test/         Video playback demo
```

## Conformance Testing

### Compiler Conformance (`carts/conformance/`)

16 SHA256-locked test files — real React app ports (ecommerce dashboard, admin panel, Jira board) and destructive pattern tests (nested maps, map-inside-component-inside-map, evil kanban, schema form). Files are immutable. Fix the compiler, not the tests.

```bash
bash carts/conformance/run_conformance.sh
```

### WPT Flexbox (`carts/wpt-flex/`)

50 tests ported from the W3C Web Platform Tests for CSS Flexbox. Tests use `<div>` tags directly. Covers direction, justify, align, grow, shrink, wrap, gap, padding, margin, nesting, percentage sizing, min/max constraints.

```bash
bash carts/wpt-flex/run_wpt.sh
```

### Stress Tests (`carts/effect-bench/`)

- **StressMapBridge** — 57M+ setState calls/s while rendering 5000+ nodes
- **StressMap500** — Escalating map items (100 → 4096), layout + paint profiling
- **StressJS500 / StressZig1000** — Bridge throughput benchmarks

```bash
ZIGOS_VSYNC=0 ./zig-out/bin/StressMapBridge    # Uncapped framerate
```

## Build

```bash
cd experiments/zigos

# Build everything
zig build compiler                    # The .tsz compiler
zig build app                        # Default app (generated_app.zig)

# Build a specific cart
./zig-out/bin/zigos-compiler build carts/storybook/Storybook.tsz

# Run it
./zig-out/bin/Storybook
```

## Performance

At 4096 mapped items (5139 visible nodes):
- Layout: ~3.3ms
- Paint: ~260us
- Bridge: 57M setState calls/s with zero impact on layout

```
[telemetry] FPS: 258 | layout: 3268us | paint: 263us | visible: 5139 | bridge: 57671729/s
```

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
