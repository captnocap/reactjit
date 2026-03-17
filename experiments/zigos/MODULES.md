# ZigOS Modules

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
