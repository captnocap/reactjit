# Native Devtools — Built in .tsz

## CRITICAL: Do NOT hand-write devtools UI in Zig

In the Love2D stack, devtools were pure Lua because they needed to survive a React crash.
**tsz has no React crash.** It either compiles or it doesn't. A running binary is stable.

**The devtools UI must be written in .tsz files** using the same primitives as any app
(Box, Text, Pressable, ScrollView, etc.). The ONLY Zig-level code is `telemetry.zig` —
the measurement module that wraps layout/paint timing. Everything else is .tsz components.

A tab bar is `<Pressable>` elements with conditional rendering. A sparkline is a row of
colored `<Box>` elements. A tree inspector is indented `<Text>` lines. A scrollable list
is `<ScrollView>`. Do not reinvent these in raw Zig — use the framework.

## What We're Building

The Love2D devtools (`love2d/lua/devtools/`) are ~3,700 lines of hand-drawn Lua UI.
The tsz version will be dramatically simpler because we use .tsz components, not hand-drawn rendering.

## Love2D Reference Files

| File | Lines | What it does |
|------|-------|-------------|
| `love2d/lua/devtools/main.lua` | 1,627 | Tab bar, panel chrome, pop-out IPC, input routing, Elements tab |
| `love2d/lua/devtools/tab_perf.lua` | 498 | Frame budget bar, sparkline (120-frame ring buffer), costliest nodes, RSS/FPS/memory |
| `love2d/lua/devtools/tab_wireframe.lua` | 514 | Scaled miniature viewport, depth coloring, flex pressure overlay |
| `love2d/lua/devtools/tab_logs.lua` | 383 | Debug channel toggles, HMR settings |
| `love2d/lua/devtools/tab_network.lua` | ~1,800 | HTTP/WS timeline, filtering, detail pane, curl export |
| `love2d/lua/devtools/tab_source.lua` | 293 | Live source editor, element-to-file mapping |
| `love2d/lua/devtools/style.lua` | 337 | Theme system with fallback dark palette |
| `love2d/lua/inspector.lua` | ~600 | FPS calculation, layout/paint timing, node counting, hover/select overlays |
| `love2d/lua/event_trail.lua` | ~100 | Semantic event recording (ring buffer, 60 events) |

## What tsz Already Has

| Component | File | Status |
|-----------|------|--------|
| RSS monitoring | `watchdog.zig` | Working — `getRssMb()` reads `/proc/self/statm` |
| Crash screen | `bsod.zig` | Working |
| Multi-window | `windows.zig` | Working — devtools can be a secondary SDL window |
| Text rendering | `text.zig` | Working — FreeType glyph cache |
| Layout engine | `layout.zig` | Working — can time layout pass |
| Painter | `main.zig` + templates | Working — can time paint pass |
| Hit testing | `events.zig` | Working — needed for inspector click-to-select |
| Node tree | `layout.zig` Node struct | Working — can walk for wireframe/inspector |

## tsz Advantage Over Love2D

Love2D devtools use **TCP IPC** (NDJSON over localhost sockets) to sync the pop-out window because child processes are separate Love2D instances. tsz uses `windows.zig` — **shared address space**. The devtools window reads the same node tree, same state, same telemetry directly. No serialization, no sync, no batching. This eliminates ~400 lines of IPC code from `main.lua`.

---

## Phase 0: Telemetry Foundation (no UI)

**New file: `tsz/runtime/telemetry.zig`**

Collects frame-by-frame performance data. No rendering — just measurement.

### What to measure

