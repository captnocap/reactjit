# V8 Engine Pipeline

The engine is the native owner of the app lifecycle. `v8_app.zig` embeds or
loads the cart bundle, materializes React mutation commands into a stable
`layout.Node` pool, and calls `engine.run()`. `framework/engine.zig` owns the
window, SDL events, GPU, text engine, layout pass, paint pass, telemetry,
debug IPC, and shutdown cleanup.

This is not a browser event loop. There is no DOM, compositor thread, CSS
cascade, requestAnimationFrame, or browser Performance API. The frame loop is a
single native loop around SDL events, V8 callbacks, layout, paint, `gpu.frame()`,
and subsystem ticks.

## Source Map

| Layer | Files |
| --- | --- |
| Build options | `build.zig`, `scripts/ship` |
| App entrypoint | `v8_app.zig` |
| VM wrapper | `framework/v8_runtime.zig` |
| Core V8 host bridge | `framework/v8_bindings_core.zig` |
| React runtime boot | `runtime/index.tsx` |
| Reconciler host config | `renderer/hostConfig.ts` |
| Engine lifecycle | `framework/engine.zig` |
| Layout tree | `framework/layout.zig` |
| Events and hit-test helpers | `framework/events.zig`, `framework/input.zig`, `framework/selection.zig` |
| Paint/GPU | `framework/engine.zig`, `framework/gpu/gpu.zig`, `framework/gpu/text.zig` |
| Text measurement | `framework/text.zig` |
| Windows/chrome | `framework/windows.zig`, `framework/geometry.zig`, `framework/debug_server.zig` |
| Frame observability | `framework/telemetry.zig`, `framework/log.zig`, `framework/crashlog.zig`, `framework/watchdog.zig`, `framework/witness.zig` |

## High-Level Flow

1. `scripts/ship` builds the cart JS bundle and invokes `zig build` with
   `-Duse-v8=true`, `-Dapp-name=...`, optional `-Dbundle-path=...`, and
   feature gates.
2. `build.zig` selects `v8_app.zig` as the app source when `use_v8` is true and
   emits `build_options`.
3. `v8_app.zig` embeds the cart bundle with `@embedFile(...)`, or in dev mode
   reads `bundle.js` from disk.
4. `v8_app.main()` initializes host-side maps, allocators, root state, and dev
   hot-reload state.
5. `v8_app.main()` calls `engine.run(.{ ... })` with a root `Node`, the JS
   bundle as `js_logic`, and callbacks for `init`, `tick`, `shutdown`, and
   optional direct Canvas position mutation.
6. `engine.run()` initializes crash handling, SDL, window geometry, voice,
   whisper, Canvas, GPU, FreeType text, V8, LuaJIT, debug IPC, and subsystem
   state.
7. `engine.run()` calls `config.init`, which is `v8_app.appInit`.
8. `appInit()` registers V8 host functions and installs V8 polyfills required
   by React runtime code.
9. `engine.run()` evaluates `config.js_logic`, which runs `runtime/index.tsx`,
   creates the React reconciler container, renders `<App />`, and flushes
   mutation commands through `__hostFlush`.
10. `engine.run()` calls `config.tick` once so `v8_app.appTick` can drain the
    initial mutation queue, materialize `g_root.children`, and mark layout
    dirty.
11. The main loop runs until SDL quit, window close, signal-driven shutdown,
    test harness exit, witness replay exit, or explicit process exit.
12. Each frame processes SDL events, runs VM/app/subsystem ticks, lays out the
    node tree, paints the node tree, presents GPU work, captures telemetry, and
    polls the debug server.
13. Shutdown unwinds `defer` blocks: app shutdown, VM teardown, subsystem
    deinit, GPU/text/window cleanup, SDL quit, watchdog clean-exit marker, and
    crashlog clean-shutdown marker.

## Build Boundary

`build.zig` defines the V8 app path:

```zig
const app_name = b.option([]const u8, "app-name", "Output binary name") orelse "app";
const use_v8 = b.option(bool, "use-v8", "Use V8 JS engine instead of QuickJS") orelse false;
const default_src: []const u8 = if (use_v8) "v8_app.zig" else "qjs_app.zig";
const dev_mode = b.option(bool, "dev-mode", "Read bundle.js from disk and hot-reload on change") orelse false;
const custom_chrome = b.option(bool, "custom-chrome", "Cart draws its own window chrome (borderless)") orelse false;
const bundle_path = b.option([]const u8, "bundle-path", "Absolute path to the cart bundle (overrides default bundle-<app-name>.js lookup)") orelse "";
```

