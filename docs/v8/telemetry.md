# V8 Telemetry Pipeline

Telemetry is the V8 runtime's in-process observability surface. The engine
captures a fixed `telemetry.Snapshot` once per frame, stores it in a small ring
buffer, and exposes it to cart code through `useTelemetry()` and `globalThis`
host functions.

This is not browser performance telemetry. There is no `performance` API, DOM
node inspection, or browser devtools bridge. The source of truth is the Zig
runtime: frame timing, layout, paint, GPU queues, node tree counters, state
slots, input state, window state, Canvas camera state, and debug-server perf
messages.

## Source Map

| Layer | Files |
| --- | --- |
| Public JS hook | `runtime/hooks/useTelemetry.ts`, `runtime/hooks/index.ts` |
| Generic host caller | `runtime/ffi.ts` |
| V8 feature gate | `scripts/ship`, `scripts/ship-metafile-gate.js`, `sdk/dependency-registry.json`, `build.zig`, `v8_app.zig` |
| Snapshot collector | `framework/telemetry.zig` |
| Engine call site | `framework/engine.zig` |
| V8 host bindings | `framework/v8_bindings_telemetry.zig` |
| QJS legacy mirror | `framework/qjs_runtime.zig` |
| Debug server stream | `framework/debug_server.zig`, `framework/debug_client.zig` |
| Data providers | `framework/gpu/gpu.zig`, `framework/layout.zig`, `framework/state.zig`, `framework/input.zig`, `framework/selection.zig`, `framework/canvas.zig`, `framework/router.zig`, `framework/log.zig`, `framework/windows.zig`, `framework/tooltip.zig` |

`framework/v8_bindings_telemetry.zig` also registers legacy localstore, hot
state, raw PTY, raw SQL, process, and compute helpers. Those are documented in
their own pipeline docs where relevant. This document treats them only as
related registration baggage around the telemetry ingredient.

## High-Level Flow

1. Cart code imports `useTelemetry()` from `runtime/hooks`.
2. The import causes `runtime/hooks/useTelemetry.ts` to appear in the esbuild
   metafile when it survives tree-shaking.
3. `scripts/ship-metafile-gate.js` reads the metafile and dependency registry.
4. The `telemetry` gate flips on.
5. `scripts/ship` passes `-Dhas-telemetry=true` to `zig build`.
6. `build.zig` exposes `build_options.has_telemetry`.
7. `v8_app.zig` imports `framework/v8_bindings_telemetry.zig` when the flag is
   true; otherwise it imports a no-op `registerTelemetry()`.
8. `appInit()` iterates V8 ingredients and calls `registerTelemetry({})`.
9. The binding installs `getFps`, `getLayoutUs`, `getPaintUs`, `getTickUs`,
   `__tel_*`, process, and related host functions on `globalThis`.
10. Every engine frame measures JS tick, layout, paint, GPU present, node
    counts, and subsystem counters.
11. `engine.zig` calls `telemetry.collect(...)` near the end of the frame.
12. `telemetry.collect()` writes `telemetry.current`, appends the snapshot to a
    120-frame ring buffer, and rebuilds the DFS node index.
13. `useTelemetry()` calls one host function via `callHost()`, optionally on an
    interval, and returns a scalar number or structured object.
14. In dev builds, `debug_server.zig` can stream selected fields from the same
    `telemetry.current` snapshot over its encrypted IPC channel.

## Build Gate

The registry feature is `telemetry`:

```json
{
  "telemetry": {
    "shipGate": "telemetry",
    "triggers": [
      { "kind": "metafileInput", "input": "runtime/hooks/useTelemetry.ts" },
      { "kind": "metafileInput", "input": "cart/component-gallery/components/telemetry/TelemetryPanel.tsx" },
      { "kind": "metafileInput", "input": "cart/component-gallery/stories/telemetry-stats.story.tsx" }
    ],
    "buildOptions": ["has-telemetry"],
    "v8Bindings": ["telemetry"]
  }
}
```

The positional gate order consumed by `scripts/ship` includes telemetry:

```sh
privacy useHost useConnection fs websocket telemetry zigcall sdk voice whisper pg embed
```

When the gate is enabled, `scripts/ship` adds:

```sh
-Dhas-telemetry=true
```

and records the ingredient as:

```text
telemetry: telemetry cart source
```

`build.zig` defines:

```zig
const has_telemetry = b.option(bool, "has-telemetry", "Register __tel_*/getFps/... bindings") orelse false;
options.addOption(bool, "has_telemetry", has_telemetry);
_ = manifest_wf.add("v8-ingredients/telemetry.flag", if (has_telemetry) "1\n" else "0\n");
```

`v8_app.zig` imports the real binding only when `build_options.has_telemetry`
is true, and otherwise uses a stub:

```zig
const v8_bindings_telemetry = if (build_options.has_telemetry)
    @import("framework/v8_bindings_telemetry.zig")
else
    struct { pub fn registerTelemetry(_: anytype) void {} };
```

The ingredient row is:

```zig
.{ .name = "telemetry", .required = false, .grep_prefix = "__tel_", .reg_fn = "registerTelemetry", .mod = v8_bindings_telemetry }
```

The current production gate is metafile-driven. The `grep_prefix` still
documents the binding family but is not the primary source trigger.

## Public Hook

Source: `runtime/hooks/useTelemetry.ts`

```tsx
import { useTelemetry } from '@reactjit/runtime/hooks';

export default function App() {
  const { value: fps } = useTelemetry({ kind: 'fps', pollMs: 1000 });
  const { data: nodes } = useTelemetry({ kind: 'nodes', pollMs: 500 });

  return (
    <Text>
      {fps} fps, {nodes?.visible ?? 0} visible nodes
    </Text>
  );
}
```

Default behavior is one read on mount. Pass `pollMs > 0` to poll on an
interval. The hook does not subscribe to frames by itself.

The hook uses `callHost()` from `runtime/ffi.ts`. Missing or throwing host
functions return the supplied fallback:

| Result kind | Fallback |
| --- | --- |
| Scalar telemetry | `0` |
| JSON telemetry | `null` |
| Node telemetry | `null` |

This makes the hook safe in carts built without telemetry, but it also means
missing bindings are silent unless the caller explicitly checks for null/zero.

## Hook API

`useTelemetry()` is a discriminated union over three spec families.

### Scalar Specs

```ts
type ScalarKind =
  | 'fps'
  | 'layoutUs'
  | 'paintUs'
  | 'tickUs'
  | 'nodeCount';

interface ScalarTelemetrySpec {
  kind: ScalarKind;
  pollMs?: number;
}

interface ScalarTelemetryResult {
  value: number;
}
```

| Kind | Host function | Meaning |
| --- | --- | --- |
| `fps` | `getFps()` | Frames counted over the most recent one-second engine window. |
| `layoutUs` | `getLayoutUs()` | Last layout pass duration in microseconds. |
| `paintUs` | `getPaintUs()` | Last paint pass duration in microseconds. |
| `tickUs` | `getTickUs()` | Last JS VM tick duration in microseconds. |
| `nodeCount` | `__tel_node_count()` | Current DFS node index length. Capped at 4096. |

The first four scalar helpers read legacy `qjs_runtime.telemetry_*` globals
that the V8 engine still updates. `__tel_frame()` reads the unified
`telemetry.current` snapshot instead.

### JSON Specs

```ts
type JsonKind =
  | 'frame'
  | 'gpu'
  | 'nodes'
  | 'state'
  | 'history'
  | 'input'
  | 'layout'
  | 'net'
  | 'system'
  | 'canvas'
  | 'processes'
  | 'threads';

interface JsonTelemetrySpec {
  kind: JsonKind;
  pollMs?: number;
}

interface JsonTelemetryResult<T = any> {
  data: T | null;
}
```

| Kind | Host function | Meaning |
| --- | --- | --- |
| `frame` | `__tel_frame()` | Frame timing plus bridge-call counter. |
| `gpu` | `__tel_gpu()` | GPU operation counts, capacities, atlas state, and frame hash. |
| `nodes` | `__tel_nodes()` | Aggregate node-tree counters. |
| `state` | `__tel_state()` | State slot and array slot occupancy. |
| `history` | `__tel_history()` | Recent `frame_total_us` values. |
| `input` | `__tel_input()` | Focus, active input count, selection, and tooltip state. |
| `layout` | `__tel_layout()` | Layout budget plus router/log counters. |
| `net` | `__tel_net()` | Network counter fields from the snapshot. |
| `system` | `__tel_system()` | Window, display, breakpoint, and secondary-window counters. |
| `canvas` | `__tel_canvas()` | Canvas camera and custom renderer count. |
| `processes` | `getProcessesJson()` | Linux `/proc` process list JSON. |
| `threads` | `getThreadsJson()` | Linux `/proc/<pid>/task` thread list JSON. |

