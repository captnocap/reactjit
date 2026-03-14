# Native Devtools — Port from Love2D

## What We're Porting

The Love2D devtools (`love2d/lua/devtools/`) are ~3,700 lines of Lua across 8 files with 7 tabs, live telemetry, pop-out window support, and an inspector overlay system. This is a phased port — each phase is independently useful.

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

## Phase 1: Status Bar Overlay

**New file: `tsz/runtime/devtools.zig`** (starts small, grows in later phases)

A single-line HUD at the bottom of the window showing live metrics. Toggled with F12.

### What it shows

```
FPS: 60 | Layout: 0.12ms | Paint: 0.34ms | Nodes: 12 | RSS: 18MB | 800x600
```

Reference: `love2d/lua/devtools/main.lua` status bar — 22px tall, bottom of panel. Shows FPS (green if ≥55, yellow if slower), layout/paint ms, node count, RSS, window dimensions.

### Implementation

- 22px bar at bottom of window
- Renders text using existing `text.zig` TextEngine
- Background: dark semi-transparent rectangle (OpenGL quad)
- FPS color: green if ≥55, yellow if ≥30, red if <30
- Reads all values from `telemetry.zig` getters
- F12 key toggles visibility (add to SDL_KEYDOWN in event loop)
- When visible, reduce app viewport height by 22px (layout gets `win_h - 22`)

### Format string

```zig
const status = std.fmt.bufPrint(&buf, "FPS: {d:.0}  |  Layout: {d:.2}ms  |  Paint: {d:.2}ms  |  Nodes: {d}  |  RSS: {d:.0}MB  |  {d}x{d}", .{
    telemetry.getFps(), telemetry.getLayoutMs(), telemetry.getPaintMs(),
    telemetry.getNodeCount(), watchdog.getRssMb(), @as(u32, @intFromFloat(win_w)), @as(u32, @intFromFloat(win_h)),
});
```

**Files changed:** `tsz/runtime/devtools.zig` (new), `tsz/runtime/main.zig` or templates (F12 toggle + draw call + viewport reduction)

**Verification:** Run any tsz app, press F12, status bar appears with live metrics.

---

## Phase 2: Devtools Panel Shell

Expand `devtools.zig` into a docked panel with tab bar.

### Panel behavior

- Docked at bottom of window (like browser devtools)
- Default: 40% of viewport height
- Resizable: drag top edge (6px handle zone)
- Min height: 200px, max: 90% of viewport
- App viewport height reduced by panel height
- Tab bar: 26px tall at top of panel
- Status bar: 22px at bottom of panel (moved from Phase 1 overlay into panel)
- Content area: between tab bar and status bar, clipped

Reference: `love2d/lua/devtools/main.lua` lines 66-92 (state variables), panel height calculation, resize drag handling.

### Tab bar

Initial tabs: **Perf** | **Wireframe** | **Elements**

- Each tab: text label, clickable, active tab has accent underline
- Right-side buttons: Pick mode (+), Refresh (o), Pop-out (<), Close (x)
- Reference: `love2d/lua/devtools/main.lua` tab bar drawing (26px height, accent underline on active)

### Input routing

- Mouse clicks in panel region → route to active tab
- Mouse clicks in app region → normal app handling
- F12 toggles panel
- Tab clicks switch active tab
- Top edge drag resizes panel

**Files changed:** `tsz/runtime/devtools.zig` (expand), templates (panel height reduction in layout call)

---

## Phase 3: Perf Tab

Render performance data inside the devtools panel.

### Frame budget bar

Reference: `love2d/lua/devtools/tab_perf.lua:151-220`

- Horizontal bar showing layout (blue) + paint (green) against 16.6ms target
- Width proportional to time/budget ratio
- Colors: green background (<80% budget), yellow (80-100%), red (>100%)
- Label: `"Layout: 0.12ms + Paint: 0.34ms = 0.46ms (2.8% of 16.6ms)"`

### Sparkline