Core engine-related build options exposed to Zig:

| Option | Meaning |
| --- | --- |
| `app_name` | Used for output naming and default window title. |
| `dev_mode` | Enables disk bundle loading, hot reload, dev IPC, and dev chrome. |
| `custom_chrome` | Forces borderless window mode so the cart draws chrome. |
| `has_quickjs` | Currently `true`, even in V8 builds, because some legacy bridge state still lives in `qjs_runtime.zig`. |
| `has_physics` | Links Box2D and enables real `physics2d.zig`. |
| `has_terminal` | Links libvterm and enables the real terminal backend. |
| `has_video` | Enables video substrate. |
| `has_render_surfaces` | Enables render-surface forwarding. |
| `has_effects` | Enables effects, capture, and related paint paths. |
| `has_canvas` | Enables Canvas runtime. |
| `has_3d` | Enables 3D runtime. |
| `has_transitions` | Enables transition tick. |
| `has_crypto` | Force-links crypto exports. |
| `has_blend2d` | Optional Blend2D path; currently defaults false. |
| `has_debug_server` | Compiles the local encrypted debug server. |
| `use_v8` | Makes `engine.zig` use `v8_runtime.zig` for JS VM calls. |

Optional V8 host binding gates, such as `has_fs`, `has_websocket`,
`has_telemetry`, `has_privacy`, and `has_sdk`, are registered in `v8_app.zig`
through its `INGREDIENTS` table. Those are binding-surface gates; the engine
loop still runs the same shape.

## Engine API Surface

Source: `framework/engine.zig`

### `AppConfig`

```zig
pub const AppConfig = struct {
    title: [*:0]const u8 = "tsz app",
    width: u32 = 1280,
    height: u32 = 800,
    min_width: u32 = 320,
    min_height: u32 = 240,
    root: *Node,
    js_logic: []const u8 = "",
    lua_logic: []const u8 = "",
    init: ?*const fn () void = null,
    tick: ?*const fn (now_ms: u32) void = null,
    check_reload: ?*const fn (*AppConfig) bool = null,
    post_reload: ?*const fn () void = null,
    shutdown: ?*const fn () void = null,
    borderless: bool = false,
    always_on_top: bool = false,
    not_focusable: bool = false,
    x: ?c_int = null,
    y: ?c_int = null,
    set_canvas_node_position: ?*const fn (id: u32, gx: f32, gy: f32) void = null,
    dispatch_js_event: ?*const fn (id: u32, handler: []const u8) void = null,
};
```

| Field | Behavior |
| --- | --- |
| `title` | Window title and geometry persistence key. |
| `width`, `height` | Initial window size unless saved geometry overrides it. |
| `min_width`, `min_height` | SDL minimum window size. |
| `root` | Pointer to the materialized `layout.Node` root consumed by layout, paint, hit testing, and telemetry. |
| `js_logic` | JS bundle evaluated after `init`. In V8 mode this is the cart bundle. |
| `lua_logic` | Legacy field; V8 path passes an empty string. |
| `init` | Called after V8 is initialized and before `js_logic` is evaluated. Used to register host functions. |
| `tick` | Called every frame before layout. In V8 mode this drains host flushes, timers, binding drains, animations, and tree rebuilds. |
| `check_reload` | Legacy app hot-reload callback polled at frame start. V8 dev mode mostly reloads inside `appTick`. |
| `post_reload` | Called after `init` on legacy hot reload before `tick`. |
| `shutdown` | Called during shutdown while host runtimes are still alive. |
| `borderless` | Enables SDL borderless window plus custom hit-test chrome. |
| `always_on_top` | Sets SDL always-on-top flag. |
| `not_focusable` | Creates a utility/non-focusable SDL window. |
| `x`, `y` | Optional initial window position override. |
| `set_canvas_node_position` | Direct host pool mutation callback used by Canvas node drag. |
| `dispatch_js_event` | Optional event interception callback used by child-window hosts. |

### Public Functions

| Function | Purpose |
| --- | --- |
| `run(config_in: AppConfig) !void` | Starts the engine lifecycle and blocks until shutdown. |
| `windowClose()` | Pushes an SDL quit event for custom close controls. Ignored during witness replay. |
| `windowMinimize()` | Minimizes the current custom-chrome window. |
| `windowMaximize()` | Toggles maximize/restore for the custom-chrome window. |
| `windowIsMaximized()` | Returns whether the custom-chrome window is maximized. |

