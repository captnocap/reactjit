# Window Location Memory — Native Engine

## Goal

When a tsz app closes, save the window position and size. When it reopens, restore to exactly where it was. Same behavior as the Love2D stack (`love2d/lua/window_manager.lua`).

## Reference: How Love2D Does It

File: `love2d/lua/window_manager.lua` (lines 377-487)

- **Format:** JSON in `save/window_geometry.json` — `{"x":100,"y":200,"width":1024,"height":768,"display":1}`
- **Save triggers:** window move, window resize, app quit
- **Restore:** at startup, after window creation
- **Validation:** checks display still exists, position is on-screen, falls back to centered if not
- **Anti-race:** blocks saves for 2 seconds after restore to prevent resize callbacks from overwriting
- **Main window only** — child windows don't persist

## Current Native Engine State

File: `tsz/runtime/windows.zig`

- Windows created with `SDL_WINDOWPOS_CENTERED` hardcoded (line 64)
- No geometry persistence whatsoever
- Main window created in `main.zig` (from `main_template.txt`) — also centered

File: `tsz/runtime/main.zig` / `main_template.txt`

- Main window also uses `SDL_WINDOWPOS_CENTERED`
- Handles `SDL_WINDOWEVENT_SIZE_CHANGED` to update `win_w`/`win_h`
- No position tracking

## Implementation

### New file: `tsz/runtime/geometry.zig`

A small module that saves/loads window geometry to disk. Main window only.

```zig
const std = @import("std");
const c = @import("c.zig").imports;

const GEOMETRY_FILE = "window_geometry.dat";

pub const WindowGeometry = struct {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
};

const SAVE_BLOCK_MS: u32 = 2000; // block saves for 2s after restore
var save_blocked_until: u32 = 0;
```

#### Storage location

Use `~/.config/tsz/<app-name>/geometry.dat` (XDG on Linux, `~/Library/Application Support/tsz/` on macOS, `%APPDATA%/tsz/` on Windows).

Or simpler: use `/tmp/tsz-geometry-<app-name>.dat` to match the existing state persistence pattern (`/tmp/tsz-state.bin`). The state system already uses `/tmp/` — keep it consistent for now. A proper XDG path is a future improvement.

**Format:** Binary, 16 bytes — 4 x i32 (x, y, width, height). No JSON parsing needed in Zig. Simple, fast, no allocation.

#### Save function

```zig
pub fn save(window: *c.SDL_Window) void {
    // Check save block (anti-race after restore)
    const now = c.SDL_GetTicks();
    if (now < save_blocked_until) return;

    var x: c_int = undefined;
    var y: c_int = undefined;
    c.SDL_GetWindowPosition(window, &x, &y);

    var w: c_int = undefined;
    var h: c_int = undefined;
    c.SDL_GetWindowSize(window, &w, &h);

    const geom = WindowGeometry{
        .x = @intCast(x),
        .y = @intCast(y),
        .width = @intCast(w),
        .height = @intCast(h),
    };

    const bytes: [16]u8 = @bitCast(geom);
    const file = std.fs.createFileAbsolute(getPath(), .{}) catch return;
    defer file.close();
    file.writeAll(&bytes) catch {};
}
```

#### Load function

```zig
pub fn load() ?WindowGeometry {
    const file = std.fs.openFileAbsolute(getPath(), .{}) catch return null;
    defer file.close();

    var bytes: [16]u8 = undefined;
    const n = file.readAll(&bytes) catch return null;
    if (n < 16) return null;

    const geom: WindowGeometry = @bitCast(bytes);

    // Validate: position must be reasonable (not wildly off-screen)
    // SDL doesn't give us display bounds easily in a cross-platform way,
    // so just check the values aren't absurd (negative thousands, etc.)
    if (geom.width < 100 or geom.height < 100) return null;
    if (geom.width > 10000 or geom.height > 10000) return null;
    if (geom.x < -5000 or geom.x > 10000) return null;
    if (geom.y < -5000 or geom.y > 10000) return null;

    return geom;
}
```

Better validation using SDL display bounds:

```zig
pub fn load() ?WindowGeometry {
    // ... read bytes, bitcast to geom ...

    // Validate against actual display bounds
    const num_displays = c.SDL_GetNumVideoDisplays();
    if (num_displays <= 0) return geom; // can't validate, trust it

    // Check if position is on ANY connected display
    var on_screen = false;
    var i: c_int = 0;
    while (i < num_displays) : (i += 1) {
        var bounds: c.SDL_Rect = undefined;
        if (c.SDL_GetDisplayBounds(i, &bounds) == 0) {
            // Window center must be within display bounds
            const cx = geom.x + @divTrunc(geom.width, 2);
            const cy = geom.y + @divTrunc(geom.height, 2);
            if (cx >= bounds.x and cx < bounds.x + bounds.w and
                cy >= bounds.y and cy < bounds.y + bounds.h)
            {
                on_screen = true;
                break;
            }
        }
    }

    if (!on_screen) return null; // saved position is off-screen, fall back to centered
    return geom;
}
```

#### Path helper

```zig
var path_buf: [256]u8 = undefined;
var path_len: usize = 0;

pub fn init(app_name: []const u8) void {
    const prefix = "/tmp/tsz-geometry-";
    const suffix = ".dat";
    const total = prefix.len + app_name.len + suffix.len;
    if (total >= path_buf.len) return;
    @memcpy(path_buf[0..prefix.len], prefix);
    @memcpy(path_buf[prefix.len..prefix.len + app_name.len], app_name);
    @memcpy(path_buf[prefix.len + app_name.len..total], suffix);
    path_len = total;
}

fn getPath() []const u8 {
    if (path_len == 0) return "/tmp/tsz-geometry.dat";
    return path_buf[0..path_len];
}
```

#### Block saves after restore

```zig
pub fn blockSaves() void {
    save_blocked_until = c.SDL_GetTicks() + SAVE_BLOCK_MS;
}
```

### Changes to main_template.txt / generated code

#### At startup (after window creation):

```zig
// Restore window geometry
geometry.init("appname"); // app name from compiler
if (geometry.load()) |geom| {
    c.SDL_SetWindowPosition(window, geom.x, geom.y);
    c.SDL_SetWindowSize(window, geom.width, geom.height);
    win_w = @floatFromInt(geom.width);
    win_h = @floatFromInt(geom.height);
    geometry.blockSaves();
}
```

#### On window events (in the event loop):

```zig
c.SDL_WINDOWEVENT => {
    const we = event.window.event;
    if (we == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
        win_w = @floatFromInt(event.window.data1);
        win_h = @floatFromInt(event.window.data2);
        geometry.save(window); // save on resize
    }
    if (we == c.SDL_WINDOWEVENT_MOVED) {
        geometry.save(window); // save on move
    }
},
```

#### On quit (before cleanup):

```zig
// Already handled by move/resize events, but save once more on quit for safety
geometry.save(window);
```

### Compiler changes

File: `tsz/compiler/codegen.zig` — `emitZigSource()`

1. Add `const geometry = @import("geometry.zig");` to imports
2. After window creation in `main_template.txt`, emit geometry restore code
3. The app name comes from the `.tsz` filename — already available as `self.input_file`
4. Add `SDL_WINDOWEVENT_MOVED` handling to the event loop template

### Files

| File | Change |
|------|--------|
| `tsz/runtime/geometry.zig` | **New** — save/load/validate window geometry |
| `tsz/compiler/codegen.zig` | Add geometry import, emit restore code in emitZigSource |
| `tsz/compiler/main_template.txt` | Add MOVED event handling, geometry save on quit |
| `tsz/compiler/loop_template.txt` | Add MOVED event case with geometry save |

### What This Does NOT Cover

- **Secondary windows** — only the main window persists. Child `<Window>` elements don't save geometry. Same as Love2D.
- **XDG/platform-correct paths** — uses `/tmp/` for now, matching state persistence. Future improvement.
- **Display index tracking** — the Love2D version saves which display the window was on. SDL2's `SDL_GetWindowDisplayIndex()` could do this, but it's not critical for v0.
- **Maximized/fullscreen state** — not tracked. Window flags could be saved but adds complexity.

### Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/counter.tsz
# Run 1: move the window somewhere specific, close it
./zig-out/bin/tsz-counter
# Run 2: window should appear at the same position
./zig-out/bin/tsz-counter
# Verify: ls -la /tmp/tsz-geometry-counter.dat (16 bytes)
```