The hook calls `getThreadsJson()` without a PID argument, so `kind: 'threads'`
currently returns `[]` through the registered binding. Call the host function
directly with a PID when using that lower-level API.

### Node Specs

```ts
type NodeKind =
  | 'node'
  | 'nodeBoxModel'
  | 'nodeStyle';

interface NodeTelemetrySpec {
  kind: NodeKind;
  nodeId: number;
  pollMs?: number;
}
```

| Kind | Host function | Meaning |
| --- | --- | --- |
| `node` | `__tel_node(id)` | Runtime node summary for a DFS index. |
| `nodeBoxModel` | `__tel_node_box_model(id)` | Computed rect, padding, margin, border, and content size. |
| `nodeStyle` | `__tel_node_style(id)` | Resolved style fields stored on the node. |

`nodeId` is a telemetry DFS index, not a React key, host instance ID, or stable
layout object ID. It can change any frame that the node tree changes.

## V8 Registration

Source: `framework/v8_bindings_telemetry.zig`

`registerTelemetry()` installs the telemetry API:

```zig
v8rt.registerHostFn("getFps", getFpsCb);
v8rt.registerHostFn("getLayoutUs", getLayoutUsCb);
v8rt.registerHostFn("getPaintUs", getPaintUsCb);
v8rt.registerHostFn("getTickUs", getTickUsCb);

v8rt.registerHostFn("__tel_frame", telFrameCb);
v8rt.registerHostFn("__tel_gpu", telGpuCb);
v8rt.registerHostFn("__tel_nodes", telNodesCb);
v8rt.registerHostFn("__tel_state", telStateCb);
v8rt.registerHostFn("__tel_history", telHistoryCb);
v8rt.registerHostFn("__tel_input", telInputCb);
v8rt.registerHostFn("__tel_layout", telLayoutCb);
v8rt.registerHostFn("__tel_net", telNetCb);
v8rt.registerHostFn("__tel_node", telNodeCb);
v8rt.registerHostFn("__tel_node_box_model", telNodeBoxModelCb);
v8rt.registerHostFn("__tel_node_style", telNodeStyleCb);
v8rt.registerHostFn("__tel_node_count", telNodeCountCb);
v8rt.registerHostFn("__tel_system", telSystemCb);
v8rt.registerHostFn("__tel_canvas", telCanvasCb);

v8rt.registerHostFn("getProcessesJson", getProcessesJsonCb);
v8rt.registerHostFn("getThreadsJson", getThreadsJsonCb);
v8rt.registerHostFn("getCoreCount", getCoreCountCb);
```

The same registration function also installs:

| Related function family | Functions |
| --- | --- |
| Compute demos | `heavy_compute`, `heavy_compute_timed`, `set_compute_n` |
| Raw PTY helpers | `__pty_open`, `__pty_read`, `__pty_write`, `__pty_alive`, `__pty_close`, `__pty_focus`, `__pty_cwd` |
| Legacy localstore | `__store_set`, `__store_get`, `__store_remove`, `__store_clear`, `__store_keys_json` |
| Hot state | `__hot_set`, `__hot_get`, `__hot_remove`, `__hot_clear`, `__hot_keys_json` |
| Raw SQLite | `__sql_open`, `__sql_close`, `__sql_exec`, `__sql_query_json`, `__sql_changes`, `__sql_last_rowid`, `__db_query` |

These extra host functions are coupled to the telemetry ingredient today. A
cart that relies on them may need the telemetry gate even if it does not call
`useTelemetry()`.

## Frame Collection

Source: `framework/engine.zig`

The engine records timing in the main frame loop:

1. SDL events are pumped and dispatched.
2. `js_vm.tick()` runs and becomes `tick_us`.
3. The optional app tick runs.
4. terminal, input drag, transition, physics, video, render surface, cursor,
   effects, filesystem watch, clipboard, voice, whisper, and system-signal
   ticks run.
5. `layout.layout(config.root, 0, 0, win_w, app_h)` runs and becomes
   `layout_us`.
6. `paintNode(config.root)`, overlay painting, and HUD/debug overlays run and
   become `paint_us`.