## V8 App Boundary

Source: `v8_app.zig`

`v8_app.main()` is the concrete V8 entrypoint. It owns the host-side React tree
state:

| State | Meaning |
| --- | --- |
| `g_node_by_id` | Stable map from React host IDs to heap-owned `layout.Node` structs. |
| `g_children_ids` | Parent ID to child ID list. |
| `g_parent_id` | Child ID to parent ID, used for dirty ancestor walks. |
| `g_root_child_ids` | Top-level React children. |
| `g_root` | Arena-materialized root passed to `engine.run()`. |
| `g_arena` | Per-frame/materialized tree arena. |
| `g_dirty` | Marks that the stable host tree must be snapshotted and rebuilt. |
| latch maps | Track nodes whose style fields are bound to host latches. |
| window maps | Track `Window` host nodes and secondary-window roots. |
| input maps | Map React node IDs to `input.zig` slots and back. |

Normal startup:

```zig
try engine.run(.{
    .title = WINDOW_TITLE,
    .root = &g_root,
    .js_logic = initial_bundle,
    .lua_logic = "",
    .init = appInit,
    .tick = appTick,
    .shutdown = appShutdown,
    .borderless = BORDERLESS_MODE,
    .set_canvas_node_position = setCanvasNodePosition,
});
```

Child-window startup is selected by `ZIGOS_WINDOW_CHILD`. It passes empty
`js_logic`, uses IPC messages from the parent as its mutation source, and sets
`dispatch_js_event = childDispatchEvent`.

## Host Function Registration

`engine.run()` calls `config.init` after the VM is initialized and before the
bundle is evaluated. In V8 mode that means `appInit()`.

`appInit()` does three things:

1. Registers all V8 host bindings through the `INGREDIENTS` table.
2. Installs minimal JS polyfills that React/runtime code assumes exist.
3. Initializes local filesystem and localstore substrate.

The first registration is the core binding:

```zig
.{ .name = "core", .required = true, .grep_prefix = "", .reg_fn = "registerCore", .mod = v8_bindings_core }
```

Core registers host functions used by the runtime itself:

```zig
v8_runtime.registerHostFn("__hostFlush", hostFlush);
v8_runtime.registerHostFn("__getInputTextForNode", hostGetInputTextForNode);
v8_runtime.registerHostFn("__hostLoadFileToBuffer", hostLoadFileToBuffer);
v8_runtime.registerHostFn("__hostReleaseFileBuffer", hostReleaseFileBuffer);
v8_runtime.registerHostFn("__hostLog", hostLog);
v8_runtime.registerHostFn("__js_eval", hostJsEval);
v8_runtime.registerHostFn("__setState", hostSetState);
v8_runtime.registerHostFn("__setStateString", hostSetStateString);
v8_runtime.registerHostFn("__getState", hostGetState);
v8_runtime.registerHostFn("__latchSet", hostLatchSet);
v8_runtime.registerHostFn("__latchGet", hostLatchGet);
v8_runtime.registerHostFn("__anim_register", hostAnimRegister);
v8_runtime.registerHostFn("__anim_unregister", hostAnimUnregister);
v8_runtime.registerHostFn("__getStateString", hostGetStateString);
v8_runtime.registerHostFn("__markDirty", hostMarkDirty);
```

It also registers mouse, viewport, file-watch, terminal cwd, and related core
helpers later in the same function.

V8 polyfills installed by `appInit()`:

| Polyfill | Purpose |
| --- | --- |
| `console.log/warn/error/info/debug` | Routes to `__hostLog`. |
| `setTimeout` | Stores timer records in `globalThis._timers`. |
| `setInterval` | Same timer list with `interval: true`. |
| `clearTimeout` / `clearInterval` | Removes timer records. |
| `__jsTick(now)` | Fires due timers once per engine tick. |
| `__beginJsEvent` / `__endJsEvent` | Event boundary hooks; initially no-op. |

## React Mutation Pipeline

The React runtime boot happens when `engine.run()` evaluates `js_logic`:

```ts
const reconciler = Reconciler(hostConfig);
const container = reconciler.createContainer({ id: 0 }, 0, null, false, null, '', (_e: any) => {}, null);
reconciler.updateContainer(React.createElement(App, {}), container, null, null);
```

`renderer/hostConfig.ts` maps HTML-ish tags to ReactJIT host types, strips DOM
props, resolves `className` through `tw()`, creates mutation commands, and
schedules a microtask flush:

```ts
const payload = JSON.stringify(coalesced);
transportFlush(payload);
```

`transportFlush` resolves to `globalThis.__hostFlush`.

`framework/v8_bindings_core.zig` does not apply the commands immediately.
`hostFlush()` copies the payload into `g_pending_flush`:

```zig
const owned = std.heap.c_allocator.dupe(u8, payload) catch return;
g_pending_flush.append(std.heap.c_allocator, owned) catch { ... };
```

The queued flushes are drained during `v8_app.appTick()`:

```zig
fn drainPendingFlushes() void {
    v8_bindings_core.drainPendingFlushes(applyCommandBatch);
}
```

`applyCommandBatch()` parses the JSON array, applies each command, forwards
secondary-window commands, cleans up detached nodes, and sets `g_dirty` through
the individual command handlers.

Command kinds currently handled:

| Command | Effect |
| --- | --- |
| `CREATE` | Ensures a host node exists, applies type defaults, applies props, opens host windows if needed, captures debug name/source, records handler flags. |
| `CREATE_TEXT` | Ensures a text node and stores `node.text`. |
| `APPEND` | Adds child ID under parent ID, records parent link, inherits typography. |
| `APPEND_TO_ROOT` | Adds child ID to root child list. |
| `INSERT_BEFORE` | Inserts child ID before another child under a parent. |
| `INSERT_BEFORE_ROOT` | Inserts top-level child before another root child. |
| `REMOVE` | Removes child ID from a parent and drops parent link. |
| `REMOVE_FROM_ROOT` | Removes a top-level child. |
| `UPDATE` | Removes stale props/styles, applies new props, updates handlers, propagates typography to text children. |
| `UPDATE_TEXT` | Replaces text node contents. |

Every structural or prop mutation stamps `subtree_last_mutated_frame` through
`markSubtreeDirty()` so `StaticSurface` caches can detect stale ancestors.

## Materialized Node Tree

`v8_app.zig` keeps a stable heap-owned pool, but the engine consumes an
arena-materialized tree each frame.

When `g_dirty` is true, `appTick()` runs:

```zig
snapshotRuntimeState();
rebuildTree();
layout.markLayoutDirty();
g_dirty = false;
g_scroll_prop_slots.clearRetainingCapacity();
```

`snapshotRuntimeState()` syncs runtime-owned state, such as current scroll and
input state, from the last rendered tree back into the stable pool before the
arena tree is reset.

`rebuildTree()`:

1. Resets `g_arena` with retained capacity.
2. Materializes secondary window roots first.
3. Builds dev-mode chrome nodes when `DEV_MODE` is true.
4. Builds borderless resize-edge nodes when borderless mode is active.
5. Copies stable node structs from `g_node_by_id` into contiguous arena child
   arrays.
6. Recursively fills `children` with `materializeChildren(...)`.
7. Sets `g_root.children` to the final arena slice consumed by the engine.

In dev mode, the cart's top-level children are wrapped below a 32px chrome row
so `height: '100%'` resolves against the remaining content area.

## Engine Startup

Source: `framework/engine.zig`

`run()` startup order:

1. Store `dispatch_js_event` in a global used by event dispatch helpers.
2. Initialize crashlog and install signal policy:
   - ignore SIGPIPE, SIGHUP, SIGTSTP
   - install quit handler for SIGINT and SIGTERM
3. Start watchdog outside dev mode.
4. Start debug server when compiled and `TSZ_DEBUG=1`.
5. Initialize witness recording/replay.
6. Call `SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO)`.
7. Initialize voice and whisper.
8. Initialize Canvas runtime.
9. Restore geometry from persisted window state, unless `ZIGOS_HEADLESS` is set.
10. Apply window overrides from `ZIGOS_WINDOW_W/H/X/Y` and `AppConfig.x/y`.
11. Create the SDL window with flags derived from config and environment.
12. Register borderless hit-test callback when `borderless` is true.
13. Start SDL text input.
14. Initialize videos, render surfaces, capture, and effects.
15. Initialize WGPU through `gpu.init(window)`.
16. Initialize FreeType text engine and wire measurement callbacks into layout
    and input.
17. Initialize V8 through `js_vm.initVM()`.
18. Install no-op IFTTT globals used by system signals.
19. Initialize LuaJIT runtime.
20. Register legacy QJS host functions for audio, PTY client, and AppleScript.
21. Register the window-open bridge for `__openWindow`.
22. Call `config.init`.
23. Evaluate `config.js_logic`.
24. Mark state dirty when scripts are present.
25. Enable test harness when `ZIGOS_TEST=1`.
26. Call `config.tick` once for initial dynamic text, host flush, and tree
    materialization.
