# .zig → .tsz Migration Checklist

**Rule:** If it's not generating code, it should be generated code.
Every `.zig` in `runtime/compiled/` needs a `.tsz` source in `runtime/tsz/`.

**Done:** 18 / 55 (33%)

---

## Done (have .tsz source in runtime/tsz/)

- [x] breakpoint.tsz
- [x] canvas.tsz
- [x] compositor.tsz
- [x] events.tsz
- [x] geometry.tsz
- [x] gpu.tsz
- [x] input.tsz
- [x] layout.tsz
- [x] mouse.tsz
- [x] overlay.tsz
- [x] panels.tsz
- [x] query.tsz
- [x] state.tsz
- [x] audit.tsz
- [x] classifier.tsz
- [x] library_index.tsz
- [x] syntax.tsz
- [x] telemetry.tsz

---

## Need .tsz conversion (37 files)

### Rendering / UI
- [ ] text.zig — text rendering (FreeType integration)
- [ ] image.zig — image loading/rendering (stb_image)
- [ ] gpu_shaders.zig — GPU shader definitions (wgpu)
- [ ] bsod.zig — crash screen UI
- [ ] windows.zig — window management (SDL2)
- [ ] animate.zig — animation system
- [ ] router.zig — view routing

### Core bootstrap
- [ ] main.zig — entry point / bootstrap
- [ ] generated_app.zig — app scaffolding
- [ ] c.zig — C interop / FFI bindings

### Data / Storage
- [ ] sqlite.zig — SQLite bindings
- [ ] localstore.zig — local storage
- [ ] fs.zig — filesystem operations
- [ ] fswatch.zig — file watching
- [ ] archive.zig — archive handling (tar/zip)
- [ ] crypto.zig — cryptography

### Media
- [ ] mpv.zig — media playback (libmpv)

### Networking (runtime/compiled/net/)
- [ ] net/http.zig — HTTP client
- [ ] net/http_test.zig — HTTP tests
- [ ] net/httpserver.zig — HTTP server
- [ ] net/manager.zig — connection manager
- [ ] net/ring_buffer.zig — ring buffer
- [ ] net/socks5.zig — SOCKS5 proxy
- [ ] net/tor.zig — Tor integration
- [ ] net/websocket.zig — WebSocket client
- [ ] net/wsserver.zig — WebSocket server

### System
- [ ] pty.zig — pseudo-terminal
- [ ] vterm.zig — virtual terminal emulator
- [ ] watchdog.zig — process watchdog
- [ ] privacy.zig — privacy features

### Utilities
- [ ] leaktest.zig — leak detection
- [ ] testassert.zig — test assertions
- [ ] testdriver.zig — test driver
- [ ] testharness.zig — test harness

### Framework (runtime/compiled/framework/)
- [ ] framework/inspector/panel.zig — inspector panel
- [ ] framework/inspector/overlay.zig — inspector overlay

---

## Not candidates (stays as-is)

- `stb/stb_image.h` + `stb_image_impl.c` — vendored C library
- `stb/stb_image_write.h` + `stb_image_write_impl.c` — vendored C library
- `ffi_libs.txt` — build config, not code
- `compiler/*.zig` — the compiler itself (can't compile itself)
