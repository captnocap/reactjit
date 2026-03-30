# Zig Performance Practices Audit

Audited: `tsz/framework/` — 79 `.zig` files
Date: 2026-03-28

## Summary Table

| Area | Current Practice | Recommendation | Priority |
|------|-----------------|----------------|----------|
| **1. Node struct size** | ~135 fields, plain `struct`, estimated **800–1000 bytes per node**. Style embedded inline (~300B). 3D fields (30+ f32s), physics fields (15+ fields), canvas fields (20+ fields) all present on every node even when unused. | Split into hot/cold: keep Style + computed + children + text + font_size + handlers in the hot Node (~128B). Move 3D, physics, canvas, terminal, effects into optional tagged unions or separate pools keyed by node index. 791 homepage nodes × 900B = 711KB of nodes, most of which is zeroed 3D/physics/canvas fields. | **high** |
| **2. Style struct size** | ~55 fields, plain `struct`, estimated **280–320 bytes**. 25 `?f32` (each 8B due to alignment = 200B alone). 4 `?Color` (8B each). No field grouping by access frequency. | Hot/cold split: `StyleCore` (direction, grow, shrink, basis, gap, padding, display, overflow, width, height — the 12 fields layout actually reads) at ~64B. `StyleVisual` (colors, borders, shadows, gradients) separate. Layout touches ~12 fields but pays for 55. Would cut layout cache misses by ~4×. | **high** |
| **3. Cache-line alignment** | No `align` annotations anywhere. No `extern struct`. Zig's default struct layout reorders fields for size but not for cache-line affinity. | Add `align(64)` to the Node struct if using SoA, or at minimum group the 5 fields layout reads every frame (`style.flex_direction`, `style.flex_grow`, `style.display`, `computed`, `children`) into the first 64 bytes. Current struct lets Zig reorder freely — the hot fields could land anywhere. | **medium** |
| **4. SoA / MultiArrayList** | Not used. Nodes are an AoS slice (`[]Node`). The tree is statically allocated in the generated `.zig` as `var _arr_N = [_]Node{ ... }`. Children are slices into other static arrays. No dynamic pool. | SoA via `MultiArrayList` would help the paint loop (which iterates all visible nodes reading only `computed` + `style.background_color` + `text`). But the static-array tree topology makes SoA hard to retrofit — children are pointers into static arrays. **Not actionable without changing the codegen model.** Would require generated code to use indices into a central pool instead of pointer slices. | **low** (high effort, codegen change) |
| **5. Allocator strategy** | `std.heap.page_allocator` used directly in 6 files (text.zig, fswatch.zig, capture.zig, engine.zig, render_surfaces_vm.zig, dev_shell.zig). One `ArenaAllocator` in dev_shell.zig. Zero per-frame arenas. Zero `FixedBufferAllocator`. privacy.zig properly passes `Allocator` params. | Add a per-frame arena for transient allocations (text measurement scratch, layout temporaries). The `page_allocator` calls are mostly one-shot (process spawn, file read) so not hot-path — acceptable. The privacy.zig pattern (accept `Allocator` param) is correct and should be the standard for any new code. | **low** (hot path is allocation-free) |
| **6. Build modes** | `rjit build` uses link.lua which compiles carts with `-ODebug -fstrip` (Zig's fast x86 backend, no LLVM). Engine `.a` is built once with `ReleaseFast` via `zig build core`. Dev shell forced to `ReleaseFast` even when user requests Debug (line 132: "Debug mode tanks layout perf"). | **Already excellent.** The two-tier strategy (pre-built ReleaseFast engine + Debug cart compilation) is textbook correct. Cart code is data declarations + thin handlers — LLVM would waste time. 60ms cart compile + 40ms link = 100ms iteration. No changes needed. | **none** |
| **7. Module boundaries** | Engine is a single monolithic `.a` built from `framework/core.zig`. All 79 framework files compile together. Changing any framework file rebuilds the entire engine. Cart builds only compile `generated_app.zig` against `api.zig` (types-only, no framework source). | Cart isolation is excellent (api.zig decouples cart from engine). The engine monolith is fine — it builds once and is cached. If engine iteration becomes a bottleneck, split into `core.a` (layout + state + events) and `plugins.a` (3D, physics, terminal, video, crypto). At ~24s full rebuild, low priority. | **low** |
| **8. Inline/noinline discipline** | 1 `inline fn` in layout.zig (`asF32` — comptime type-dispatch helper, correct). 4 `noinline fn` in engine_paint.zig (paintNodeVisuals, paintTextInput, paintTerminal, paintCanvasContainer — correct, prevents code bloat in hot paint loop). No other annotations. | **Already good.** `noinline` on heavy paint functions keeps `paintNode` tight for the common path. `inline` on `asF32` is a comptime generic — required. Layout functions unannotated, letting compiler decide — correct default. | **none** |
| **9. Comptime usage** | 74 occurrences across 19 files. Mostly `@compileError` for type safety, `comptime` in `asF32`, theme palette builders. No comptime code generation or metaprogramming. | Clean. No excessive comptime bloat. Theme's `buildPalette` uses `inline for` over enum fields — correct and minimal. | **none** |
| **10. Profiling infra** | **None.** No Tracy integration. No perf markers. No frame-pointer policy. Telemetry system (`[telemetry] FPS: 240 | layout: 12us | paint: 4us`) provides frame-level timing but no function-level breakdown. | Add Tracy zones to: `layoutNode`, `paintNode`, `paintNodeVisuals`, `gpu.drawRect`, `gpu.drawText`. Tracy is ~3 lines per zone and zero-cost when disabled. Would immediately answer "where is time spent in the 758us layout pass on the 791-node homepage?" Currently only total layout/paint visible, not per-node cost. | **medium** |
| **11. Testing** | Layout tests in `framework/test/layout_test.zig` with mock text measurement. `zig build test` runs compiler tests only (compiler/run_tests.zig). No framework test step in build.zig. No ReleaseFast perf tests. No benchmark harness. | Add `zig build test-framework` step for layout_test.zig. Add benchmark step measuring `layoutNode` on a 1000-node tree in both Debug and ReleaseFast. Current tests verify correctness only, no perf regression detection. | **medium** |

## Key Findings

### What's Working Well
1. **Two-tier build** (pre-built engine .a + fast cart compilation) — textbook correct
2. **Inline/noinline discipline** — surgical and appropriate
3. **Comptime usage** — minimal, no bloat
4. **Cart isolation** via api.zig — carts never recompile the engine

### Biggest Wins Available
1. **Node struct diet** — The Node struct is ~900 bytes. A typical storybook page has 791 nodes = 711KB of node data. Most nodes use <10% of the fields. Splitting 3D/physics/canvas/terminal into optional side-tables would cut Node to ~200 bytes (4× reduction) and dramatically improve cache utilization during layout/paint.
2. **Style hot/cold split** — Layout reads 12 of 55 Style fields. Separating StyleCore from StyleVisual would make the layout pass cache-friendly.
3. **Tracy integration** — Zero-cost when disabled, instantly answers "why is this frame slow?"

### Not Worth Changing
- SoA conversion (requires codegen model change, high effort for uncertain payoff with static trees)
- Allocator patterns (hot path is already allocation-free)
- Build DAG (engine monolith is fine, rebuilds are cached)