27. Initialize PTY remote control.
28. Enter the main loop.

Window flags:

| Condition | SDL flag |
| --- | --- |
| Normal focusable window | `SDL_WINDOW_RESIZABLE` |
| macOS | `SDL_WINDOW_METAL` |
| `ZIGOS_HEADLESS` | `SDL_WINDOW_HIDDEN` |
| `config.borderless` | `SDL_WINDOW_BORDERLESS` |
| `config.always_on_top` | `SDL_WINDOW_ALWAYS_ON_TOP` |
| `config.not_focusable` | `SDL_WINDOW_NOT_FOCUSABLE | SDL_WINDOW_UTILITY` |

## Main Loop

The loop is `while (running)` inside `engine.run()`.

Per-frame order:

1. Exit if SIGINT/SIGTERM set the global quit flag.
2. Run legacy `config.check_reload`, if supplied.
3. Poll SDL events until the queue is empty.
4. Route events to secondary windows first.
5. Handle the main-window SDL event.
6. Run `js_vm.tick()` and record `tick_us`.
7. Run `luajit_runtime.tick()`.
8. Call `config.tick(now_ms)`.
9. Tick cartridges.
10. Tick transitions and mark layout dirty when transition output changed.
11. Initialize physics bodies once, before first layout.
12. Poll PTY remote control.
13. Discover terminal nodes, spawn shells, poll PTYs, classify terminal rows,
    and tick terminal semantic graph.
14. Apply coalesced text-input drag hit testing.
15. Run `layout.layout(config.root, 0, 0, win_w, win_h)`.
16. Re-resolve hover pointer after layout if `config.tick` invalidated it.
17. Optionally emit one-shot node dump.
18. Step physics and sync body positions to nodes.
19. Layout and present secondary windows.
20. Resolve deferred selection.
21. Update video and render surfaces.
22. Tick cursor blink.
23. Tick effects, 3D, filesystem watch, clipboard watch, voice, whisper, and
    system signals.
24. Paint the main tree through `paintNode(config.root)`.
25. Paint system-signal post-paint hooks, tooltip, context menu, resize HUD, and
    debug pairing overlay.
26. Present GPU queues through `gpu.frame(...)`.
27. Emit input latency logs when active.
28. Run capture, test harness, and witness tick/exit checks.
29. Collect unified telemetry.
30. Poll debug server and optionally push telemetry.
31. Roll once-per-second FPS, bridge, watchdog, audio, and LuaJIT telemetry.
32. Emit chrome drag trace when custom chrome is being dragged.

## Event Pipeline

All main-window input starts as SDL events in the engine loop.

### Window Events

| Event | Handling |
| --- | --- |
| `SDL_EVENT_QUIT` | Flush witness and leave the loop. |
| `SDL_EVENT_WINDOW_CLOSE_REQUESTED` | Leave the loop. |
| `SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED` | Update `win_w/win_h`, resize GPU, update breakpoint, notify system signals, save geometry, mark layout dirty, show resize HUD. |
| `SDL_EVENT_WINDOW_MOVED` | Save geometry. |
| focus gained/lost | Notify system signals. |
| drop file | Dispatch filedrop and notify system signals. |

### Pointer Events

Mouse button down order:

1. Borderless custom chrome double-click, drag, or resize handling.
2. Update shared mouse state.
3. Forward to render surfaces.
4. Start physics drag when applicable.
5. Dismiss or activate context-menu items.
6. Handle right-click native context menus or `onRightClick`.
7. Dispatch middle-click JS handler.
8. Handle scrollbar thumb drag.
9. Start Alt+drag Canvas node movement.
10. Hit-test normal layout nodes.
11. Focus text input or dispatch mouse/press handlers.
12. Open `href` URLs when hit.
13. Record witness click.
14. If no normal hit, hit-test Canvas children, Canvas selection, or Canvas pan.
15. Handle terminal selection start when relevant.

Mouse motion:

| State | Handling |
| --- | --- |
| Custom chrome dragging | Moves the SDL window. |
| Scrollbar dragging | Updates scroll position and dispatches scroll changed. |
| Text input drag | Coalesces byte-position hit testing until frame tick. |
| Physics drag | Updates physics drag target. |
| Canvas node move drag | Mutates host pool position and dispatches throttled `__dispatchCanvasMove`. |
| Canvas pan | Updates Canvas camera. |
| General hover | Hit-tests hoverable nodes, dispatches enter/exit handlers, updates tooltip and pointer cursor. |

