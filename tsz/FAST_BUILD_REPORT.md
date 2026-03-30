# Fast Cart Build — Prototype Report

## The Problem

Every cart build takes 19-25s because Zig re-runs LLVM on the entire framework (36K+ lines of Zig + QuickJS + SDL3 + FreeType + wgpu + blend2d + vello) every time `generated_app.zig` changes. A 3-node flex test takes the same time as a 500-node dashboard.

## The Solution (Proven)

Split compilation into two phases:

1. **Engine build** (once): Compile the entire framework into `libreactjit-core.a` with full LLVM optimization. Cache it. Only rebuild when framework source changes.

2. **Cart build** (per-app): Compile `generated_app.zig` against `framework/api.zig` (types + extern fn declarations, zero framework function bodies). Link against the cached `.a`. No LLVM runs on framework code.

## Measured Results

| Step | Time | Notes |
|---|---|---|
| Engine `.a` build (first time) | 24s | Same as current full build — runs once |
| Engine `.a` rebuild (cached) | 68ms | Only rebuilds if framework changes |
| Cart compile (api.zig types) | 400ms | Includes cImport for QuickJS header |
| Cart link (against cached .a) | 80ms | Symbol resolution only, no LLVM |
| **Total cart build** | **~500ms** | **40x faster than 19-25s today** |

Binary sizes are comparable: 33MB (normal) vs 37MB (fast). Both produce working standalone ELF executables with clicking, rendering, state, layout — verified on d23_empty_array and test_click carts.

## What Exists Right Now

### Files created:

- **`framework/api.zig`** — Self-contained types (Node, Style, Color, EventHandler, all enums) + extern fn declarations for state/engine/qjs_runtime. 280 lines. Zero imports of framework modules. Compiles in 32ms standalone.

- **`framework/core.zig`** — Framework root module that re-exports layout/state/engine/qjs_runtime AND provides C-ABI export wrappers (`rjit_state_create_slot`, `rjit_qjs_call_global`, `rjit_engine_run`, etc.) that api.zig's extern declarations resolve against.

- **`build.zig`** — New `core` build step (`zig build core`) that produces `libreactjit-core.a`. New `cart-fast` step (needs wiring).

### The manual pipeline (working today):

```bash
# One-time: build engine
zig build core -Doptimize=ReleaseFast    # 24s, cached after

# Per-cart: compile + link (~500ms)
./zig-out/bin/forge build carts/my_app.tsz
sed <transform imports to use api.zig> generated_my_app.zig > generated_fast.zig
zig build-obj generated_fast.zig -fPIC -OReleaseFast -I../love2d/quickjs -I. -lc
zig cc generated_fast.o zig-out/lib/libreactjit-core.a \
  <wgpu.a> <blend2d.a> <vello.a> \
  -lSDL3 -lfreetype -lluajit-5.1 -lX11 -lm -lpthread -ldl \
  -lbox2d -lsqlite3 -lvterm -lcurl -larchive -lstdc++ \
  -o zig-out/bin/my_app
```

## What's Left to Ship

### 1. Smith emit.js — new import mode (~20 lines changed)

Smith currently emits:
```zig
const layout = @import("framework/layout.zig");
const state = @import("framework/state.zig");
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
```

Needs a flag (e.g. `__fast_build = true`) to emit instead:
```zig
const api = @import("framework/api.zig");
const layout = api;
const state = api.state;
const engine = api.engine;
const qjs_runtime = api.qjs_runtime;
```

### 2. Build script (`scripts/build`) — `--fast` flag

```bash
tsz-build --fast carts/my_app.tsz
# Checks for cached libreactjit-core.a
# If missing, builds it (one-time 24s)
# Runs forge, compiles cart, links against .a
# Total: ~500ms
```

### 3. api.zig sync

api.zig duplicates type definitions from layout.zig. Two options:
- **Manual**: Keep in sync by hand. Types change rarely.
- **Generated**: A script extracts types from layout.zig into api.zig. Run when framework types change.

### 4. .so variant (optional, future)

The static `.a` approach works now but has one downside: blend2d and vello `.a` files weren't compiled with `-fPIC`, so they can't go into a shared library. If those are rebuilt with `-fPIC`, the engine could be a `.so` instead, enabling:
- Cart .so hot-reload against engine .so (same as dev-shell pattern but for production)
- Smaller distribution (one engine .so shared by all carts)

## Why This Works

Zig's build cache keys on source content hash. When `generated_app.zig` changes (different cart), Zig invalidates ALL transitive imports — the entire framework recompiles. This is Zig's compilation model; it's not a bug.

The fix: don't `@import` framework source in the cart. The cart imports `api.zig` which has only type definitions and `extern fn` declarations — no function bodies. Zig compiles this in milliseconds. Function bodies come from the pre-built `.a` at link time. The linker resolves symbols without running LLVM.

This is exactly how C/C++ projects work: headers give you types, `.a`/`.so` gives you implementations. `api.zig` is the header. `libreactjit-core.a` is the library.