| Metric | How | Reference |
|--------|-----|-----------|
| **Layout time (ms)** | `SDL_GetPerformanceCounter()` before/after `layout.layout()` call | `love2d/lua/inspector.lua:387-403` — `beginLayout()`/`endLayout()` uses `love.timer.getTime()` |
| **Paint time (ms)** | Same, around `paintTree()` call | `love2d/lua/inspector.lua:405-411` — `beginPaint()`/`endPaint()` |
| **FPS** | Frame counter + `SDL_GetTicks()`, compute every 500ms | `love2d/lua/inspector.lua` — `state.fpsTimer` accumulator pattern |
| **RSS (MB)** | Reuse `watchdog.getRssMb()` — already reads `/proc/self/statm` | `love2d/lua/devtools/tab_perf.lua:262-272` — same `/proc/self/statm` source |
| **Node count** | Walk tree, count nodes | `love2d/lua/inspector.lua` — `countNodes(root)` recursive walk |
| **Frame history** | Ring buffer, 120 entries of `{ layout_ms, paint_ms, total_ms }` | `love2d/lua/devtools/tab_perf.lua:35-46` — `perfHistory` ring buffer, `perfHistoryIdx` wraps |

### Data structures

```zig
const HISTORY_SIZE = 120; // ~2 seconds at 60fps

const FrameSample = struct {
    layout_ms: f32,
    paint_ms: f32,
    total_ms: f32,
};

var history: [HISTORY_SIZE]FrameSample = [_]FrameSample{.{}} ** HISTORY_SIZE;
var history_idx: usize = 0;
var fps: f32 = 0;
var fps_frames: u32 = 0;
var fps_last_tick: u32 = 0;
var node_count: u32 = 0;
var last_layout_ms: f32 = 0;
var last_paint_ms: f32 = 0;
```

### API

```zig
pub fn beginLayout() void;   // record start time
pub fn endLayout() void;     // compute layout_ms
pub fn beginPaint() void;    // record start time
pub fn endPaint() void;      // compute paint_ms, record frame sample, update FPS
pub fn countNodes(root: *Node) u32;  // recursive count

// Getters
pub fn getFps() f32;
pub fn getLayoutMs() f32;
pub fn getPaintMs() f32;
pub fn getNodeCount() u32;
pub fn getHistory() []const FrameSample;  // returns the ring buffer
```

### Integration point

In the generated main loop (from `loop_template.txt` / `main_template.txt`):

```zig
// Before layout:
telemetry.beginLayout();
layout.layout(&root, 0, 0, win_w, win_h);
telemetry.endLayout();

// Before paint:
telemetry.beginPaint();
painter.paintTree(&root, 0, 0);
telemetry.endPaint();

// Count nodes (every 30 frames to avoid overhead)
if (frame_count % 30 == 0) telemetry.countNodes(&root);
```

**Files changed:** `tsz/runtime/telemetry.zig` (new), `tsz/compiler/codegen.zig` (emit timing hooks), `tsz/compiler/loop_template.txt` (timing calls)

**Verification:** Build and run any tsz app, telemetry prints to stdout every 60 frames:
```
[telemetry] FPS: 60.0 | Layout: 0.12ms | Paint: 0.34ms | Nodes: 12 | RSS: 18MB
```

---

## Phase 1: Status Bar Component

**New file: `tsz/devtools/StatusBar.tsz`** (a .tsz component, NOT hand-written Zig)

A status bar component that reads from `telemetry.zig` via built-in getters.

```tsx
function StatusBar() {
  const [fps, setFps] = useState(0);
  const [layoutMs, setLayoutMs] = useState(0);
  const [paintMs, setPaintMs] = useState(0);
  const [nodes, setNodes] = useState(0);
  const [rss, setRss] = useState(0);

  // Poll telemetry every 500ms
  useEffect(() => {
    setFps(getFps());
    setLayoutMs(getLayoutMs());
    setPaintMs(getPaintMs());
    setNodes(getNodeCount());
    setRss(getRssMb());
  }, 500);

  return (
    <Box style={{ flexDirection: 'row', height: 22, backgroundColor: '#1a1a2e', padding: 4, gap: 16 }}>
      <Text fontSize={12} color={fps >= 55 ? '#4ec9b0' : fps >= 30 ? '#dcdcaa' : '#f44747'}>{`FPS: ${fps}`}</Text>
      <Text fontSize={12} color="#888888">{`Layout: ${layoutMs}ms`}</Text>
      <Text fontSize={12} color="#888888">{`Paint: ${paintMs}ms`}</Text>
      <Text fontSize={12} color="#888888">{`Nodes: ${nodes}`}</Text>
      <Text fontSize={12} color="#888888">{`RSS: ${rss}MB`}</Text>
    </Box>
  );
}
```