7. `gpu.frame(...)` presents the GPU queues.
8. capture/test/witness hooks run.
9. `telemetry.collect(...)` snapshots the current runtime state.
10. `debug_server.poll()` may push telemetry to an authenticated client.
11. Once per second, FPS and bridge-call counters are rolled forward, stderr
    logging may print, and counters are reset.

The call site passes:

```zig
telemetry.collect(.{
    .tick_us = @intCast(@max(0, t1 - t0)),
    .layout_us = @intCast(@max(0, t3 - t2)),
    .paint_us = @intCast(@max(0, t5 - t4)),
    .frame_total_us = @intCast(@max(0, t6 - t0)),
    .fps = qjs_runtime.telemetry_fps,
    .bridge_calls_per_sec = qjs_runtime.telemetry_bridge_calls,
    .root = config.root,
    .visible_nodes = g_paint_count,
    .hidden_nodes = g_hidden_count,
    .zero_size_nodes = g_zero_count,
    .window = window,
    .hovered_node = hovered_node,
});
```

`frame_total_us` starts before the JS VM tick and ends immediately before
`telemetry.collect()`. It includes JS tick, app/runtime ticks, layout, paint,
GPU present, and the post-present capture/test/witness checks.

`fps` and `bridge_calls_per_sec` are one-second rolling counters. The snapshot
receives the most recently committed one-second values, not a freshly computed
instantaneous frame rate.

## Snapshot Collector

Source: `framework/telemetry.zig`

`telemetry.collect()` creates a fresh `Snapshot{}` each frame and fills it from
engine arguments plus subsystem telemetry helpers.

| Snapshot section | Provider |
| --- | --- |
| Frame timing | `engine.zig` arguments |
| Frame number | `gpu.telemetryFrameCounter()` |
| GPU counters | `gpu.telemetryStats()` |
| Layout budget | `layout.telemetryBudget()`, `layout.telemetryBudgetUsed()` |
| Node tree totals | Recursive `walkTree(args.root, ...)` |
| DFS node index | Recursive `buildDfsIndex(args.root, ...)` |
| State slots | `state.slotCount()`, `state.MAX_SLOTS`, `state.isDirty()`, `state.telemetryArraySlotCount()` |
| Bridge calls | `engine.zig` argument |
| Input | `input.telemetryStats()` |
| Selection | `selection.telemetryHasSelection()`, `selection.telemetryIsDragging()` |
| Window/display | SDL window and display APIs |
| Breakpoint | `breakpoint.current()` |
| Secondary windows | `windows.telemetryActiveCount()` |
| Canvas | `canvas.telemetryCameraState()` |
| Tooltip | `tooltip.telemetryVisible()` |
| Router | `router.telemetryStats()` |
| Logging | `log.telemetryEnabledMask()` |
| Hovered node | `hovered_node` argument and node computed rect |

The commit step is:

```zig
history_head = (history_head + 1) % HISTORY_SIZE;
history[history_head] = snap;
if (history_count < HISTORY_SIZE) history_count += 1;
current = snap;
```

`HISTORY_SIZE` is `120`, roughly two seconds at 60 fps.

## Snapshot Fields

`Snapshot` contains more fields than the V8 API currently exposes.

| Field group | Fields |
| --- | --- |
| Frame timing | `frame_number`, `fps`, `tick_us`, `layout_us`, `paint_us`, `frame_total_us` |
| GPU | `rect_count`, `glyph_count`, `rect_capacity`, `glyph_capacity`, `atlas_glyph_count`, `atlas_capacity`, `atlas_row_x`, `atlas_row_y`, `scissor_depth`, `scissor_segment_count`, `gpu_surface_w`, `gpu_surface_h`, `frame_hash`, `frames_since_drain` |
| Text/font | `glyph_cache_count`, `glyph_cache_capacity`, `measure_cache_hits`, `measure_cache_misses`, `fallback_font_count` |
| Layout | `layout_budget`, `layout_budget_used` |
| Node tree | `visible_nodes`, `hidden_nodes`, `zero_size_nodes`, `total_nodes`, `max_depth`, `scroll_nodes`, `text_nodes`, `image_nodes`, `pressable_nodes`, `canvas_nodes` |
| State | `state_slot_count`, `state_slot_capacity`, `state_dirty`, `array_slot_count`, `array_slot_capacity` |
| Bridge | `bridge_calls_per_sec` |
| Input | `focused_input_id`, `active_input_count` |
| Selection | `has_selection`, `selection_dragging` |
| Window/system | `window_x`, `window_y`, `window_w`, `window_h`, `display_count`, `current_display`, `display_w`, `display_h`, `breakpoint_tier`, `secondary_window_count` |
| Canvas | `canvas_cam_x`, `canvas_cam_y`, `canvas_cam_zoom`, `canvas_type_count` |
| Network | `net_active_connections`, `net_open_connections`, `net_reconnecting`, `net_event_queue_depth` |
| Tooltip | `tooltip_visible` |
| Router | `route_history_depth`, `route_current_index` |
| Logging | `log_channels_enabled` |
| Hovered node | `hovered_node_tag`, `hovered_node_tag_len`, `hovered_node_x`, `hovered_node_y`, `hovered_node_w`, `hovered_node_h` |

