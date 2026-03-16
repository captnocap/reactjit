---
title: Runtime Internals
description: Watchdog, BSOD, video playback, GPU pipeline, virtual terminal, and mouse state
category: Runtime
keywords: watchdog, bsod, crash screen, mpv, video, wgpu, gpu, vterm, pty, mouse
related: Layout, State, GPU
difficulty: advanced
---

## Overview

The tsz runtime is a set of Zig modules that back the compiled app code. None of these are user-facing APIs in normal `.tsz` authoring — they're what the compiler's generated output calls at runtime, and what contributors need to understand when the engine itself breaks.

---

## Watchdog

The watchdog guards against runaway memory usage and detects leaks during development. It reads `/proc/self/statm` every 60 frames (~1 second at 60fps) and compares RSS against two thresholds.

**Hard limit:** 512 MB. If RSS reaches this, the watchdog fires immediately.

**Rate limit:** 50 MB per check interval (~50 MB/s). If RSS grows faster than this in one second, the watchdog treats it as a leak and fires after the first occurrence.

When either threshold is exceeded, `check()` returns `true` and the main loop breaks, handing off to `bsod.show()` with a diagnostic payload.

```zig
// Usage in main loop (generated_app.zig)
watchdog.init(512); // 512 MB hard limit
// ...
if (watchdog.check()) break; // true = shut down, BSOD follows
```

The diagnostic payload includes:

- RSS at crash vs. RSS at startup, total growth
- GPU stats: glyph atlas fill percentage (cache holds up to 2048 glyphs), rect batch slots used, glyph batch slots used
- Runtime stats: active state slots, open window count
- RSS trend ring buffer (last 30 samples, ~30 seconds of history)
- Inferred likely cause based on unaccounted memory

**Known fixed allocations:**

| Allocation | Size |
|---|---|
| Glyph atlas texture (2048x2048 RGBA) | 16 MB |
| Rect instance batch (4096 slots) | ~1 MB |
| Glyph instance batch (8192 slots) | ~1 MB |
| Total known fixed | ~18 MB |

Anything above ~18 MB is "unaccounted" — the diagnostic report flags this and suggests causes (per-frame texture leaks, wgpu staging buffer leaks from missing `device.poll()`, FFI allocations, unbounded data growth).

---

## BSOD Crash Screen

The BSOD (`bsod.zig`) is a self-contained SDL2 crash screen that runs after the main app loop terminates due to a watchdog trigger. It has no dependency on the main GPU pipeline — it uses SDL2's software renderer directly so it can operate even if wgpu has been torn down.

`bsod.show(reason, detail)` blocks until the user dismisses it. While it runs:

- The crash reason and diagnostic detail are displayed in a scrollable layout
- RSS at crash time is shown in the title bar
- Three buttons are available: **Restart** (re-execs the binary via `/proc/self/exe`), **Copy** (copies all crash text to clipboard), **Quit**
- Keyboard shortcuts: `Esc`, `q`, `Enter` to dismiss; `Ctrl+C` to copy

The layout is defined in `tsz/examples/crash-screen.tsz`. The `.tsz` source was compiled to generate the node tree in `bsod.zig`, which is then patched at runtime with the actual crash reason and detail strings.

```tsz
// crash-screen.tsz — the BSOD source of truth
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0a14' }}>
      <Box style={{ height: 4, backgroundColor: '#d93340' }} />
      <Box style={{ padding: 24, flexGrow: 1, gap: 10 }}>
        <Text fontSize={22} color="#d93340">ReactJIT Crashed</Text>
        {/* ... reason, detail, buttons ... */}
      </Box>
    </Box>
  );
}
```

---

## Multi-Window Manager

`windows.zig` manages up to 8 simultaneous SDL2 windows in the same process. Each window gets its own `SDL_Window`, `SDL_Renderer`, `TextEngine`, and `ImageCache`. State (Zig variables) is shared — same address space, no IPC.