Mouse button up clears active drag state, commits Canvas move drag, ends physics
drag, ends text selection drag, and calls `selection.onMouseUp()`.

Mouse wheel order:

1. Record witness scroll.
2. Scroll terminal scrollback if pointer is over a terminal.
3. If inside Canvas, scroll nested scroll containers before Canvas zoom.
4. Else scroll normal `ScrollView` containers.
5. Persist scroll slots and dispatch `onScroll` when present.

### Keyboard And Text Events

Text input order:

1. Native terminal text input.
2. Legacy PTY text input.
3. Render-surface text forwarding.
4. Focused `TextInput` / `TextArea` / `TextEditor` text insertion.

Key down order:

1. Capture controls.
2. Terminal copy/paste and semantic overlay shortcuts.
3. Native terminal special key routing.
4. Legacy PTY special key routing.
5. Render-surface key forwarding.
6. Focused input key handling.
7. Video key handling.
8. Selection key handling.
9. IFTTT keydown global.
10. Legacy `__onKeyDown` global.

Key up forwards to render surfaces and IFTTT keyup.

## App Tick Pipeline

In V8 mode, `config.tick` is `v8_app.appTick(now)`.

Order:

1. In dev mode, poll dev IPC and process pushed bundles.
2. Check disk bundle mtime every 16 ticks and schedule reload when changed.
3. If reload is pending, perform reload and return.
4. Call `__jsTick(now)` so JS timers run.
5. Run each ingredient's `tickDrain()` when present.
6. Drain pending React mutation flushes and apply command batches.
7. Tick host animations and write animation outputs into latches.
8. Sync dirty latches into node style fields.
9. Tick independent secondary windows.
10. Clean up closed host windows.
11. If `g_dirty`, snapshot runtime state, rebuild the arena tree, mark layout
    dirty, clear scroll prop slots, and reset `g_dirty`.

Subscriber callbacks emitted by binding `tickDrain()` paths generally defer via
`setTimeout(0)`, so JS observes them on the next `__jsTick`.

## Layout Pipeline

The engine calls:

```zig
layout.layout(config.root, 0, 0, win_w, app_h);
```

The root is the `g_root` materialized by `v8_app.appTick()`. Layout computes
`node.computed` rectangles, content sizes, scroll extents, and measurement
results. Text measurement uses the engine-owned `TextEngine` through callbacks:

| Callback | Wired by |
| --- | --- |
| `layout.setMeasureFn(measureCallback)` | Wrapped text measurement. |
| `layout.setMeasureImageFn(measureImageCallback)` | Image measurement. |
| `input.setMeasureWidthFn(measureWidthOnly)` | Input cursor/selection measurement. |

The engine currently calls layout every frame. `layout.markLayoutDirty()` is
still used by subsystems to signal geometry changes and layout cache invalidity.

## Paint Pipeline

The engine paints from the materialized `layout.Node` tree:

```zig
selection.resetWalkState();
g_paint_count = 0;
g_budget_exceeded = false;
g_hidden_count = 0;
paintNode(config.root);
```

`paintNode()` order:

1. Skip `display: none`, static-surface overlay capture exclusions, zero-size
   rects, and paint-budget overflow.
2. Paint `Canvas.Path` nodes early.
3. Push transform matrix for rotation, scale, and translate.
4. Apply cascading opacity.
5. Capture and composite filter subtrees when `filter_name` is set.
6. Capture and composite `StaticSurface` subtrees when cached or warming.
7. Paint the node's own visuals through `paintNodeVisuals()`.
8. Paint background effect children.
9. If node is a Canvas container, delegate to the Canvas paint path and return.
10. If node is a Graph container, push graph transform/scissor, paint children,
    restore transform, and return.
11. Push overflow/scroll scissor when needed.
12. Offset descendants for scroll positions.
13. Paint children in z order.
14. Paint scrollbars.
15. Pop scissor and restore opacity.

`paintNodeVisuals()` handles background, shadow, border, hover affordance,
text, images, inputs, terminal cells, video/render surfaces, native surfaces,
inline glyphs, effects, and primitive-specific visual details.

After the main tree, the engine paints overlays:

| Overlay | Source |
| --- | --- |
| Tooltip | `tooltip.paintOverlay(...)` |
| Context menu | `context_menu.paintOverlay(...)` |
| Resize HUD | Inline engine drawing |
| Debug pairing modal | `debug_server.getPairingCode()` |

Finally:

```zig
gpu.frame(0.051, 0.067, 0.090);
```

submits/presents the queued GPU work.

## Telemetry And Debug IPC

After GPU present and capture/test/witness checks, the engine records a unified
snapshot:

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

Then:

```zig
debug_server.poll();
```

The debug server starts only when compiled and `TSZ_DEBUG=1`. It can serve tree,
node, state, perf, telemetry history, and throttled telemetry stream messages
from the same `telemetry.current` snapshot.

Once per second the engine updates:

| Counter or subsystem | Action |
| --- | --- |
| FPS | Store `fps_frames` into `qjs_runtime.telemetry_fps` and `luajit_runtime.telemetry_fps`. |
| Bridge calls | Store and reset `qjs_runtime.bridge_calls_this_second`. |
| Stderr telemetry | Print every 10 seconds by default, every second with `ZIGOS_TELEMETRY=1`. |
| Log telemetry | Write every second through `log.writeLine`. |
| LuaJIT worker | `luajit_worker.logTelemetry()`. |
| Audio | `audio.logTelemetry()`. |
| Watchdog | `watchdog.heartbeat()`. |

## Hot Reload

There are two reload paths:

| Path | Owner | Status |
| --- | --- | --- |
| `AppConfig.check_reload` | `engine.run()` | Legacy per-frame hook. If it returns true, engine calls `init`, evaluates scripts, calls `post_reload`, calls `tick`, and marks layout dirty. |
| V8 dev reload | `v8_app.appTick()` | Current dev-mode path. Polls `bundle.js` mtime and dev IPC, resets V8 context, clears stale tree state, re-runs `appInit`, re-evaluates the bundle, and rebuilds the tree. |

V8 runtime reload does not tear down the V8 platform. `framework/v8_runtime.zig`
keeps the isolate and resets only the Context plus top-level HandleScope:

```zig
pub fn resetContextForReload() void {
    ...
    const context = v8.Context.init(iso, null, null);
    context.enter();
    g_context = context;
    @import("input.zig").clearAll();
}
```

After reset, `v8_app.appInit()` must register host functions again because host
functions are installed on the new global context.

Before reload, `clearTreeStateForReload()` drops `g_root.children`, clears
pending host flushes, unregisters input slots, and frees tree-owned allocations
so stale mutation batches from the old bundle cannot attach to the new tree.

## Child Window Pipeline

`v8_app.main()` switches into child-window mode when `ZIGOS_WINDOW_CHILD` is set.

Child mode:

1. Reads `ZIGOS_WINDOW_ID` and connection options from environment.
2. Calls `engine.run()` with empty `js_logic`.
3. Uses `childInit()` to connect to the parent IPC server.
4. Uses `childTick()` to drain all queued IPC messages every frame.
5. Applies `init` and `mutations` messages through the same `applyCommand()`
   path used by normal host flushes.
6. Rebuilds its local `g_root` when dirty.
7. Forwards child events back to the parent through `childDispatchEvent()`.
8. Calls `childShutdown()` on exit to send `onClose` to the parent.

The child process paints its own SDL window through the same engine layout and
paint pipeline. It just receives its tree over IPC instead of evaluating a cart
bundle locally.

## Shutdown Pipeline

The engine exits the loop on SDL quit/close or signal-requested shutdown. Some
test/capture/witness paths call `std.process.exit(...)` directly after their
work is complete.

Normal loop exit unwinds defers in reverse order:

| Cleanup | Owner |
| --- | --- |
| PTY remote deinit | `pty_remote.deinit()` |
| App shutdown | `config.shutdown()` |
| LuaJIT VM | `luajit_runtime.deinit()` |
| V8 VM | `js_vm.deinit()` |
| Text engine | `te.deinit()` |
| GPU | `gpu.deinit()` |
| Effects/capture/render surfaces/videos | Their respective `deinit()` calls |
| Secondary windows | `windows.deinitAll()` |
| Main window | `SDL_DestroyWindow(window)` |
| SDL, voice, whisper, watchdog, crashlog | Main SDL defer block |
| Debug server | `debug_server.deinit()` |

The SDL defer explicitly releases mouse capture and ends chrome drag before
`SDL_Quit()` so a shutdown during window dragging does not leave the OS pointer
grabbed.

`v8_app.appShutdown()` additionally frees window title allocations and calls:

```zig
localstore.deinit();
fs_mod.deinit();
```

## Environment Controls

| Variable | Effect |
| --- | --- |
| `ZIGOS_HEADLESS` | Creates a hidden window and skips persisted geometry load. |
| `ZIGOS_WINDOW_W` / `ZIGOS_WINDOW_H` | Override startup window size. |
| `ZIGOS_WINDOW_X` / `ZIGOS_WINDOW_Y` | Override startup window position. |
| `ZIGOS_TEST=1` | Enables test harness. |
| `TSZ_DEBUG=1` | Starts encrypted debug IPC server when compiled. |
| `ZIGOS_TELEMETRY=1` | Prints telemetry to stderr every second instead of every 10 seconds. |
| `REACTJIT_VERBOSE_BATCHES` | Logs host flush parse/apply/rebuild timing. |
| `REACTJIT_NODEDUMP` | Enables one-shot visible-node coordinate dump. |
| `ZIGOS_LOG_FILE` | Used by log paths such as chrome drag trace. |
| `ZIGOS_WINDOW_CHILD` | Starts the child-window IPC mode. |
| `ZIGOS_WINDOW_ID` | Child-window target ID. |
| `ZIGOS_WINDOW_TITLE` | Child-window title. |
| `ZIGOS_WINDOW_AUTO_DISMISS_MS` | Auto-exits child window after a delay. |
| `ZIGOS_WINDOW_BORDERLESS` | Borderless child window. |
| `ZIGOS_WINDOW_ALWAYS_ON_TOP` | Always-on-top child window. |
| `ZIGOS_WINDOW_NOT_FOCUSABLE` | Non-focusable child window. |
| `ZIGOS_TRACE_IPC` | Logs child-window IPC receive/apply details. |

## Timing Semantics

| Metric | Scope |
| --- | --- |
| `tick_us` | Time around `js_vm.tick()`. In V8 this is usually near-zero because timers are driven by `appTick().__jsTick`, not `v8_runtime.tick()`. |
| `layout_us` | Time around the main `layout.layout(...)` call. |
| `paint_us` | Time around `paintNode(...)` plus overlays before `gpu.frame(...)`. |
| `frame_total_us` | Time from before `js_vm.tick()` through post-present capture/test/witness checks and just before telemetry collection. |
| input latency | Time from first input event in a frame to after `gpu.frame(...)`, printed when active. |
| chrome drag trace | Per-loop event, JS tick, app tick, layout, paint, and GPU timings while chrome dragging. |

## Known Boundaries

| Boundary | Detail |
| --- | --- |
| Engine vs React | The engine never sees React fibers. It sees `layout.Node` structs materialized by `v8_app.zig`. |
| Stable pool vs render tree | `g_node_by_id` is stable heap state; `g_root.children` is an arena snapshot rebuilt when `g_dirty` is true. |
| V8 vs QJS names | V8 builds still update `qjs_runtime` globals for telemetry and legacy bridge state. Do not assume the name means the QuickJS VM is driving app logic. |
| Layout cadence | Layout is called every frame, but dirty flags still invalidate caches and trigger rebuilds. |
| Event dispatch | Native events run Zig handlers and/or evaluate V8 globals. React updates become queued mutation batches and land on the next app tick drain. |
| Node pointers | `hovered_node` and similar pointers can be invalidated by `config.tick`; the engine nulls and re-resolves hover after layout. |
| Optional substrates | Many subsystems compile to stubs behind build options, but their call sites stay in the engine loop. |
| Dev reload | V8 reload resets the Context, not the platform/isolate. Host functions must be re-registered for the fresh context. |

## Extension Checklist

When adding an engine-facing primitive or subsystem:

1. Add host prop decoding in `v8_app.zig` so React mutations update `layout.Node`.
2. Add persistent runtime fields to `layout.Node` only when layout, paint,
   hit-testing, telemetry, or event dispatch needs them.
3. If the feature needs a host binding, add it to the correct V8 binding module
   and, if optional, to `INGREDIENTS`, `build.zig`, and `sdk/dependency-registry.json`.
4. Wire per-frame work into `appTick()` when it is JS/binding/tree related.
5. Wire per-frame native work into `engine.run()` near the subsystem it depends
   on: before layout, after layout, before paint, after paint, or after present.
6. Keep per-frame work allocation-free or bounded; the engine loop runs it every
   visible frame.
7. Add telemetry fields only through `framework/telemetry.zig`, with a clear
   provider function in the subsystem.