Current caveats:

| Field group | Caveat |
| --- | --- |
| Text/font | Fields exist in `Snapshot`, but `collect()` does not currently populate them and no V8 `__tel_*` host function exposes them. |
| Network | `__tel_net()` exposes the fields, but `collect()` does not currently populate them from a network subsystem. Expect zeros unless that changes. |
| Hovered node | Captured in `Snapshot`, but not exposed by the V8 telemetry host functions. |

## Host Return Shapes

### `__tel_frame()`

```ts
{
  fps: number;
  tick_us: number;
  layout_us: number;
  paint_us: number;
  frame_total_us: number;
  frame_number: number;
  bridge_calls_per_sec: number;
}
```

### `__tel_gpu()`

```ts
{
  rect_count: number;
  glyph_count: number;
  rect_capacity: number;
  glyph_capacity: number;
  atlas_glyph_count: number;
  atlas_capacity: number;
  atlas_row_x: number;
  atlas_row_y: number;
  scissor_depth: number;
  scissor_segment_count: number;
  gpu_surface_w: number;
  gpu_surface_h: number;
  frame_hash: number;
  frames_since_drain: number;
}
```

### `__tel_nodes()`

```ts
{
  total: number;
  visible: number;
  hidden: number;
  zero_size: number;
  max_depth: number;
  scroll: number;
  text: number;
  image: number;
  pressable: number;
  canvas: number;
}
```

`total` is a structural tree count from `walkTree()`. `visible`, `hidden`, and
`zero_size` come from the paint walk counters for the last frame.

### `__tel_state()`

```ts
{
  slot_count: number;
  slot_capacity: number;
  dirty: boolean;
  array_slot_count: number;
  array_slot_capacity: number;
}
```

`array_slot_capacity` is currently hardcoded to `16` in `collect()`.

### `__tel_system()`

```ts
{
  window_x: number;
  window_y: number;
  window_w: number;
  window_h: number;
  display_count: number;
  current_display: number;
  display_w: number;
  display_h: number;
  breakpoint: number;
  secondary_windows: number;
}
```

`breakpoint` is the numeric enum value from `breakpoint.current()`.

### `__tel_input()`

```ts
{
  focused_id: number;
  active_count: number;
  has_selection: boolean;
  selection_dragging: boolean;
  tooltip_visible: boolean;
}
```

### `__tel_canvas()`

```ts
{
  cam_x: number;
  cam_y: number;
  cam_zoom: number;
  type_count: number;
}
```

This reads the default Canvas camera from `canvas.telemetryCameraState()`, which
delegates to `telemetryCameraStateFor(0)`.

### `__tel_net()`

```ts
{
  active_connections: number;
  open_connections: number;
  reconnecting: number;
  event_queue_depth: number;
}
```

The shape exists, but the current collector leaves these fields at their
zero-value defaults.

### `__tel_layout()`

```ts
{
  budget: number;
  budget_used: number;
  route_history_depth: number;
  route_current_index: number;
  log_channels_enabled: number;
}
```

### `__tel_history(count?)`

```ts
number[]
```

Returns recent `frame_total_us` values only, newest first. The optional count
defaults to `40` and is clamped to `1..120`. The hook does not pass a count, so
`useTelemetry({ kind: 'history' })` returns up to 40 values.

### `__tel_node_count()`

```ts
number
```

Returns the number of nodes currently indexed by telemetry DFS order. The index
is capped by `MAX_INDEXED_NODES = 4096`.

### `__tel_node(id)`