### API

| Function | Description |
|---|---|
| `windows.open(title, w, h)` | Open a new window, returns slot index |
| `windows.close(idx)` | Close a window by slot |
| `windows.setRoot(idx, &node)` | Assign a node tree to a window |
| `windows.layoutAll()` | Run layout pass for all active windows |
| `windows.paintAndPresent(brighten_fn)` | Paint and flip all active windows |
| `windows.handleResize(idx, w, h)` | Update window dimensions on resize |
| `windows.handleClick(idx, mx, my)` | Route click to hit-tested node |
| `windows.handleWheel(idx, mx, my, dy)` | Route scroll wheel to scroll container |
| `windows.count()` | Returns number of active windows |
| `windows.deinitAll()` | Close all windows |

In `.tsz`, the `<Window>` primitive maps to this module. Compiled code calls `windows.open()` on the first render and `windows.close()` when the node is removed.

**Important:** When painting, always use pointers into the slot structs — never copy `TextEngine` or `ImageCache`. Copying leaks SDL textures every frame.

---

## Video Playback

`mpv.zig` integrates libmpv for video playback. mpv opens its own window with full hardware-accelerated playback, native seek controls, OSD, and keyboard bindings. This is the same libmpv used by the mpv media player.

### API

| Function | Description |
|---|---|
| `mpv.play(path)` | Play a file or URL. Safe to call multiple times — replaces the current video |
| `mpv.stop()` | Stop playback |
| `mpv.setPaused(paused)` | Pause or resume |
| `mpv.poll()` | Drain mpv's event queue. Call once per frame |
| `mpv.deinit()` | Clean shutdown |

`play()` is lazy — it initializes libmpv on the first call. Configuration used:

- `vo=gpu` — GPU video output
- `hwdec=auto` — hardware decoding when available
- `keep-open=yes` — window stays open after playback ends
- `input-default-bindings=yes` — standard mpv keyboard shortcuts work

`poll()` must be called every frame. Without it, mpv cannot process window-close or end-of-file events, and the mpv window will appear frozen.

In `.tsz`:

```tsz
// @ffi — not required, playVideo() is a built-in
function App() {
  return (
    <Pressable onPress={() => playVideo('/path/to/video.mp4')}>
      <Text fontSize={16} color="#fff">Play Video</Text>
    </Pressable>
  );
}
```

`playVideo()` is a compiler built-in that emits a call to `mpv_mod.play()` in the generated code.

---

## GPU Rendering Pipeline

`gpu.zig` is the wgpu-native rendering backend. SDL2 handles windowing and events; wgpu gets the native window handle from SDL to create a Vulkan surface (X11 and Wayland both supported).

### Architecture

Each frame, the pipeline processes two batched draw lists:

**Rect pipeline:** Up to 4096 instanced rectangles per frame. Each `RectInstance` (80 bytes) carries position, size, background color, border color, corner radii, and border width. WGSL shaders handle anti-aliased rounded corners in the fragment stage.

**Text pipeline:** Up to 8192 instanced glyphs per frame. Glyphs are rasterized by FreeType into a 2048x2048 RGBA atlas texture (16 MB fixed). The atlas is built lazily — each unique (codepoint, size) pair is packed into the atlas on first use, with a capacity of 2048 distinct glyphs. The text pipeline samples from this atlas with a linear sampler.

### Frame sequence

```zig
// In main loop (generated):
gpu.drawRect(x, y, w, h, r, g, b, a, radius, border_width, br, bg, bb, ba);
gpu.drawTextLine(text, x, y, size_px, cr, cg, cb, ca);
// ... more draw calls ...
gpu.frame(bg_r, bg_g, bg_b); // upload, render pass, present, poll device
```

