# TSZ Modules

Framework modules live in `framework/`. The engine owns the lifecycle — adding a module never touches codegen.

## Adding a Module

1. Create `framework/your_module.zig`
2. Import and use it from `framework/engine.zig`
3. Done. Every app gets it for free.

## Example: geometry.zig

```zig
// framework/geometry.zig
const std = @import("std");
const c = @import("c.zig").imports;  // shared C imports (SDL2, FreeType, etc.)

pub const WindowGeometry = struct {
    x: i32, y: i32, width: i32, height: i32,
};

pub fn init(app_name: []const u8) void { ... }
pub fn save(window: *c.SDL_Window) void { ... }
pub fn load() ?WindowGeometry { ... }
pub fn blockSaves() void { ... }
```

Wired into `engine.zig`:
```zig
const geometry = @import("geometry.zig");

pub fn run(config: AppConfig) !void {
    // ...
    geometry.init(std.mem.span(config.title));
    if (geometry.load()) |g| { /* restore position */ }
    // ... in event loop:
    //   SDL_WINDOWEVENT_MOVED => geometry.save(window),
    //   SDL_WINDOWEVENT_SIZE_CHANGED => geometry.save(window),
}
```

The generated app never sees geometry. It just calls `engine.run()`.

## Breakpoints (framework/breakpoint.zig)

Responsive layout tiers matching the Love2D stack: `sm` (0-639px), `md` (640-1023px), `lg` (1024-1439px), `xl` (1440px+).

Updated automatically by the engine on init and window resize. Framework modules and generated apps can query the current breakpoint to adapt layout:

```zig
const breakpoint = @import("breakpoint.zig");

const bp = breakpoint.current();       // .sm, .md, .lg, .xl
const w = breakpoint.width();          // current window width as f32
if (breakpoint.atLeast(.lg)) { ... }   // true if desktop or wider
const label = breakpoint.name();       // "sm", "md", "lg", "xl"
```

## Multi-Window (framework/windows.zig)

Three window types, one API:

| Kind | Process | Renderer | Use case |
|------|---------|----------|----------|
| `.in_process` | Same | SDL2 renderer | Inspector, devtools, debug panels |
| `.notification` | Same | SDL2 renderer | Toasts, alerts, transient overlays |
| `.independent` | Separate | Own wgpu surface | Docked multi-panel UIs, complex apps |

**Why not wgpu for in-process?** `gpu.zig` is a singleton bound to one surface. In-process windows use SDL2 renderers instead — simple, proven, no singleton conflicts. Independent windows get their own process with their own wgpu, connected via TCP/NDJSON (same pattern as the Love2D stack).

```zig
const windows = @import("windows.zig");

// Open an inspector panel (in-process, SDL2 renderer)
const win = windows.open(.{ .title = "Inspector", .width = 400, .height = 600 });
windows.setRoot(win, &inspector_tree);

// Fire a notification (auto-dismisses after 5s, no focus steal)
_ = windows.open(.{
    .title = "Build Complete",
    .kind = .notification,
    .width = 300,
    .height = 80,
    .auto_dismiss_ms = 5000,
});

// In the main loop — engine.zig handles this automatically:
//   windows.routeEvent(&event);   // event dispatch
//   windows.layoutAll();          // flex layout
//   windows.paintAndPresent();    // SDL2 paint + present
```

Notification windows get X11 `_NET_WM_WINDOW_TYPE_NOTIFICATION` hints (no taskbar, no focus steal) and fade in/out automatically.

## What Goes Where

| Location | What | Example |
|----------|------|---------|
| `framework/engine.zig` | Lifecycle, wiring | SDL init, GPU, event loop |
| `framework/*.zig` | Self-contained modules | geometry, watchdog, image cache |
| `generated_app.zig` | App-specific only | Node tree, handlers, state, tick |

## Logging (framework/log.zig)

Runtime logging that is **always compiled in** but **silent by default**. Never remove log calls — they're there for next time.

Enable via environment variable:
```bash
ZIGOS_LOG=all ./app                    # everything
ZIGOS_LOG=events,selection ./app       # specific categories
./app                                  # silent (default)
```

Categories: `engine`, `events`, `layout`, `state`, `selection`, `gpu`, `geometry`, `text`, `ffi`, `tick`

Usage in any framework module:
```zig
const log = @import("log.zig");

log.info(.selection, "click #{d} on node", .{sel_click_count});
log.warn(.state, "slot {d} overflow", .{id});
log.err(.gpu, "texture upload failed", .{});
```

**Rules:**
- When debugging, add log calls. **Do not remove them after fixing the bug.**
- Use the right category so it can be filtered at runtime.
- `log.info` for flow tracing, `log.warn` for unexpected-but-handled, `log.err` for failures.
- Cost when disabled: one bool check per call. Free.

## The Rule

If every app needs it, it's a framework module. If it's app-specific, it's codegen output.
The generated app provides: `root`, `_appInit()`, `_appTick(now)`, and calls `engine.run()`. That's it.