```ts
{
  depth: number;
  child_count: number;
  x: number;
  y: number;
  w: number;
  h: number;
  has_text: boolean;
  has_image: boolean;
  has_handler: boolean;
  has_tooltip: boolean;
  font_size: number;
  opacity: number;
  scroll_y: number;
  content_height: number;
  tag: string;
  display: number;
  flex_direction: number;
} | undefined
```

`tag` is `node.debug_name` when present; otherwise it is derived by
`telemetry.nodeTypeName()`.

`nodeTypeName()` returns:

| Condition | Name |
| --- | --- |
| `node.canvas_type != null` | `Canvas` |
| `node.input_id != null` | `TextInput` |
| `node.image_src != null` | `Image` |
| `node.handlers.on_press != null` | `Pressable` |
| `node.text != null` | `Text` |
| fallback | `Box` |

### `__tel_node_style(id)`

```ts
{
  width: number;
  height: number;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  flex_grow: number;
  flex_shrink?: number;
  flex_basis?: number;
  flex_direction: number;
  justify_content: number;
  align_items: number;
  align_self: number;
  gap: number;
  padding: number;
  padding_left?: number;
  padding_right?: number;
  padding_top?: number;
  padding_bottom?: number;
  margin: number;
  margin_left?: number;
  margin_right?: number;
  margin_top?: number;
  margin_bottom?: number;
  border_radius: number;
  border_width: number;
  border_top_width?: number;
  border_right_width?: number;
  border_bottom_width?: number;
  border_left_width?: number;
  opacity: number;
  z_index: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  bg_r?: number;
  bg_g?: number;
  bg_b?: number;
  bg_a?: number;
  border_r?: number;
  border_g?: number;
  border_b?: number;
  border_a?: number;
  position: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  overflow: number;
  display: number;
  text_align: number;
} | undefined
```

Unset `width` and `height` are returned as `-1`; most other optional style
fields are omitted when unset. Enum fields are numeric Zig enum ordinals.

### `__tel_node_box_model(id)`

```ts
{
  x: number;
  y: number;
  w: number;
  h: number;
  pad_top: number;
  pad_right: number;
  pad_bottom: number;
  pad_left: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  border_width: number;
  border_top_width: number;
  border_right_width: number;
  border_bottom_width: number;
  border_left_width: number;
  content_w: number;
  content_h: number;
} | undefined
```

`content_w` and `content_h` subtract padding only. Border widths are reported
separately.

## Process And Thread Helpers

The telemetry binding registers Linux process inspection helpers:

| Function | Return |
| --- | --- |
| `getProcessesJson()` | JSON string array of `{ pid, nthreads, name }` from `/proc`. |
| `getThreadsJson(pid)` | JSON string array of `{ tid, core, cpu, name }` from `/proc/<pid>/task`. |
| `getCoreCount()` | Number of CPU directories under `/sys/devices/system/cpu`. |

These are raw host functions, not `Snapshot` fields. The hook maps
`kind: 'processes'` and `kind: 'threads'` to the first two helpers, but does not
parse JSON strings into arrays and does not pass a PID for `threads`.

Direct usage:

```ts
const processes = JSON.parse(globalThis.getProcessesJson?.() ?? '[]');
const threads = JSON.parse(globalThis.getThreadsJson?.(processes[0]?.pid) ?? '[]');
```

The implementation is Linux-specific because it reads `/proc` and `/sys`.

## DFS Node Index

Each `telemetry.collect()` rebuilds a DFS index from the current layout tree:

```zig
const MAX_INDEXED_NODES = 4096;

var dfs_nodes: [MAX_INDEXED_NODES]*const Node = undefined;
var dfs_depths: [MAX_INDEXED_NODES]u16 = undefined;
var dfs_count: usize = 0;

fn buildDfsIndex(node: *const Node, depth: u16) void {
    if (dfs_count >= MAX_INDEXED_NODES) return;
    dfs_nodes[dfs_count] = node;
    dfs_depths[dfs_count] = depth;
    dfs_count += 1;
    for (node.children) |*child| {
        buildDfsIndex(child, depth + 1);
    }
}
```

Consequences:

| Behavior | Detail |
| --- | --- |
| Index order | Current frame DFS order. Parent before children. |
| Stability | Not stable across tree mutations. |
| Cap | Nodes after the first 4096 are not addressable through `__tel_node*`. |
| Lifetime | Pointers are valid for the current runtime tree; callers receive copied JS objects, not raw pointers. |

## Debug Server Pipeline

Source: `framework/debug_server.zig`