Reference: `love2d/lua/devtools/tab_perf.lua:222-280`

- 120 vertical bars (one per frame from ring buffer)
- Height proportional to total_ms
- 16.6ms threshold line (red dashed)
- Color: green if under budget, red if over
- 60px tall

### Stats row

- FPS, Node count, Lua/RSS memory, Mutation count
- Reference: `love2d/lua/devtools/tab_perf.lua:77-100` (stats display)

### Costliest nodes (future)

- Top 20 nodes by layout+paint time
- Requires per-node timing (optional Node struct field)
- Defer to Phase 3b if per-node timing not ready

**Files changed:** `tsz/runtime/devtools.zig` (add perf tab rendering)

---

## Phase 4: Wireframe Tab

Scaled miniature of the entire node tree.

Reference: `love2d/lua/devtools/tab_wireframe.lua` (514 lines)

### What it renders

- All nodes as colored outlines, scaled to fit panel
- Depth-based coloring (7 colors cycling by tree depth)
- Hover highlight: thicker outline on mouseover
- Selected node: accent-colored outline
- Text nodes: different shade
- Scale percentage indicator (bottom right)

### Implementation

- Walk the node tree recursively
- Scale factor: `min(panel_w / root_w, panel_h / root_h)`
- For each node: draw scaled rectangle outline with depth color
- Hit test mouse position against scaled rects for hover/select

**Files changed:** `tsz/runtime/devtools.zig` (add wireframe tab rendering)

---

## Phase 5: Elements/Inspector Tab

The most complex tab — tree view + property panel.

Reference: `love2d/lua/devtools/main.lua` Elements tab sections

### Left panel: Node tree

- Indented hierarchy view
- Each line: `▶ Box (400×300)` or `▼ Box (400×300)` (collapsed/expanded)
- Click to select, arrow keys to navigate
- Scrollable
- Hover highlights corresponding node on canvas

### Right panel: Properties

- Selected node's properties:
  - Type, dimensions, position
  - Style fields (all non-default values)
  - Text content (if text node)
  - Computed bounds (x, y, w, h)
  - Handlers (which events are attached)
  - Children count

### Canvas overlay

- Hover: semi-transparent highlight over hovered node
- Selected: outline + tooltip with dimensions
- Reference: `love2d/lua/inspector.lua` overlay drawing

**Files changed:** `tsz/runtime/devtools.zig` (add elements tab), `tsz/runtime/events.zig` (may need devtools-specific hit testing)

---

## Phase 6: Pop-out Window

Devtools as a secondary SDL window using `windows.zig`.

### tsz advantage

Love2D needs TCP IPC because child windows are separate processes. tsz windows share the same address space — the devtools window can read the app's node tree and telemetry directly. No serialization needed.

Implementation:
- Create secondary window via `windows.zig`
- Devtools rendering redirected to secondary window's renderer
- App window gets full viewport back
- Button to dock back (close secondary window, re-dock panel)

Reference: `love2d/lua/devtools/main.lua` pop-out sections — but most of this code (TCP server, NDJSON sync, mutation batching) is unnecessary for tsz.

**Files changed:** `tsz/runtime/devtools.zig` (pop-out logic), `tsz/runtime/windows.zig` (devtools window lifecycle)

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

## Implementation Order for Agents

This can be split into **3 parallel agents** after Phase 0:

| Agent | Phases | Files |
|-------|--------|-------|
| A: Telemetry + Status Bar | 0, 1 | `telemetry.zig` (new), `devtools.zig` (new, minimal), templates |
| B: Panel Shell + Perf Tab | 2, 3 | `devtools.zig` (expand), templates |
| C: Wireframe + Elements | 4, 5 | `devtools.zig` (expand), `events.zig` |

**Agent A must complete first** — B and C depend on the telemetry API and devtools.zig scaffold.

Then Agent B and C can work in parallel (perf tab vs wireframe/elements are independent rendering functions within devtools.zig).

Phase 6 (pop-out) comes after all tabs work docked.

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