The only Zig needed: expose `getFps()`, `getLayoutMs()`, etc. as built-in functions
the compiler recognizes (like `getText()` for TextInput). These read from `telemetry.zig`.

**Files changed:** `tsz/devtools/StatusBar.tsz` (new .tsz component), `tsz/compiler/codegen.zig` (recognize telemetry getters as built-ins)

**Verification:** Import StatusBar into any app, see live metrics.

---

## Phase 2: Devtools Panel Shell

**New file: `tsz/devtools/DevtoolsPanel.tsz`** — a .tsz component, NOT Zig

```tsx
function DevtoolsPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const [panelHeight, setPanelHeight] = useState(300);

  return (
    <Box style={{ height: panelHeight, backgroundColor: '#1a1a2e', flexDirection: 'column' }}>
      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', height: 26, backgroundColor: '#12121e', gap: 0 }}>
        <Pressable onPress={() => setActiveTab(0)} style={{ padding: 8 }}>
          <Text fontSize={12} color={activeTab == 0 ? '#ffffff' : '#666666'}>Perf</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab(1)} style={{ padding: 8 }}>
          <Text fontSize={12} color={activeTab == 1 ? '#ffffff' : '#666666'}>Elements</Text>
        </Pressable>
      </Box>

      {/* Tab content — conditional rendering (already works!) */}
      {activeTab == 0 && <PerfTab />}
      {activeTab == 1 && <ElementsTab />}

      {/* Status bar at bottom */}
      <StatusBar />
    </Box>
  );
}
```

This uses **existing primitives**: Box, Text, Pressable, conditional rendering, useState.
No hand-drawn Zig UI. The framework IS the devtools framework.

Reference: `love2d/lua/devtools/main.lua` lines 66-92 — same concept, but Love2D had to draw everything by hand because it couldn't use React (crash safety). We don't have that constraint.

---

## Phase 3: Perf Tab

**New file: `tsz/devtools/PerfTab.tsz`** — .tsz component

### Sparkline

120 thin `<Box>` elements in a row, each with height proportional to frame time and color based on budget:

```tsx
function Sparkline() {
  // Read frame history from telemetry (built-in getter)
  // Render as colored boxes
  return (
    <Box style={{ flexDirection: 'row', height: 60, alignItems: 'end', gap: 1 }}>
      {/* Each bar is a Box with computed height and color */}
    </Box>
  );
}
```

### Frame budget bar

A `<Box>` with width proportional to `(layoutMs + paintMs) / 16.6`:
- Green background if <80% budget
- Yellow if 80-100%
- Red if >100%

### Stats row

`<Text>` elements showing FPS, node count, RSS — same as StatusBar but with more detail.

Reference: `love2d/lua/devtools/tab_perf.lua:151-280` — same data, but rendered with Box/Text instead of love.graphics calls.

**Note:** The sparkline needs `.map()` or a compile-time loop to generate 120 boxes. If `.map()` isn't landed yet, a fixed set of boxes with useEffect updating their heights works too.

---

## Phase 4: Wireframe Tab

**New file: `tsz/devtools/WireframeTab.tsz`** — .tsz component

Needs a **built-in function** to walk the node tree and return computed bounds:
`getNodeTree()` → array of `{ x, y, w, h, depth, hasText, childCount }`

The wireframe renders these as scaled `<Box>` elements with depth-colored borders.

This is the one tab where a Zig-side helper is needed — not for rendering, but for **tree introspection**. The .tsz component calls `getNodeTree()`, gets data, renders boxes.