The debug server is compiled only for dev builds and only starts when
`TSZ_DEBUG=1`. It exposes a separate telemetry path over encrypted IPC:

1. `debug_server.init(title)` binds a local IPC server when enabled.
2. Client handshake uses X25519, HKDF-SHA256, and XChaCha20-Poly1305.
3. The engine calls `debug_server.poll()` after `telemetry.collect()`.
4. `debug.telemetry.stream` toggles frame streaming.
5. When streaming and authenticated, `poll()` pushes at most once every 250 ms.
6. Pushed frames use the same `telemetry.current` snapshot.

Messages:

| Method | Response |
| --- | --- |
| `debug.perf` | One perf object from `telemetry.current`. |
| `debug.telemetry.stream` | Toggles streaming and returns `{ method, streaming }`. |
| `debug.telemetry.history` | Up to 120 full perf objects from the snapshot ring. |
| `debug.telemetry.frame` | Pushed stream frame when streaming is enabled. |
| `debug.tree` | DFS tree summary using `telemetry.nodeCount()` and `telemetry.getNode()`. |
| `debug.node` | Basic node identity for a DFS index. |
| `debug.state` | Total/visible node and state-slot counters. |

The perf payload shape is smaller than `__tel_frame()`:

```ts
{
  method: 'debug.perf' | 'debug.telemetry.frame' | 'debug.telemetry.history';
  fps: number;
  frame: number;
  layout_us: number;
  paint_us: number;
  tick_us: number;
  rects: number;
  glyphs: number;
  visible: number;
  total: number;
  window_w: number;
  window_h: number;
}
```

`debug.telemetry.history` wraps these objects in `frames: [...]`.

## Logging Pipeline

The engine keeps a legacy once-per-second telemetry log path independent of the
V8 host API:

```text
[telemetry] FPS: ... | layout: ...us | paint: ...us | visible: ... | gpu: ... | hidden: ... | zero: ... | bridge: .../s
```

Behavior:

| Sink | Cadence |
| --- | --- |
| Stderr | Every 10 seconds by default. Every second when `ZIGOS_TELEMETRY=1`. |
| `log.writeLine` | Every second. |

During the same one-second block, the engine also calls:

```zig
@import("luajit_worker.zig").logTelemetry();
@import("audio.zig").logTelemetry();
watchdog.heartbeat();
```

This log path is useful for perf hunting without adding a JS polling component.

## Timing Semantics

| Metric | Source | Notes |
| --- | --- | --- |
| `tick_us` | Time around `js_vm.tick()` | Does not include later app/runtime ticks. |
| `layout_us` | Time around `layout.layout(...)` | Main window layout pass. |
| `paint_us` | Time around `paintNode(...)`, overlays, and HUD/debug overlays | Does not include `gpu.frame(...)`. |
| `frame_total_us` | `t6 - t0` | Starts before JS tick and ends before `telemetry.collect()`. Includes GPU present and post-present hooks. |
| `fps` | One-second rolling frame count | Updated after `telemetry.collect()` in the one-second telemetry block. |
| `bridge_calls_per_sec` | One-second rolling bridge-call count | Also committed after `telemetry.collect()` in the one-second block. |

Because `telemetry.collect()` runs before the one-second FPS update, a snapshot
can briefly contain the previous one-second `fps` and bridge counters. That is
expected.

## API Surface Summary

### Hook Kinds

| Hook kind | Return from hook |
| --- | --- |
| `fps` | `{ value: number }` |
| `layoutUs` | `{ value: number }` |
| `paintUs` | `{ value: number }` |
| `tickUs` | `{ value: number }` |
| `nodeCount` | `{ value: number }` |
| `frame` | `{ data: FrameTelemetry | null }` |
| `gpu` | `{ data: GpuTelemetry | null }` |
| `nodes` | `{ data: NodeSummaryTelemetry | null }` |
| `state` | `{ data: StateTelemetry | null }` |
| `history` | `{ data: number[] | null }` |
| `input` | `{ data: InputTelemetry | null }` |
| `layout` | `{ data: LayoutTelemetry | null }` |
| `net` | `{ data: NetTelemetry | null }` |
| `system` | `{ data: SystemTelemetry | null }` |
| `canvas` | `{ data: CanvasTelemetry | null }` |
| `processes` | `{ data: string | null }` |
| `threads` | `{ data: string | null }` |
| `node` | `{ data: NodeTelemetry | null }` |
| `nodeBoxModel` | `{ data: NodeBoxModelTelemetry | null }` |
| `nodeStyle` | `{ data: NodeStyleTelemetry | null }` |