`gpu.frame()` uploads the CPU-side batches to GPU buffers, executes a single render pass drawing rects then glyphs, presents the frame, and calls `device.poll(false, null)`. The poll is critical — without it, every `writeBuffer` and `writeTexture` call leaks its internal wgpu staging allocation, consuming ~512 MB in ~15 minutes at 60fps.

### Diagnostic stats

`gpu.getStats()` returns `Stats` used by the watchdog:

| Field | Description |
|---|---|
| `rect_count` / `rect_max` | Rects drawn last frame / batch capacity (4096) |
| `glyph_count` / `glyph_max` | Glyphs drawn last frame / batch capacity (8192) |
| `atlas_count` / `atlas_max` | Cached glyphs / capacity (2048) |
| `atlas_row_y` / `atlas_size` | Atlas packing progress / total size (2048) |

---

## Virtual Terminal

`vterm.zig` provides ANSI terminal emulation via libvterm. It is used by the built-in terminal emulator — a PTY is connected to a shell process, and vterm parses the output stream, maintaining a cell grid with per-cell color, character, and attribute data.

### Module-level API

| Function | Description |
|---|---|
| `vterm.initVterm(rows, cols)` | Create a new terminal of the given size |
| `vterm.feed(data)` | Feed raw bytes from the PTY to the terminal parser |
| `vterm.getRowText(row)` | Get the text content of a row (trailing spaces trimmed) |
| `vterm.getCell(row, col)` | Get a `Cell` struct with character, colors, and attributes |
| `vterm.getCursorRow()` / `getCursorCol()` | Current cursor position |
| `vterm.getCursorVisible()` | Cursor visibility state |
| `vterm.hasDamage()` | True if any cells changed since last clear |
| `vterm.clearDamageState()` | Reset damage tracking |
| `vterm.resizeVterm(rows, cols)` | Resize the terminal grid |
| `vterm.deinit()` | Free libvterm resources |

### Cell struct

```zig
pub const Cell = struct {
    char_buf: [4]u8,   // UTF-8 encoded character
    char_len: u8,      // byte length of character
    width: u8,         // 1 or 2 (wide characters)
    fg: ?Color,        // null = default foreground
    bg: ?Color,        // null = default background
    bold: bool,
    italic: bool,
    underline: bool,
    strike: bool,
    reverse: bool,
};
```

### Damage-driven rendering

libvterm tracks which rows changed (damage callbacks). `vterm.hasDamage()` returns true when any row was modified since the last `clearDamageState()`. The painter (`paintTerminal()`) renders only when needed, accumulating per-color text segments into a buffer and flushing each segment to `gpu.drawTextLine()` at the appropriate x/y position. The terminal dynamically resizes to fit its allocated box using actual font metrics from `gpu.getCharAdvance()` and `gpu.getLineHeight()`.

Cursor blink is handled in the painter with a 530ms toggle interval.

---

## Mouse State

`mouse.zig` is a single-writer, many-reader module for mouse position and button state. The main event loop updates it once per frame; any other module reads from it without making SDL calls.

### API

| Function | Description |
|---|---|
| `mouse.updatePosition(x, y)` | Called on `SDL_MOUSEMOTION` |
| `mouse.updateButton(button, down)` | Called on `SDL_MOUSEBUTTONDOWN/UP` |
| `mouse.x()` / `mouse.y()` | Current position |
| `mouse.prevX()` / `mouse.prevY()` | Position from previous frame |
| `mouse.deltaX()` / `mouse.deltaY()` | Movement since last frame |
| `mouse.leftDown()` | True if left button is held |
| `mouse.rightDown()` | True if right button is held |

Button codes: `1` = left, `3` = right (SDL2 convention).

This module has no dependencies and no SDL imports — it just holds state. Modules that need mouse position (overlay, inspector, hit testing) read from here rather than calling `SDL_GetMouseState()` independently.

## See Also

- [State](../05-state/index.md)
- [Layout](../04-layout/index.md)
- [Troubleshooting](../12-troubleshooting/index.md)
