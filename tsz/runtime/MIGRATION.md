# Runtime Migration: .zig → .tsz

## Status: 11/43 files done

### Done (have .tsz, verified as drop-in)
| File | Lines | Notes |
|------|-------|-------|
| state.tsz | 388 | Core reactive state |
| input.tsz | 414 | TextInput handling |
| overlay.tsz | 341 | Menus, modals, tooltips |
| compositor.tsz | 240 | wgpu retained-mode compositor |
| query.tsz | 145 | Node query engine (testing) |
| canvas.tsz | 137 | Canvas renderer registry |
| panels.tsz | 117 | Panel registry |
| geometry.tsz | 102 | Window geometry persistence (needs sentinel slices) |
| events.tsz | 91 | Hit testing + event dispatch |
| mouse.tsz | 58 | Shared mouse state |
| breakpoint.tsz | 42 | Responsive breakpoints |

Also: layout.tsz (experimental/, the original proof-of-concept)
In progress: gpu.tsz (session 59d1)

### TODO (need .tsz rewrite) — 32 files

**Large (500+ lines)**
- text.zig (1149) — FreeType glyph rasterizer
- syntax.zig (834) — Syntax highlighter
- main.zig (789) — Runtime entry point
- privacy.zig (759) — Crypto/privacy
- vterm.zig (642) — Terminal emulation
- gpu.zig (629) — wgpu backend (IN PROGRESS)
- crypto.zig (605) — Crypto primitives
- classifier.zig (578) — Terminal token classifier
- fswatch.zig (574) — File watcher

**Medium (200-499 lines)**
- generated_app.zig (515) — Compiler output (SPECIAL CASE)
- library_index.zig (443) — File library indexer
- sqlite.zig (388) — SQLite wrapper
- pty.zig (377) — PTY spawning
- archive.zig (371) — libarchive integration
- animate.zig (364) — Animation + spring physics
- fs.zig (363) — Filesystem substrate
- windows.zig (357) — Multi-window manager
- bsod.zig (355) — Crash screen
- localstore.zig (321) — SQLite KV store
- testassert.zig (304) — Test assertions
- watchdog.zig (245) — RSS leak guard
- router.zig (239) — Routing + pattern matcher
- audit.zig (214) — Audit logging

**Small (<200 lines)**
- gpu_shaders.zig (174) — WGSL shader strings (SPECIAL: multiline \\)
- telemetry.zig (156) — Frame perf telemetry
- testdriver.zig (154) — Input simulation
- testharness.zig (136) — Test runner
- mpv.zig (103) — libmpv video
- image.zig (99) — stb_image loader
- leaktest.zig (23) — Intentional leak test
- c.zig (21) — C imports (MAY STAY AS .zig)

### Special cases
- `c.zig` — Pure @cImport. May always be .zig (compiler can't @cImport).
- `generated_app.zig` — Compiler output, not hand-written.
- `gpu_shaders.zig` — Multiline \\ strings need compiler support.

### Compiler gaps blocking remaining files
- `[_]T{.{}} ** N` array repetition (workaround: use undefined)
- `[:0]const u8` sentinel slices (blocks geometry.zig)
- Struct methods (pub fn inside struct) (blocks image.zig, router.zig)
- `\\` multiline strings (blocks gpu_shaders.zig)
- `anytype` params (blocks testharness.zig)
- `for (items, 0..) |item, i|` indexed iteration (blocks router.zig)
- `+%` wrapping operators (blocks input.zig tab cycling)

### When to move directories
Once session 59d1 finishes gpu.tsz, move all .tsz files to runtime/tsz/
and set up runtime/compiled/ for generated output. Update build.zig
to compile from runtime/tsz/ → runtime/compiled/.