### Global Host Functions

| Function | Args | Return |
| --- | --- | --- |
| `getFps` | none | number |
| `getLayoutUs` | none | number |
| `getPaintUs` | none | number |
| `getTickUs` | none | number |
| `__tel_frame` | none | object |
| `__tel_gpu` | none | object |
| `__tel_nodes` | none | object |
| `__tel_state` | none | object |
| `__tel_history` | `count?` | number array |
| `__tel_input` | none | object |
| `__tel_layout` | none | object |
| `__tel_net` | none | object |
| `__tel_node` | `id` | object or `undefined` |
| `__tel_node_box_model` | `id` | object or `undefined` |
| `__tel_node_style` | `id` | object or `undefined` |
| `__tel_node_count` | none | number |
| `__tel_system` | none | object |
| `__tel_canvas` | none | object |
| `getProcessesJson` | none | JSON string |
| `getThreadsJson` | `pid` | JSON string |
| `getCoreCount` | none | number |

## Common Usage Patterns

### Lightweight FPS Readout

```tsx
const { value: fps } = useTelemetry({ kind: 'fps', pollMs: 1000 });
const { data: frame } = useTelemetry({ kind: 'frame', pollMs: 1000 });
```

Use a one-second poll for human-readable FPS. Faster polling does not make the
one-second FPS counter more precise.

### Frame Budget Chart

```tsx
const { data: history } = useTelemetry<number[]>({
  kind: 'history',
  pollMs: 250,
});
```

`history` is newest-first `frame_total_us` values. Reverse it before drawing a
left-to-right timeline.

### Inspect A Runtime Node

```tsx
const { data: node } = useTelemetry({
  kind: 'node',
  nodeId: selectedTelemetryIndex,
  pollMs: 250,
});
```

Store and display the index as "telemetry index" or "DFS index". Do not call it
a React ID.

### Direct Process List

```ts
const raw = globalThis.getProcessesJson?.() ?? '[]';
const processes = JSON.parse(raw);
```

The hook currently returns the raw JSON string, so direct host usage is clearer
when a component needs actual arrays.

## Failure Modes

| Symptom | Likely cause |
| --- | --- |
| All scalar values are `0` and JSON values are `null` | The cart did not import `useTelemetry()` or the telemetry gate was removed by tree-shaking. |
| `threads` returns `[]` through the hook | `useTelemetry({ kind: 'threads' })` does not pass a PID. |
| Node details no longer match the selected row | The DFS index changed after a tree mutation. Refresh the tree and selection together. |
| `__tel_net()` is all zeros | Network fields are exposed but not populated by `collect()` today. |
| `history` has fewer than requested frames | The app has not run long enough to fill the 120-frame ring. |
| `fps` appears one interval behind | FPS is a one-second rolling counter committed after snapshot collection. |
| Process helpers fail or return empty arrays | The process helpers expect Linux `/proc` and `/sys`. |

## Extension Points

When adding telemetry:

1. Add fields to `framework/telemetry.zig` `Snapshot`.
2. Populate them in `collect()` from a subsystem-owned telemetry helper.
3. Expose a host function or extend an existing `__tel_*` object in
   `framework/v8_bindings_telemetry.zig`.
4. Add a hook kind or type in `runtime/hooks/useTelemetry.ts` only if cart code
   should consume it directly.
5. Update this document with the field meaning, cadence, and caveats.

Keep collection allocation-free. `telemetry.collect()` runs every frame.

## Known Boundaries

| Boundary | Detail |
| --- | --- |
| Build inclusion | Shipped V8 carts only get telemetry bindings when the feature gate is enabled. |
| Runtime cost | Snapshot collection runs every frame regardless of whether JS polls it once the binary includes the runtime collector. JS polling adds React state updates on top. |
| Data freshness | Host functions read the most recent completed snapshot. They do not force a new layout or paint. |
| Stability | Node telemetry IDs are frame-local DFS indexes. |
| Privacy | Telemetry is local process/runtime state. The debug server stream is dev-only, opt-in via `TSZ_DEBUG=1`, paired, and encrypted. |
| Legacy coupling | PTY/localstore/hot/sql helpers are currently registered by the telemetry binding even though they are not telemetry data. |