Reference: `love2d/lua/devtools/tab_wireframe.lua` — same concept, 514 lines of Lua drawing. The .tsz version would be much shorter.

---

## Phase 5: Elements/Inspector Tab

**New file: `tsz/devtools/ElementsTab.tsz`** — .tsz component

### Left panel: Node tree

`<ScrollView>` containing indented `<Text>` lines. Each line is a `<Pressable>`:
```tsx
<Pressable onPress={() => selectNode(nodeId)}>
  <Text fontSize={12} color="#cccccc">{`${"  ".repeat(depth)}▶ Box (${w}×${h})`}</Text>
</Pressable>
```

### Right panel: Properties

Selected node's properties displayed as `<Text>` key-value pairs in a `<ScrollView>`.

### Canvas overlay

This is the ONE place that needs Zig-level rendering — drawing a highlight rectangle
over the app's canvas at the selected node's computed bounds. This is a single
`SDL_RenderDrawRect` call in the main loop, gated by a "selected node" state variable.

Reference: `love2d/lua/inspector.lua` overlay drawing — same single-rect overlay.

---

## Phase 6: Pop-out Window

The devtools panel as a `<Window>` element (multi-window already works!):

```tsx
{poppedOut && (
  <Window title="DevTools" width={800} height={400}>
    <DevtoolsPanel />
  </Window>
)}
```

Shared address space means the devtools window reads the same telemetry and node tree directly. No IPC needed — this is just conditional rendering of a `<Window>`.

Reference: `love2d/lua/devtools/main.lua` pop-out — 400 lines of TCP IPC code that we don't need.

---

## Deferred Tabs

| Tab | Why deferred | What's needed first |
|-----|-------------|-------------------|
| **Network** | No HTTP/WS infrastructure in tsz | Socket library, request tracking |
| **Source** | No file-to-node mapping | `debugSource` metadata in compiler, file watcher |
| **Logs** | No debug channel system | Log levels, channel registry |
| **Console** | No REPL | Expression evaluator, output capture |

These become relevant as the corresponding infrastructure is built.

---

## Files

| File | Type | What |
|------|------|------|
| `tsz/runtime/telemetry.zig` | **Zig** | Measurement only — timing hooks, ring buffer, getters |
| `tsz/devtools/StatusBar.tsz` | **.tsz** | Status bar component |
| `tsz/devtools/DevtoolsPanel.tsz` | **.tsz** | Panel shell with tab bar |
| `tsz/devtools/PerfTab.tsz` | **.tsz** | Sparkline, budget bar, stats |
| `tsz/devtools/WireframeTab.tsz` | **.tsz** | Scaled node rectangles |
| `tsz/devtools/ElementsTab.tsz` | **.tsz** | Tree view + property panel |
| `tsz/compiler/codegen.zig` | **Zig** | Recognize telemetry getters as built-ins |

**Rule: Only `telemetry.zig` and built-in getter wiring are Zig. All UI is .tsz.**

## Implementation Order for Agents

| Agent | Phases | Files |
|-------|--------|-------|
| A: Telemetry + built-in getters | 0 | `telemetry.zig`, `codegen.zig` (register getFps/etc as built-ins) |
| B: Panel + Perf + Status | 1, 2, 3 | `StatusBar.tsz`, `DevtoolsPanel.tsz`, `PerfTab.tsz` |
| C: Wireframe + Elements | 4, 5 | `WireframeTab.tsz`, `ElementsTab.tsz` |

**Agent A must complete first** — B and C need the telemetry getters.
B and C can parallel after A (independent .tsz components).
Phase 6 (pop-out) is trivial once tabs work — just wrap in `<Window>`.

## Verification

```bash
# Phase 0:
zig build engine-app && ./zig-out/bin/tsz-app
# Should print telemetry to stdout

# Phase 1:
# Press F12 → status bar with live FPS/timing

# Phase 2+:
# Press F12 → full panel with tabs
# Click Perf tab → sparkline and budget bar
# Click Wireframe → miniature node view
# Click Elements → tree inspector
```
